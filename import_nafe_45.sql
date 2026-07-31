-- =============================================================
-- Import 45 historical appointments -> patients + appointments
-- Doctor: Dr. Sheikh Md. Abdullah (matched by name, fallback DR01)
-- Status: confirmed | Type: appointment (in-person)
-- fee_type: new | paid/refunded/advance: 0 | booked_by: Nafe
-- Appointment DATE = 2026-08-01 (today) for ALL rows.
-- created_at keeps the original entry date & time.
-- Serial numbers generated in app format:
--   DRxx-NNNAN+last4(phone)  (counting confirmed/completed on 2026-08-01)
-- Gender corrections applied per source remarks (Begum/Shirina -> female),
-- phone for AHMED ULLAH was a name in the source -> left empty.
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
  v_appt_date date := '2026-08-01';
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
    ('TANJIN','male',22,'01744','15:00','2026-07-26 09:15:00'),
    ('SAJIB','male',22,'01555','15:08','2026-07-26 09:15:00'),
    ('SRABONI','male',55,'01555','15:15','2026-07-26 09:15:00'),
    ('KAIYUM','male',24,'01997411168','15:22','2026-07-26 09:17:00'),
    ('ROZI','male',40,'01997411168','15:29','2026-07-26 09:17:00'),
    ('ANARUL MIA','male',26,'01998209637','15:36','2026-07-26 10:53:00'),
    ('MIZANUR RAHMAN','male',32,'01778431423','15:43','2026-07-26 15:32:00'),
    ('TANMOY','male',24,'01737108685','15:50','2026-07-27 10:14:00'),
    ('RAFAT HOSSEN','male',24,'01705852277','15:57','2026-07-27 10:18:00'),
    ('MD.JAHIDUL HAQUE','male',49,'01709309775','16:04','2026-07-27 13:16:00'),
    ('NURUL HASAN','male',40,'01760870414','16:11','2026-07-27 13:17:00'),
    ('MITU','male',40,'01732288943','16:18','2026-07-27 13:18:00'),
    ('SAMIRA','male',54,'01715007744','16:25','2026-07-27 13:18:00'),
    ('KAWSER','male',25,'01605520944','16:32','2026-07-27 13:18:00'),
    ('RASEL','male',32,'01736738345','16:39','2026-07-27 13:18:00'),
    ('MD MOHIBUR RAHMAN','male',28,'01723070812','16:46','2026-07-27 13:19:00'),
    ('ARIF','male',33,'+8801626852958','16:53','2026-07-27 13:55:00'),
    ('MD ABDUL GAFFAR','male',36,'01737341119','17:00','2026-07-27 18:06:00'),
    ('TANJIBUL','male',22,'01603435984','17:07','2026-07-27 18:06:00'),
    ('SAHAJAN','male',40,'01748761259','17:14','2026-07-27 18:06:00'),
    ('MAWLANA SHORIFUL ISLAM','male',40,'01710185821','17:21','2026-07-27 18:07:00'),
    ('MD RAHUL APON','male',19,'01855635441','17:28','2026-07-27 18:07:00'),
    ('SHAH-JAHAN','male',40,'01748761259','17:35','2026-07-27 18:07:00'),
    ('MD NUR NOBI','male',25,'01738558153','17:42','2026-07-28 08:29:00'),
    ('TARIQUL','male',28,'01521300213','17:49','2026-07-28 08:34:00'),
    ('SOMRAT KAZI','male',32,'01611890356','17:56','2026-07-28 08:34:00'),
    ('MD SHAMIM MIAH','male',23,'01738172841','18:03','2026-07-28 08:35:00'),
    ('JONI','male',42,'01715473192','18:10','2026-07-28 13:50:00'),
    ('HASIBUL','male',20,'01893111259','18:17','2026-07-28 13:53:00'),
    ('AHMED ULLAH','male',33,NULL,'18:24','2026-07-28 22:43:00'),
    ('SHAKIL AHMED','male',23,'01303314703','18:31','2026-07-28 22:44:00'),
    ('MUEEN HOSSAIN','male',21,'01608015999','18:38','2026-07-28 22:44:00'),
    ('MD.ABU SAID','male',35,'01844538513','18:45','2026-07-28 22:44:00'),
    ('NASIMA BEGUM','female',52,'01577559986','18:52','2026-07-28 22:45:00'),
    ('SAIM AHMED','male',21,'01540624034','18:59','2026-07-28 22:45:00'),
    ('SHIRINA TALUKDER','female',45,'01540624034','19:06','2026-07-28 22:46:00'),
    ('MD KAMAL HOSSEN','male',40,'01720194367','19:13','2026-07-28 22:46:00'),
    ('ARIF SARKER','male',26,'01755714300','19:20','2026-07-28 22:46:00'),
    ('ABDUL GOFFER BHUIYA','male',75,'01737249974','19:27','2026-07-28 22:47:00'),
    ('PANMOTI BEGUM','female',50,'01854957700','19:34','2026-07-28 22:47:00'),
    ('RUMA','female',43,'01846186836','20:00','2026-07-28 22:49:00'),
    ('SAKIL AHMED','male',23,'01303314703','20:10','2026-07-28 22:50:00'),
    ('SELINA BEGUM','female',52,'01738730405','20:20','2026-07-28 22:50:00'),
    ('SHIRINA TALUKDER','female',45,'01540624034','20:30','2026-07-29 11:28:00'),
    ('RULI BEGUM','female',45,'01780166295','20:40','2026-07-29 11:33:00');

  FOR rec IN SELECT * FROM import_rows ORDER BY seq LOOP
    v_email := 'import_' || rec.seq || '_' || to_char(rec.entry_dt, 'YYYYMMDD') || '@clinicconnect.local';

    INSERT INTO public.patients (name, email, phone, password, age, sex, compliant)
    VALUES (rec.patient_name, v_email, rec.phone, 'walkin_temp', rec.age, rec.gender, 'false')
    RETURNING id INTO v_patient_id;

    v_counter := v_counter + 1;

    v_phone_last := '';
    IF rec.phone IS NOT NULL AND rec.phone <> '' THEN
      v_phone_last := substring(regexp_replace(rec.phone, '\D', '', 'g') from '.{4}$');
    END IF;

    v_serial := v_doctor_code || '-' || lpad(v_counter::text, 3, '0') || 'AN' || v_phone_last;

    INSERT INTO public.appointments (
      patient_id, doctor_id, "date", time, status, type, fee_type,
      advance, paid, refunded, booked_by, patient_mobile, serial_number,
      created_at, updated_at
    ) VALUES (
      v_patient_id, v_doctor_id, v_appt_date, rec.in_time, 'confirmed', 'appointment', 'new',
      0, 0, 0, 'Nafe', rec.phone, v_serial,
      rec.entry_dt, rec.entry_dt
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
WHERE a.booked_by = 'Nafe'
ORDER BY a.created_at;
