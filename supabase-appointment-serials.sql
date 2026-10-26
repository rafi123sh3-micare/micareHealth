-- Apply once in the Supabase SQL editor (safe to re-run).
-- Shyamoli: morning and evening are independent queues (001ANM… vs 001ANE…).
-- Cumilla (shift IS NULL): one daily queue with no M/E marker.
-- Shift also drives expected time (10 AM vs 5 PM) and SMS.

-- Add shift column if missing, with check constraint.
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS shift TEXT;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'appointments_shift_check') THEN
    ALTER TABLE public.appointments
      ADD CONSTRAINT appointments_shift_check
      CHECK (shift IS NULL OR shift IN ('morning', 'evening'));
  END IF;
END $$;

-- Index on doctor + date + shift for faster per-session lookups.
CREATE INDEX IF NOT EXISTS appointments_doctor_date_idx
  ON public.appointments (doctor_id, date);
CREATE INDEX IF NOT EXISTS appointments_doctor_date_shift_idx
  ON public.appointments (doctor_id, date, shift);

DROP TRIGGER IF EXISTS appointments_serial_is_immutable ON public.appointments;
DROP FUNCTION IF EXISTS public.prevent_appointment_serial_change();
DROP INDEX IF EXISTS public.appointments_unique_queue_position;

-- Re-sequence independently per doctor/date/shift.
CREATE OR REPLACE FUNCTION public.resequence_daily_appointments(p_doctor_id UUID, p_date DATE)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(p_doctor_id::TEXT || ':' || p_date::TEXT));
  WITH queue AS (
    SELECT id,
      row_number() OVER (
        PARTITION BY COALESCE(shift, '')
        ORDER BY (
          COALESCE((substring(serial_number FROM '-([0-9]+)'))::INTEGER, 2147483647)
        ), created_at NULLS LAST, id
      ) AS queue_position
    FROM public.appointments
    WHERE doctor_id = p_doctor_id AND date = p_date AND status IN ('confirmed', 'completed')
  )
  UPDATE public.appointments AS appointment
  SET serial_number = regexp_replace(appointment.serial_number, '-[0-9]+', '-' || lpad(queue.queue_position::TEXT, 3, '0'))
  FROM queue
  WHERE appointment.id = queue.id AND appointment.serial_number ~ '-[0-9]+';
END;
$$;

CREATE OR REPLACE FUNCTION public.resequence_daily_appointments_on_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') THEN PERFORM public.resequence_daily_appointments(OLD.doctor_id, OLD.date); END IF;
  IF TG_OP IN ('INSERT', 'UPDATE') THEN PERFORM public.resequence_daily_appointments(NEW.doctor_id, NEW.date); END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS appointments_resequence_daily_queue ON public.appointments;
CREATE TRIGGER appointments_resequence_daily_queue
  AFTER INSERT OR DELETE OR UPDATE OF doctor_id, date, status, shift ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.resequence_daily_appointments_on_change();

-- Stamp M/E onto existing Shyamoli serials that predate the shift marker.
UPDATE public.appointments
SET serial_number = regexp_replace(serial_number, '([AT][NFR]?)(\d+)$', '\1M\2')
WHERE shift = 'morning'
  AND serial_number ~ '[AT][NFR]?\d+$'
  AND serial_number !~ '[AT][NFR]?[ME]\d+$';

UPDATE public.appointments
SET serial_number = regexp_replace(serial_number, '([AT][NFR]?)(\d+)$', '\1E\2')
WHERE shift = 'evening'
  AND serial_number ~ '[AT][NFR]?\d+$'
  AND serial_number !~ '[AT][NFR]?[ME]\d+$';

-- Normalize the existing queues once (per shift).
DO $$
DECLARE queue_day RECORD;
BEGIN
  FOR queue_day IN SELECT DISTINCT doctor_id, date FROM public.appointments WHERE status IN ('confirmed', 'completed') LOOP
    PERFORM public.resequence_daily_appointments(queue_day.doctor_id, queue_day.date);
  END LOOP;
END;
$$;

-- Per-shift serial reservation. Morning and evening each start at 001.
DROP FUNCTION IF EXISTS public.reserve_appointment_serial(UUID, DATE, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.reserve_appointment_serial(UUID, DATE, TEXT, TEXT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.reserve_appointment_serial(
  p_doctor_id UUID,
  p_date DATE,
  p_type TEXT,
  p_fee_type TEXT DEFAULT '',
  p_phone TEXT DEFAULT '',
  p_shift TEXT DEFAULT NULL
)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_position INTEGER;
  v_doctor_code TEXT;
  v_type_suffix TEXT;
  v_fee_prefix TEXT;
  v_shift_marker TEXT;
BEGIN
  SELECT count(*) + 1 INTO v_position FROM public.appointments
  WHERE doctor_id = p_doctor_id
    AND date = p_date
    AND status IN ('confirmed', 'completed')
    AND (
      (p_shift IS NULL AND (shift IS NULL OR shift = ''))
      OR shift = p_shift
    );

  SELECT COALESCE(doctor_code, 'DR01') INTO v_doctor_code FROM public.doctors WHERE id = p_doctor_id;
  v_type_suffix := CASE WHEN p_type = 'teleconsult' THEN 'T' ELSE 'A' END;
  v_fee_prefix := CASE p_fee_type WHEN 'new' THEN 'N' WHEN 'follow_up' THEN 'F' WHEN 'report' THEN 'R' ELSE '' END;
  v_shift_marker := CASE p_shift WHEN 'evening' THEN 'E' WHEN 'morning' THEN 'M' ELSE '' END;

  RETURN COALESCE(v_doctor_code, 'DR01')
    || '-' || lpad(v_position::TEXT, 3, '0')
    || v_type_suffix
    || v_fee_prefix
    || v_shift_marker
    || right(regexp_replace(COALESCE(p_phone, ''), '\D', '', 'g'), 4);
END;
$$;

GRANT EXECUTE ON FUNCTION public.reserve_appointment_serial(UUID, DATE, TEXT, TEXT, TEXT, TEXT) TO anon, authenticated;
