-- =============================================================
-- Import 19 appointments -> patients + appointments
-- Doctor: Dr. Sheikh Md. Abdullah (matched by name, fallback DR01)
-- Status: confirmed | Type: appointment (in-person)
-- fee_type: new | paid/refunded/advance: 0 | booked_by: Nafe
-- Appointment DATE = 2026-08-09 (per OPD report) for ALL rows.
-- created_at = 2026-08-09 + In Time, so rows appear in the exact list order (1..19).
-- Serial numbers generated in app format:
--   DRxx-NNNAN+last4(phone)  (counting confirmed/completed on 2026-08-09)
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
  v_appt_date date := '2026-08-09';
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
    ('SAKIB','male',25,'01621990219','15:00','2026-08-01 21:53:00'),
    ('TAHURA','male',65,'01621990219','15:08','2026-08-01 21:54:00'),
    ('PROBOT CHAUDHARY','male',20,'01740499105','15:15','2026-08-02 14:40:00'),
    ('KAMRUL HASAN','male',32,'01811406391','15:22','2026-08-02 16:41:00'),
    ('ISRAT JAMAN','male',49,'01408929660','15:29','2026-08-03 10:26:00'),
    ('ABU BSHAR','male',45,'01824996291','15:36','2026-08-03 13:45:00'),
    ('MILON HAWLADER','male',0,'01918534952','15:43','2026-08-03 13:45:00'),
    ('MD TAWFIK','male',39,'01912706792','15:50','2026-08-03 13:47:00'),
    ('SIRAJ','male',35,'0851445465','15:57','2026-08-03 13:47:00'),
    ('RAIYAN','male',36,'01793626562','16:04','2026-08-01 21:58:00'),
    ('ASHRAFUZ ZAMAN','male',18,'01796530528','16:11','2026-08-01 21:59:00'),
    ('YASIN','male',45,'01644707333','16:18','2026-08-02 11:45:00'),
    ('RUHI','male',0,'01575686847','16:25','2026-08-03 16:22:00'),
    ('SOHEL','male',27,'01575686847','16:32','2026-08-03 16:25:00'),
    ('SOHEL','male',31,'01884487457','16:39','2026-08-03 19:13:00'),
    ('MR. KHALED HOWLADER','male',21,'01796034013','16:46','2026-08-03 19:14:00'),
    ('MR. TAHER','male',55,'01712872085','16:53','2026-08-03 19:36:00'),
    ('MR. SADEK ALI','male',23,'01936587333','17:00','2026-08-03 21:33:00'),
    ('MR. GALIB SABBIR HOSSEN','male',21,'01784818844','17:07','2026-08-04 09:34:00');

  FOR rec IN SELECT * FROM import_rows ORDER BY seq LOOP
    v_email := 'import4_' || rec.seq || '_' || to_char(rec.entry_dt, 'YYYYMMDD') || '@clinicconnect.local';

    INSERT INTO public.patients (name, email, phone, password, age, sex, compliant)
    VALUES (rec.patient_name, v_email, rec.phone, 'walkin_temp', rec.age, rec.gender, 'false')
    RETURNING id INTO v_patient_id;

    v_counter := v_counter + 1;

    v_phone_last := '';
    IF rec.phone IS NOT NULL AND rec.phone <> '' THEN
      v_phone_last := right(regexp_replace(rec.phone, '\D', '', 'g'), 4);
    END IF;

    v_serial := v_doctor_code || '-' || lpad(v_counter::text, 3, '0') || 'AN' || v_phone_last;

    -- created_at = appointment date + in-time so rows appear in list order (1..19)
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
WHERE a.booked_by = 'Nafe' AND a."date" = '2026-08-09'
ORDER BY a.time;
