-- =============================================================
-- Import 55 appointments -> patients + appointments
-- Doctor: Dr. Sheikh Md. Abdullah (matched by name, fallback DR01)
-- Status: confirmed | Type: appointment (in-person)
-- fee_type: new | paid/refunded/advance: 0 | booked_by: Nafe
-- Appointment DATE = 2026-08-02 (today) for ALL rows.
-- created_at = 2026-08-02 + In Time, so rows appear in the exact list order (1..55).
-- Serial numbers generated in app format:
--   DRxx-NNNAN+last4(phone)  (counting confirmed/completed on 2026-08-02)
-- NOTE: "ALEYA (F.UP)" (row 55) listed as New Patient in source -> kept 'new'.
--       Rows 1-3 are RESERVE placeholders with phone "22".
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
  v_appt_date date := '2026-08-02';
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
    ('RESERVE','male',22,'2222','15:00','2026-07-31 16:44:00'),
    ('RESERV','male',22,'2222','15:08','2026-07-31 16:44:00'),
    ('RESERVE','male',22,'2222','15:15','2026-07-31 16:44:00'),
    ('AHSANUL HASAN','male',43,'01717747697','15:22','2026-07-26 15:31:00'),
    ('ABDUL RAZZAK','male',35,'+8801777454761','15:29','2026-07-27 10:15:00'),
    ('ANNOY DEWAN','male',19,'01609727172','15:36','2026-07-29 11:27:00'),
    ('ABU SAYEED','male',24,'01708577076','15:43','2026-07-29 11:29:00'),
    ('SOHEL RANA','male',29,'01817873991','15:50','2026-07-30 09:06:00'),
    ('AL FAHAD RONY','male',28,'01641-861797','15:57','2026-07-30 09:19:00'),
    ('LAVLY','male',55,'01704076258','16:04','2026-07-30 16:02:00'),
    ('ABDUL MAZID','male',55,'01741210466','16:11','2026-07-30 16:02:00'),
    ('JAKARIA','male',30,'01612280847','16:18','2026-07-30 16:03:00'),
    ('MOSTOFA SAIFUL ISLAM','male',65,'01715063536','16:25','2026-07-30 16:05:00'),
    ('EMRAN HOSSEN BHUIYAN','male',27,'01709090217','16:32','2026-07-30 16:06:00'),
    ('ABDUL MOZID','male',55,'01741210466','16:39','2026-07-30 16:06:00'),
    ('SHARIA','male',31,'01540516492','16:46','2026-07-30 18:30:00'),
    ('MORIUM BEGUM','female',65,'01779980752','16:53','2026-07-30 19:13:00'),
    ('RUBEL MIA','male',35,'0187628240','17:00','2026-07-30 21:39:00'),
    ('MD SABBIR HOSSEN','male',21,'01784818844','17:07','2026-07-31 16:46:00'),
    ('ABU NASER','male',28,'01580499209','17:14','2026-07-31 16:47:00'),
    ('SHAKIB','male',25,'01621990219','17:21','2026-07-31 17:30:00'),
    ('TOHORA KHATUN','female',65,'01621990219','17:28','2026-07-31 17:30:00'),
    ('PARVIN','female',55,'01775091880','17:35','2026-07-31 20:51:00'),
    ('PARVIN','female',55,'01775091880','17:42','2026-08-01 08:57:00'),
    ('KAMAL PASHA','male',31,'01986457487','17:49','2026-08-01 15:28:00'),
    ('SOHAN','male',18,'01884333536','17:56','2026-08-01 16:55:00'),
    ('JINON AHMAD','male',29,'01793629269','18:03','2026-08-01 16:56:00'),
    ('GALIB','male',23,'01936587333','18:10','2026-08-01 16:57:00'),
    ('JAHIDUL ISLAM','male',34,'01915900262','18:17','2026-08-01 16:58:00'),
    ('SHAMIM','male',30,'01312168528','18:24','2026-08-01 16:59:00'),
    ('JAHER ABDUL KADE','male',40,'01980722311','18:31','2026-08-01 17:07:00'),
    ('HABIBUR RAHMAN','male',36,'01835070883','18:38','2026-08-01 17:11:00'),
    ('ABU NASER','male',28,'01580499209','18:45','2026-08-01 17:12:00'),
    ('MD KHAIRUL ISLAM','male',37,'01712288971','18:52','2026-08-01 17:13:00'),
    ('AL AMIN','male',35,'01324160833','18:59','2026-08-01 17:14:00'),
    ('MIZAN AHMAD','male',23,'01335681480','19:06','2026-08-01 17:39:00'),
    ('ABU KAWSER','male',33,'01722825513','19:13','2026-08-01 18:00:00'),
    ('AL FAHAD RONI','male',28,'01641-861797','19:20','2026-08-01 18:34:00'),
    ('ANOWAR HOSSAIN','male',64,'01676936492','19:27','2026-08-01 18:35:00'),
    ('HARUN OR ROSID','male',31,'01788513164','19:34','2026-08-01 18:36:00'),
    ('JIHAD HASAN','male',21,'01712727409','20:00','2026-08-01 21:20:00'),
    ('SHORNA','male',25,'01619911022','20:10','2026-08-01 21:20:00'),
    ('YEASIN KHAN','male',18,'01796530528','20:20','2026-08-01 21:21:00'),
    ('SAHED','male',50,'01926665712','20:30','2026-08-01 21:22:00'),
    ('YOUSUF ALI','male',20,'01892907764','20:40','2026-08-01 21:23:00'),
    ('REZAUL KARIM','male',30,'01314990844','20:50','2026-08-01 21:42:00'),
    ('AZIM','male',31,'01741909274','21:00','2026-08-01 21:43:00'),
    ('FAISAL','male',38,'01713378064','21:10','2026-08-01 21:43:00'),
    ('MD ARMAN','male',31,'01610145999','21:20','2026-08-01 21:44:00'),
    ('MARUF','male',29,'01832591040','21:30','2026-08-01 21:45:00'),
    ('YOUSUF','male',33,'01743097024','21:40','2026-08-01 21:46:00'),
    ('MD.FARUQ','male',25,'01610145999','21:50','2026-08-01 21:47:00'),
    ('MD ARMAN','male',25,'01610145999','22:00','2026-08-01 21:49:00'),
    ('MUEEN HOSSAIN','male',21,'01608015999','22:10','2026-08-01 21:50:00'),
    ('ALEYA (F.UP)','male',50,'01715817602','22:20','2026-08-01 21:50:00');

  FOR rec IN SELECT * FROM import_rows ORDER BY seq LOOP
    v_email := 'import2_' || rec.seq || '_' || to_char(rec.entry_dt, 'YYYYMMDD') || '@clinicconnect.local';

    INSERT INTO public.patients (name, email, phone, password, age, sex, compliant)
    VALUES (rec.patient_name, v_email, rec.phone, 'walkin_temp', rec.age, rec.gender, 'false')
    RETURNING id INTO v_patient_id;

    v_counter := v_counter + 1;

    v_phone_last := '';
    IF rec.phone IS NOT NULL AND rec.phone <> '' THEN
      v_phone_last := right(regexp_replace(rec.phone, '\D', '', 'g'), 4);
    END IF;

    v_serial := v_doctor_code || '-' || lpad(v_counter::text, 3, '0') || 'AN' || v_phone_last;

    -- created_at = appointment date + in-time so rows appear in list order (1..55)
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
WHERE a.booked_by = 'Nafe' AND a."date" = '2026-08-02'
ORDER BY a.time;
