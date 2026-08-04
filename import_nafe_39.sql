-- =============================================================
-- Import 39 appointments -> patients + appointments
-- Doctor: Dr. Sheikh Md. Abdullah (matched by name, fallback DR01)
-- Status: confirmed | Type: appointment (in-person)
-- fee_type: new | paid/refunded/advance: 0 | booked_by: Nafe
-- Appointment DATE = 2026-08-08 for ALL rows.
-- created_at = 2026-08-08 + In Time, so rows appear in the exact list order (1..39).
-- Serial numbers generated in app format:
--   DRxx-NNNAN+last4(phone)  (counting confirmed/completed on 2026-08-08)
-- Genders kept as in source (TAHMINA AKTER listed MALE with no remark).
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
  v_appt_date date := '2026-08-08';
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
    ('MD. MAMUN','male',31,'01762475363','15:00','2026-07-30 09:21:00'),
    ('JOHIR UDDIN BABOR','male',24,'01762097804','15:08','2026-08-01 08:54:00'),
    ('SK. MD. ALI','male',36,'01713289678','15:15','2026-08-02 11:47:00'),
    ('ALIF NUR','male',25,'01750334033','15:22','2026-08-02 11:47:00'),
    ('SORIF BHUIYA','male',45,'01914251712','15:29','2026-08-02 12:41:00'),
    ('NAZMUL','male',38,'01671719335','15:36','2026-08-02 12:42:00'),
    ('MD RAZU HASAN','male',27,'01760394911','15:43','2026-08-02 13:23:00'),
    ('ISRAFIL','male',10,'01832054812','15:50','2026-08-02 13:24:00'),
    ('ALAMIN','male',27,'0174788952','15:57','2026-08-02 13:25:00'),
    ('MD KHALID','male',31,'+8801884487457','16:04','2026-08-02 13:29:00'),
    ('JAHIDUL ISLAM','male',34,'01915900262','16:11','2026-08-02 13:30:00'),
    ('MD RABBI','male',21,'01927892657','16:18','2026-08-02 13:30:00'),
    ('MD ARMAN','male',31,'01610145999','16:25','2026-08-02 14:51:00'),
    ('RUMA','male',43,'01300288460','16:32','2026-08-02 15:08:00'),
    ('SIRAJUL ISLAM','male',26,'01613462072','16:39','2026-08-02 15:37:00'),
    ('SHAHINUR ISLAM','male',27,'01349510841','16:46','2026-08-02 15:38:00'),
    ('AMIR HAMJA','male',32,'01760815289','16:53','2026-08-02 16:39:00'),
    ('HABIBULLAH BAHAR','male',70,'01670504059','17:00','2026-08-02 16:40:00'),
    ('POLLAB KUMAR','male',26,'01995989991','17:07','2026-08-02 16:48:00'),
    ('SORIF HISSAIN','male',28,'01717048780','17:14','2026-08-02 18:10:00'),
    ('JAHID HASAN','male',22,'01605377766','17:21','2026-08-02 18:37:00'),
    ('TANJIN','male',22,'0174144','17:28','2026-08-03 10:06:00'),
    ('TAMIM','male',22,'0187774','17:35','2026-08-03 10:07:00'),
    ('MAHBUB','male',22,'01555','17:42','2026-08-03 10:07:00'),
    ('TAHMINA AKTER','male',25,'01779635713','17:49','2026-08-03 10:27:00'),
    ('SIAM HOSSAN','male',18,'01619005517','17:56','2026-08-03 10:27:00'),
    ('ALI HOSSAIN','male',25,'01611815095','18:03','2026-08-03 13:46:00'),
    ('JUWEL RANA','male',23,'01576784379','18:10','2026-08-03 13:46:00'),
    ('MEHEDI HASAN','male',22,'01842560481','18:17','2026-08-03 13:46:00'),
    ('MD KHALED','male',31,'01884487457','18:24','2026-08-03 13:48:00'),
    ('ABDUL KADIR','male',36,'01725971872','18:31','2026-08-03 13:48:00'),
    ('ANAS HOSSAIN','male',32,'01627936618','18:38','2026-08-03 13:54:00'),
    ('SHIJAN AHMAD','male',19,'01339849624','18:45','2026-08-03 14:47:00'),
    ('UDDIN RIAZ','male',45,'01619716929','18:52','2026-08-03 14:48:00'),
    ('ANAMUL HASAN','male',25,'01721237431','18:59','2026-08-03 16:22:00'),
    ('MRS. ALEYA KHATUN','female',60,'01745414287','19:06','2026-08-03 18:21:00'),
    ('MR. MD.SAIFUL ISLAM','male',64,'01715063536','19:13','2026-08-03 19:09:00'),
    ('MR. MD.RAJIB','male',30,'01641678109','19:20','2026-08-03 19:09:00'),
    ('MR. JIBON AHMED','male',29,'01793629269','19:27','2026-08-03 19:56:00');

  FOR rec IN SELECT * FROM import_rows ORDER BY seq LOOP
    v_email := 'import3_' || rec.seq || '_' || to_char(rec.entry_dt, 'YYYYMMDD') || '@clinicconnect.local';

    INSERT INTO public.patients (name, email, phone, password, age, sex, compliant)
    VALUES (rec.patient_name, v_email, rec.phone, 'walkin_temp', rec.age, rec.gender, 'false')
    RETURNING id INTO v_patient_id;

    v_counter := v_counter + 1;

    v_phone_last := '';
    IF rec.phone IS NOT NULL AND rec.phone <> '' THEN
      v_phone_last := right(regexp_replace(rec.phone, '\D', '', 'g'), 4);
    END IF;

    v_serial := v_doctor_code || '-' || lpad(v_counter::text, 3, '0') || 'AN' || v_phone_last;

    -- created_at = appointment date + in-time so rows appear in list order (1..39)
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
WHERE a.booked_by = 'Nafe' AND a."date" = '2026-08-08'
ORDER BY a.time;
