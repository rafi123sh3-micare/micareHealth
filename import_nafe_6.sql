-- =============================================================
-- Import 6 appointments -> patients + appointments
-- Doctor: Dr. Sheikh Md. Abdullah (matched by name, fallback DR01)
-- Status: confirmed | Type: appointment (in-person)
-- fee_type: new | paid/refunded/advance: 0 | booked_by: Nafe
-- Appointment DATE = 2026-08-10 for ALL rows.
-- created_at = 2026-08-10 + In Time, so rows appear in the exact list order (1..6).
-- Serial numbers generated in app format:
--   DRxx-NNNAN+last4(phone)  (counting confirmed/completed on 2026-08-10)
-- =============================================================

-- Ensure required columns exist
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS fee_type TEXT;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS advance INTEGER DEFAULT 0;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS paid INTEGER DEFAULT 0;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS refunded INTEGER DEFAULT 0;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS booked_by TEXT;

DO $$
DECLARE
  v_doctor_id uuid;
  v_doctor_code text;
  v_counter integer;
  v_patient_id uuid;
  v_serial text;
  v_phone_last text;
  v_email text;
  v_appt_date date := '2026-08-10';
  rec record;
  v_rows integer := 0;
BEGIN
  SELECT id, doctor_code INTO v_doctor_id, v_doctor_code
  FROM public.doctors
  WHERE name ILIKE '%Sheikh Md. Abdullah%'
     OR name ILIKE '%Sheikh%Abdullah%'
     OR doctor_code = 'DR01'
  ORDER BY created_at ASC
  LIMIT 1;

  IF v_doctor_id IS NULL THEN
    RAISE EXCEPTION 'Doctor not found - edit the name/code match in this script';
  END IF;

  -- Base serial count = existing confirmed/completed appointments on that date
  SELECT count(*) INTO v_counter
  FROM public.appointments
  WHERE doctor_id = v_doctor_id
    AND "date" = v_appt_date
    AND status IN ('confirmed', 'completed');

  CREATE TEMP TABLE import_rows (
    seq serial PRIMARY KEY,
    patient_name text NOT NULL,
    gender text NOT NULL,
    age integer,
    phone text,
    in_time text,
    entry_dt timestamptz NOT NULL
  );

  INSERT INTO import_rows (patient_name, gender, age, phone, in_time, entry_dt) VALUES
    ('SOHAN SHEIKH','male',27,'01776716364','15:00','2026-08-02 18:12:00'),
    ('ANOWAR HOSSAIN','male',10,'01719128334','15:08','2026-08-02 21:25:00'),
    ('ALI AJGOR','male',22,'01897166162','15:15','2026-08-03 15:11:00'),
    ('MR. AYATUL NISHAT','male',30,'01711063370','15:22','2026-08-03 20:21:00'),
    ('MR. AHSANUL HASAN','male',43,'01717747697','15:29','2026-08-03 21:09:00'),
    ('MASUM','male',42,'01753905227','15:36','2026-08-04 09:34:00');

  FOR rec IN SELECT * FROM import_rows ORDER BY seq LOOP
    v_email := 'import5_' || rec.seq || '_' || to_char(rec.entry_dt, 'YYYYMMDD') || '@clinicconnect.local';

    INSERT INTO public.patients (name, email, phone, password, age, sex, compliant)
    VALUES (rec.patient_name, v_email, rec.phone, 'walkin_temp', rec.age, rec.gender, 'false')
    RETURNING id INTO v_patient_id;

    v_counter := v_counter + 1;

    v_phone_last := '';
    IF rec.phone IS NOT NULL AND rec.phone <> '' THEN
      v_phone_last := right(regexp_replace(rec.phone, '\D', '', 'g'), 4);
    END IF;

    v_serial := v_doctor_code || '-' || lpad(v_counter::text, 3, '0') || 'AN' || v_phone_last;

    -- created_at = appointment date + in-time so rows appear in list order (1..6)
    INSERT INTO public.appointments (
      patient_id, doctor_id, "date", time, status, type, fee_type,
      advance, paid, refunded, booked_by, patient_mobile, serial_number,
      created_at, updated_at
    ) VALUES (
      v_patient_id, v_doctor_id, v_appt_date, rec.in_time, 'confirmed', 'appointment', 'new',
      0, 0, 0, 'Nafe', rec.phone, v_serial,
      (v_appt_date || ' ' || rec.in_time)::timestamptz,
      (v_appt_date || ' ' || rec.in_time)::timestamptz
    );

    v_rows := v_rows + 1;
  END LOOP;

  RAISE NOTICE 'Inserted % appointments (doctor code: %)', v_rows, v_doctor_code;
END $$;

-- =============================================================
-- Verification: list the imported rows
-- =============================================================
SELECT a.serial_number, p.name, p.sex, p.age, p.phone, a."date", a.time, a.status, a.booked_by, a.created_at
FROM public.appointments a
JOIN public.patients p ON p.id = a.patient_id
WHERE a.booked_by = 'Nafe' AND a."date" = '2026-08-10'
ORDER BY a.time;
