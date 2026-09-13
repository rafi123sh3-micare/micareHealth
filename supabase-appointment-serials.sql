-- Apply this once in the Supabase SQL editor.
-- It makes serial allocation atomic and therefore prevents duplicate queue
-- numbers when bookings are saved or confirmed at the same time.

CREATE TABLE IF NOT EXISTS public.appointment_serial_counters (
  doctor_id UUID NOT NULL REFERENCES public.doctors(id) ON DELETE CASCADE,
  appointment_date DATE NOT NULL,
  last_sequence INTEGER NOT NULL DEFAULT 0 CHECK (last_sequence >= 0),
  PRIMARY KEY (doctor_id, appointment_date)
);

-- Repair only existing duplicate *queue positions*. The oldest booking keeps
-- its serial; later duplicates receive the next free sequence for that doctor
-- and date, while their type/fee/phone suffix remains unchanged.
WITH parsed AS (
  SELECT
    id,
    doctor_id,
    date,
    serial_number,
    created_at,
    (substring(serial_number FROM '-([0-9]+)'))::INTEGER AS sequence_number,
    row_number() OVER (
      PARTITION BY doctor_id, date, (substring(serial_number FROM '-([0-9]+)'))::INTEGER
      ORDER BY created_at NULLS LAST, id
    ) AS duplicate_rank
  FROM public.appointments
  WHERE serial_number ~ '-[0-9]+'
), max_sequences AS (
  SELECT doctor_id, date, MAX(sequence_number) AS max_sequence
  FROM parsed
  GROUP BY doctor_id, date
), duplicates_to_repair AS (
  SELECT
    parsed.id,
    max_sequences.max_sequence
      + row_number() OVER (PARTITION BY parsed.doctor_id, parsed.date ORDER BY parsed.created_at NULLS LAST, parsed.id)
      AS replacement_sequence
  FROM parsed
  JOIN max_sequences USING (doctor_id, date)
  WHERE parsed.duplicate_rank > 1
)
UPDATE public.appointments AS appointment
SET serial_number = regexp_replace(
  appointment.serial_number,
  '-[0-9]+',
  '-' || lpad(duplicates_to_repair.replacement_sequence::TEXT, 3, '0')
)
FROM duplicates_to_repair
WHERE appointment.id = duplicates_to_repair.id;

-- A queue position must be unique per doctor and appointment date. The full
-- serial includes a phone suffix, so a normal unique index on serial_number
-- alone would not catch two different patients both assigned queue #001.
CREATE UNIQUE INDEX IF NOT EXISTS appointments_unique_queue_position
  ON public.appointments (
    doctor_id,
    date,
    ((substring(serial_number FROM '-([0-9]+)'))::INTEGER)
  )
  WHERE serial_number ~ '-[0-9]+';

-- Once a serial has been assigned it is an immutable queue identifier. This
-- protects it even if a future client-side edit form accidentally includes a
-- newly generated serial_number in its update payload.
CREATE OR REPLACE FUNCTION public.prevent_appointment_serial_change()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.serial_number IS NOT NULL
     AND OLD.serial_number <> ''
     AND NEW.serial_number IS DISTINCT FROM OLD.serial_number THEN
    RAISE EXCEPTION 'An assigned appointment serial number cannot be changed';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS appointments_serial_is_immutable ON public.appointments;
CREATE TRIGGER appointments_serial_is_immutable
  BEFORE UPDATE ON public.appointments
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_appointment_serial_change();

-- Seed a counter from existing data. This deliberately examines every status:
-- a serial remains reserved even if its appointment is later cancelled.
INSERT INTO public.appointment_serial_counters (doctor_id, appointment_date, last_sequence)
SELECT
  doctor_id,
  date,
  MAX(COALESCE((substring(serial_number FROM '-([0-9]+)'))::INTEGER, 0))
FROM public.appointments
WHERE serial_number IS NOT NULL
  AND serial_number <> ''
GROUP BY doctor_id, date
ON CONFLICT (doctor_id, appointment_date)
DO UPDATE SET last_sequence = GREATEST(
  public.appointment_serial_counters.last_sequence,
  EXCLUDED.last_sequence
);

CREATE OR REPLACE FUNCTION public.reserve_appointment_serial(
  p_doctor_id UUID,
  p_date DATE,
  p_type TEXT,
  p_fee_type TEXT DEFAULT '',
  p_phone TEXT DEFAULT ''
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sequence INTEGER;
  v_doctor_code TEXT;
  v_type_suffix TEXT;
  v_fee_prefix TEXT;
  v_phone_suffix TEXT;
BEGIN
  INSERT INTO appointment_serial_counters (doctor_id, appointment_date, last_sequence)
  VALUES (p_doctor_id, p_date, 1)
  ON CONFLICT (doctor_id, appointment_date)
  DO UPDATE SET last_sequence = appointment_serial_counters.last_sequence + 1
  RETURNING last_sequence INTO v_sequence;

  SELECT COALESCE(doctor_code, 'DR01') INTO v_doctor_code
  FROM doctors
  WHERE id = p_doctor_id;

  v_type_suffix := CASE WHEN p_type = 'teleconsult' THEN 'T' ELSE 'A' END;
  v_fee_prefix := CASE p_fee_type
    WHEN 'new' THEN 'N'
    WHEN 'follow_up' THEN 'F'
    WHEN 'report' THEN 'R'
    ELSE ''
  END;
  v_phone_suffix := right(regexp_replace(COALESCE(p_phone, ''), '\D', '', 'g'), 4);

  RETURN COALESCE(v_doctor_code, 'DR01') || '-' || lpad(v_sequence::TEXT, 3, '0')
    || v_type_suffix || v_fee_prefix || v_phone_suffix;
END;
$$;

GRANT EXECUTE ON FUNCTION public.reserve_appointment_serial(UUID, DATE, TEXT, TEXT, TEXT)
  TO anon, authenticated;
