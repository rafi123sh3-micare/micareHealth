-- ============================================================================
-- CLINIC CONNECT - COMPLETE SUPABASE SCHEMA
-- Paste this entire file into the Supabase SQL Editor and run it.
-- Target: MAIN Supabase Project (lbuveiutdjwqzebmelob.supabase.co)
-- ============================================================================

-- ============================================================================
-- SECTION 0: CLEAN SLATE (Drops existing objects)
-- ============================================================================

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS trg_fill_patient_mobile ON public.appointments;
DROP FUNCTION IF EXISTS public.handle_new_user();
DROP FUNCTION IF EXISTS public.fill_patient_mobile();

DROP TABLE IF EXISTS public.patient_history CASCADE;
DROP TABLE IF EXISTS public.history_templates CASCADE;
DROP TABLE IF EXISTS public.transactions CASCADE;
DROP TABLE IF EXISTS public.notifications CASCADE;
DROP TABLE IF EXISTS public.shifts CASCADE;
DROP TABLE IF EXISTS public.schedules CASCADE;
DROP TABLE IF EXISTS public.appointments CASCADE;
DROP TABLE IF EXISTS public.patients CASCADE;
DROP TABLE IF EXISTS public.doctors CASCADE;
DROP TABLE IF EXISTS public.admins CASCADE;
DROP TABLE IF EXISTS public.departments CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;


-- ============================================================================
-- SECTION 1: CREATE TABLES
-- ============================================================================

-- 1.1 Users Table (extends Supabase Auth)
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'doctor', 'patient')),
  phone TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 1.2 Departments Table
CREATE TABLE IF NOT EXISTS public.departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 1.3 Doctors Table
CREATE TABLE IF NOT EXISTS public.doctors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  specialty TEXT,
  specialization TEXT,
  consultation_fee DECIMAL(10,2) DEFAULT 500,
  experience TEXT DEFAULT '0 years',
  rating DECIMAL(3,2) DEFAULT 4.5,
  review_count INTEGER DEFAULT 0,
  is_available BOOLEAN DEFAULT true,
  passcode TEXT,
  avatar_url TEXT,
  zoom_link TEXT,
  degree TEXT,
  doctor_code TEXT UNIQUE,
  department_id UUID REFERENCES public.departments(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 1.4 Patients Table
CREATE TABLE IF NOT EXISTS public.patients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  password TEXT NOT NULL,
  age INTEGER,
  sex TEXT CHECK (sex IN ('male', 'female', 'other')),
  weight NUMERIC,
  compliant TEXT,
  status TEXT DEFAULT 'active',
  address TEXT,
  bcode TEXT UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 1.5 Admins Table
CREATE TABLE IF NOT EXISTS public.admins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  passcode TEXT NOT NULL,
  name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 1.6 Appointments Table
CREATE TABLE IF NOT EXISTS public.appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID REFERENCES public.patients(id) ON DELETE CASCADE,
  doctor_id UUID REFERENCES public.doctors(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  time TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'completed', 'cancelled')),
  type TEXT NOT NULL DEFAULT 'in-person' CHECK (type IN ('in-person', 'teleconsult', 'appointment')),
  reason TEXT,
  notes TEXT,
  teleconsult_link TEXT,
  serial_number TEXT,
  patient_mobile TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 1.7 Schedules Table (Rule-Based System)
CREATE TABLE IF NOT EXISTS public.schedules (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  doctor_id UUID REFERENCES public.doctors(id) ON DELETE CASCADE,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  selected_days TEXT[] NOT NULL,
  repeat_weekly BOOLEAN DEFAULT FALSE,
  is_repeating BOOLEAN DEFAULT FALSE,
  start_date DATE,
  end_date DATE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'confirmed', 'cancelled', 'rejected')),
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 1.8 Shifts Table (Legacy)
CREATE TABLE IF NOT EXISTS public.shifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id UUID REFERENCES public.doctors(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 1.9 Notifications Table
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT DEFAULT 'general' CHECK (type IN ('appointment', 'shift', 'teleconsult', 'general', 'walkin')),
  user_type TEXT,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 1.10 Transactions Table
CREATE TABLE IF NOT EXISTS public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  date DATE NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 1.11 Patient History Table
CREATE TABLE IF NOT EXISTS public.patient_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID REFERENCES public.patients(id) ON DELETE CASCADE,
  question_id TEXT NOT NULL,
  disease_name TEXT NOT NULL,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 1.12 History Templates Table
CREATE TABLE IF NOT EXISTS public.history_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  disease_name TEXT NOT NULL,
  questions JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);


-- ============================================================================
-- SECTION 2: INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_appointments_patient ON public.appointments(patient_id);
CREATE INDEX IF NOT EXISTS idx_appointments_doctor ON public.appointments(doctor_id);
CREATE INDEX IF NOT EXISTS idx_appointments_date ON public.appointments(date);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON public.appointments(status);
CREATE INDEX IF NOT EXISTS idx_appointments_type ON public.appointments(type);

CREATE INDEX IF NOT EXISTS idx_schedules_doctor_id ON public.schedules(doctor_id);
CREATE INDEX IF NOT EXISTS idx_schedules_start_date ON public.schedules(start_date);
CREATE INDEX IF NOT EXISTS idx_schedules_end_date ON public.schedules(end_date);

CREATE INDEX IF NOT EXISTS idx_shifts_doctor ON public.shifts(doctor_id);

CREATE INDEX IF NOT EXISTS idx_doctors_is_available ON public.doctors(is_available);
CREATE INDEX IF NOT EXISTS idx_doctors_specialization ON public.doctors(specialization);
CREATE INDEX IF NOT EXISTS idx_doctors_specialty ON public.doctors(specialty);

CREATE INDEX IF NOT EXISTS idx_patients_email ON public.patients(email);
CREATE INDEX IF NOT EXISTS idx_patients_phone ON public.patients(phone);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications(user_id);

CREATE INDEX IF NOT EXISTS idx_transactions_date ON public.transactions(date);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON public.transactions(type);

CREATE INDEX IF NOT EXISTS idx_patient_history_patient ON public.patient_history(patient_id);


-- ============================================================================
-- SECTION 3: ROW LEVEL SECURITY (RLS)
-- ============================================================================

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.doctors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patient_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.history_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;

-- Drop existing policies (clean slate)
DO $$ BEGIN
  EXECUTE (
    SELECT string_agg('DROP POLICY IF EXISTS "' || policyname || '" ON "' || tablename || '";', E'\n')
    FROM pg_policies WHERE schemaname = 'public'
  );
END $$;

-- ==============================
-- USERS POLICIES
-- ==============================
CREATE POLICY "Users view own profile" ON public.users
  FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Admins view all users" ON public.users
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.admins WHERE email = auth.jwt()->>'email')
  );
CREATE POLICY "Users update own profile" ON public.users
  FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Anyone insert users" ON public.users
  FOR INSERT WITH CHECK (true);

-- ==============================
-- DOCTORS POLICIES
-- ==============================
CREATE POLICY "Anyone view doctors" ON public.doctors
  FOR SELECT USING (true);
CREATE POLICY "Doctors update own profile" ON public.doctors
  FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Admins manage doctors" ON public.doctors
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.admins WHERE email = auth.jwt()->>'email')
  );
CREATE POLICY "Anyone insert doctors" ON public.doctors
  FOR INSERT WITH CHECK (true);

-- ==============================
-- PATIENTS POLICIES
-- ==============================
CREATE POLICY "Patients view own profile" ON public.patients
  FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Patients update own profile" ON public.patients
  FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Admins view all patients" ON public.patients
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.admins WHERE email = auth.jwt()->>'email')
  );
CREATE POLICY "Anyone insert patients" ON public.patients
  FOR INSERT WITH CHECK (true);

-- ==============================
-- ADMINS POLICIES
-- ==============================
CREATE POLICY "Admins view admins" ON public.admins
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.admins WHERE email = auth.jwt()->>'email')
  );

-- ==============================
-- APPOINTMENTS POLICIES
-- ==============================
CREATE POLICY "Patients view own appointments" ON public.appointments
  FOR SELECT USING (patient_id IN (SELECT id FROM public.patients));
CREATE POLICY "Patients create appointments" ON public.appointments
  FOR INSERT WITH CHECK (true);
CREATE POLICY "Patients update own appointments" ON public.appointments
  FOR UPDATE USING (patient_id IN (SELECT id FROM public.patients));
CREATE POLICY "Doctors view own appointments" ON public.appointments
  FOR SELECT USING (
    doctor_id IN (SELECT id FROM public.doctors WHERE user_id = auth.uid())
    OR doctor_id IN (SELECT id FROM public.doctors WHERE email = auth.jwt()->>'email')
  );
CREATE POLICY "Doctors update appointments" ON public.appointments
  FOR UPDATE USING (
    doctor_id IN (SELECT id FROM public.doctors WHERE user_id = auth.uid())
  );
CREATE POLICY "Admins view all appointments" ON public.appointments
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.admins WHERE email = auth.jwt()->>'email')
  );
CREATE POLICY "Admins update appointments" ON public.appointments
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.admins WHERE email = auth.jwt()->>'email')
  );

-- ==============================
-- SCHEDULES POLICIES
-- ==============================
CREATE POLICY "Anyone view schedules" ON public.schedules
  FOR SELECT USING (true);
CREATE POLICY "Doctors manage own schedules" ON public.schedules
  FOR ALL USING (
    doctor_id IN (SELECT id FROM public.doctors WHERE user_id = auth.uid())
  );
CREATE POLICY "Admins manage schedules" ON public.schedules
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.admins WHERE email = auth.jwt()->>'email')
  );

-- ==============================
-- SHIFTS POLICIES
-- ==============================
CREATE POLICY "Anyone view shifts" ON public.shifts
  FOR SELECT USING (true);
CREATE POLICY "Admins manage shifts" ON public.shifts
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.admins WHERE email = auth.jwt()->>'email')
  );

-- ==============================
-- NOTIFICATIONS POLICIES
-- ==============================
CREATE POLICY "Users view own notifications" ON public.notifications
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users update own notifications" ON public.notifications
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Anyone insert notifications" ON public.notifications
  FOR INSERT WITH CHECK (true);

-- ==============================
-- TRANSACTIONS POLICIES
-- ==============================
CREATE POLICY "Admins manage transactions" ON public.transactions
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.admins WHERE email = auth.jwt()->>'email')
  );

-- ==============================
-- PATIENT HISTORY POLICIES
-- ==============================
CREATE POLICY "Anyone view patient history" ON public.patient_history
  FOR SELECT USING (true);
CREATE POLICY "Anyone insert patient history" ON public.patient_history
  FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone delete patient history" ON public.patient_history
  FOR DELETE USING (true);

-- ==============================
-- HISTORY TEMPLATES POLICIES
-- ==============================
CREATE POLICY "Anyone view history templates" ON public.history_templates
  FOR SELECT USING (true);

-- ==============================
-- DEPARTMENTS POLICIES
-- ==============================
CREATE POLICY "Anyone view departments" ON public.departments
  FOR SELECT USING (true);


-- ============================================================================
-- SECTION 4: TRIGGERS & FUNCTIONS
-- ============================================================================

-- 4.1 Auto-create user profile on auth signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'role', 'patient')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 4.2 Auto-fill patient_mobile on appointments insert
CREATE OR REPLACE FUNCTION public.fill_patient_mobile()
RETURNS TRIGGER AS $$
BEGIN
  SELECT phone
  INTO NEW.patient_mobile
  FROM public.patients
  WHERE id = NEW.patient_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_fill_patient_mobile
  BEFORE INSERT OR UPDATE ON public.appointments
  FOR EACH ROW
  EXECUTE FUNCTION public.fill_patient_mobile();


-- ============================================================================
-- SECTION 5: SEED DATA
-- ============================================================================

-- 5.1 Default Departments
INSERT INTO public.departments (name, description) VALUES
  ('Medicine', 'General Medicine Department'),
  ('Surgery', 'Surgery Department'),
  ('Gynecology', 'Gynecology and Obstetrics'),
  ('Cardiology', 'Heart and Cardiovascular'),
  ('Pediatrics', 'Child Health Department'),
  ('Orthopedics', 'Bone and Joint Department'),
  ('Neurology', 'Nervous System Department'),
  ('Dermatology', 'Skin Department'),
  ('Ophthalmology', 'Eye Department'),
  ('Others', 'Other Specialties')
ON CONFLICT (name) DO NOTHING;

-- 5.2 Default Admin
INSERT INTO public.admins (email, passcode, name) VALUES
  ('admin@clinic.com', 'admin123', 'System Admin')
ON CONFLICT (email) DO NOTHING;

-- 5.3 Sample Doctors
INSERT INTO public.doctors (name, email, phone, specialty, specialization, consultation_fee, experience, rating, review_count, is_available, passcode, doctor_code, degree) VALUES
  ('Dr. Rahim Ahmed', 'dr.rahim@clinic.com', '01712345601', 'Medicine', 'Medicine Specialist', 500, '15 years', 4.8, 156, true, '12345', 'DR01', 'MBBS, MD (Medicine)'),
  ('Dr. Fariha Sultana', 'dr.fariha@clinic.com', '01712345602', 'Gynecology', 'Gynecology Specialist', 600, '12 years', 4.9, 203, true, '23456', 'DR02', 'MBBS, FCPS (OBGYN)'),
  ('Dr. Mohammad Karim', 'dr.karim@clinic.com', '01712345603', 'Ophthalmology', 'Eye Specialist', 450, '10 years', 4.7, 98, true, '34567', 'DR03', 'MBBS, DO (Ophthalmology)'),
  ('Dr. Salma Khatun', 'dr.salma@clinic.com', '01712345604', 'Pediatrics', 'Child Specialist', 400, '8 years', 4.9, 287, true, '45678', 'DR04', 'MBBS, DCH (Pediatrics)'),
  ('Dr. Abul Hasan', 'dr.hasan@clinic.com', '01712345605', 'Cardiology', 'Heart Specialist', 700, '18 years', 4.8, 145, true, '56789', 'DR05', 'MBBS, MD (Cardiology)'),
  ('Dr. Nurjahan Begum', 'dr.nurjahan@clinic.com', '01712345606', 'Dermatology', 'Skin Specialist', 550, '11 years', 4.6, 112, true, '67890', 'DR06', 'MBBS, DDV (Dermatology)'),
  ('Dr. Md. Rafiq', 'dr.rafiq@clinic.com', '01712345607', 'Neurology', 'Neuro Specialist', 800, '20 years', 4.9, 178, true, '78901', 'DR07', 'MBBS, MD (Neurology)'),
  ('Dr. Sabina Yasmin', 'dr.sabina@clinic.com', '01712345608', 'Orthopedics', 'Bone Specialist', 650, '9 years', 4.7, 89, true, '89012', 'DR08', 'MBBS, MS (Orthopedics)')
ON CONFLICT DO NOTHING;

-- 5.4 Sample Patients
INSERT INTO public.patients (name, email, phone, password, age, sex, weight, status) VALUES
  ('Md. Rabiul Islam', 'rubel@example.com', '01812345601', 'patient123', 35, 'male', 72, 'active'),
  ('Sabina Akhter', 'sabina@example.com', '01812345602', 'patient123', 28, 'female', 58, 'active'),
  ('Abdur Rahim', 'rahim@example.com', '01812345603', 'patient123', 45, 'male', 80, 'active'),
  ('Fatema Khatun', 'fatema@example.com', '01812345604', 'patient123', 32, 'female', 62, 'active'),
  ('Md. Kamrul', 'kamrul@example.com', '01812345605', 'patient123', 50, 'male', 75, 'active'),
  ('Jahanara Begum', 'jahana@example.com', '01812345606', 'patient123', 40, 'female', 65, 'active'),
  ('Abul Bari', 'abul@example.com', '01812345607', 'patient123', 55, 'male', 78, 'active'),
  ('Mina Sultana', 'mina@example.com', '01812345608', 'patient123', 30, 'female', 55, 'active')
ON CONFLICT DO NOTHING;

-- 5.5 Sample Schedules (Rule-Based)
INSERT INTO public.schedules (doctor_id, start_time, end_time, selected_days, repeat_weekly, is_repeating, start_date, status)
SELECT d.id, '09:00', '14:00',
  ARRAY['সোমবার', 'বুধবার', 'শুক্রবার'],
  TRUE, TRUE, CURRENT_DATE, 'active'
FROM public.doctors d WHERE d.name LIKE '%Rahim%' LIMIT 1;

INSERT INTO public.schedules (doctor_id, start_time, end_time, selected_days, repeat_weekly, is_repeating, start_date, status)
SELECT d.id, '10:00', '16:00',
  ARRAY['রবিবার', 'মঙ্গলবার', 'বৃহস্পতিবার'],
  TRUE, TRUE, CURRENT_DATE, 'active'
FROM public.doctors d WHERE d.name LIKE '%Fariha%' LIMIT 1;

INSERT INTO public.schedules (doctor_id, start_time, end_time, selected_days, repeat_weekly, is_repeating, start_date, status)
SELECT d.id, '08:00', '12:00',
  ARRAY['সোমবার', 'বৃহস্পতিবার', 'শনিবার'],
  TRUE, TRUE, CURRENT_DATE, 'active'
FROM public.doctors d WHERE d.name LIKE '%Karim%' LIMIT 1;

INSERT INTO public.schedules (doctor_id, start_time, end_time, selected_days, repeat_weekly, is_repeating, start_date, status)
SELECT d.id, '09:00', '13:00',
  ARRAY['রবিবার', 'বুধবার', 'শুক্রবার'],
  TRUE, TRUE, CURRENT_DATE, 'active'
FROM public.doctors d WHERE d.name LIKE '%Salma%' LIMIT 1;

INSERT INTO public.schedules (doctor_id, start_time, end_time, selected_days, repeat_weekly, is_repeating, start_date, status)
SELECT d.id, '11:00', '17:00',
  ARRAY['মঙ্গলবার', 'বুধবার', 'বৃহস্পতিবার'],
  TRUE, TRUE, CURRENT_DATE, 'active'
FROM public.doctors d WHERE d.name LIKE '%Hasan%' LIMIT 1;

INSERT INTO public.schedules (doctor_id, start_time, end_time, selected_days, repeat_weekly, is_repeating, start_date, status)
SELECT d.id, '10:00', '15:00',
  ARRAY['সোমবার', 'মঙ্গলবার', 'শনিবার'],
  TRUE, TRUE, CURRENT_DATE, 'active'
FROM public.doctors d WHERE d.name LIKE '%Nurjahan%' LIMIT 1;

INSERT INTO public.schedules (doctor_id, start_time, end_time, selected_days, repeat_weekly, is_repeating, start_date, status)
SELECT d.id, '09:00', '14:00',
  ARRAY['রবিবার', 'মঙ্গলবার', 'বৃহস্পতিবার'],
  TRUE, TRUE, CURRENT_DATE, 'active'
FROM public.doctors d WHERE d.name LIKE '%Rafiq%' LIMIT 1;

INSERT INTO public.schedules (doctor_id, start_time, end_time, selected_days, repeat_weekly, is_repeating, start_date, status)
SELECT d.id, '08:00', '13:00',
  ARRAY['সোমবার', 'বুধবার', 'শনিবার'],
  TRUE, TRUE, CURRENT_DATE, 'active'
FROM public.doctors d WHERE d.name LIKE '%Sabina%' LIMIT 1;

-- 5.6 Sample Appointments
INSERT INTO public.appointments (patient_id, doctor_id, date, time, type, status, reason)
SELECT p.id, d.id, CURRENT_DATE, '09:30', 'in-person', 'pending', 'First visit - fever'
FROM public.patients p, public.doctors d
WHERE p.name LIKE '%Rabiul%' AND d.name LIKE '%Rahim%'
LIMIT 1;

INSERT INTO public.appointments (patient_id, doctor_id, date, time, type, status, reason)
SELECT p.id, d.id, CURRENT_DATE, '10:00', 'teleconsult', 'pending', 'Follow-up consultation'
FROM public.patients p, public.doctors d
WHERE p.name LIKE '%Sabina%' AND d.name LIKE '%Fariha%'
LIMIT 1;

INSERT INTO public.appointments (patient_id, doctor_id, date, time, type, status, reason, serial_number)
SELECT p.id, d.id, CURRENT_DATE, '10:30', 'in-person', 'confirmed', 'Heart checkup', 'DR01-001A'
FROM public.patients p, public.doctors d
WHERE p.name LIKE '%Kamrul%' AND d.name LIKE '%Hasan%'
LIMIT 1;

INSERT INTO public.appointments (patient_id, doctor_id, date, time, type, status, reason, serial_number)
SELECT p.id, d.id, CURRENT_DATE, '14:00', 'teleconsult', 'confirmed', 'Eye examination', 'DR03-001T'
FROM public.patients p, public.doctors d
WHERE p.name LIKE '%Jahanara%' AND d.name LIKE '%Karim%'
LIMIT 1;

INSERT INTO public.appointments (patient_id, doctor_id, date, time, type, status, reason, serial_number)
SELECT p.id, d.id, CURRENT_DATE - 1, '09:00', 'in-person', 'completed', 'Routine checkup', 'DR01-002A'
FROM public.patients p, public.doctors d
WHERE p.name LIKE '%Abul Bari%' AND d.name LIKE '%Rahim%'
LIMIT 1;

INSERT INTO public.appointments (patient_id, doctor_id, date, time, type, status, reason, serial_number)
SELECT p.id, d.id, CURRENT_DATE - 1, '11:30', 'in-person', 'completed', 'Bone problem', 'DR08-001A'
FROM public.patients p, public.doctors d
WHERE p.name LIKE '%Mina%' AND d.name LIKE '%Sabina%'
LIMIT 1;

INSERT INTO public.appointments (patient_id, doctor_id, date, time, type, status, reason)
SELECT p.id, d.id, CURRENT_DATE, '15:00', 'in-person', 'cancelled', 'Patient informed unable to come'
FROM public.patients p, public.doctors d
WHERE p.name LIKE '%Fatema%' AND d.name LIKE '%Nurjahan%'
LIMIT 1;

INSERT INTO public.appointments (patient_id, doctor_id, date, time, type, status, reason)
SELECT p.id, d.id, CURRENT_DATE + 1, '16:00', 'teleconsult', 'pending', 'Video call consultation'
FROM public.patients p, public.doctors d
WHERE p.name LIKE '%Rabiul%' AND d.name LIKE '%Rafiq%'
LIMIT 1;

INSERT INTO public.appointments (patient_id, doctor_id, date, time, type, status, reason)
SELECT p.id, d.id, CURRENT_DATE + 2, '14:30', 'teleconsult', 'pending', 'Follow-up video call'
FROM public.patients p, public.doctors d
WHERE p.name LIKE '%Sabina%' AND d.name LIKE '%Karim%'
LIMIT 1;

-- 5.7 History Templates
INSERT INTO public.history_templates (disease_name, questions) VALUES
  ('Diabetes', '[{"text": "What is your current fasting sugar level?", "type": "text"}, {"text": "What is your current HbA1c level?", "type": "text"}, {"text": "When did you last check?", "type": "date"}, {"text": "Are you taking insulin?", "type": "multiple_choice", "options": ["Yes", "No"]}, {"text": "Rate your medication adherence", "type": "scale", "options": ["1", "2", "3", "4", "5"]}]'),
  ('High Blood Pressure', '[{"text": "What is your current BP reading?", "type": "text"}, {"text": "Do you take medication regularly?", "type": "multiple_choice", "options": ["Yes", "No", "Sometimes"]}, {"text": "Any side effects from medication?", "type": "paragraph"}, {"text": "How often do you check BP?", "type": "dropdown", "options": ["Daily", "Weekly", "Monthly", "Rarely"]}]'),
  ('Heart Disease', '[{"text": "Are you experiencing chest pain?", "type": "multiple_choice", "options": ["Yes", "No", "Sometimes"]}, {"text": "Do you have difficulty breathing?", "type": "multiple_choice", "options": ["Yes", "No"]}, {"text": "Describe your symptoms in detail", "type": "paragraph"}, {"text": "Have you had any heart surgery before?", "type": "multiple_choice", "options": ["Yes", "No"]}, {"text": "Upload your ECG report", "type": "file_upload"}]'),
  ('General Checkup', '[{"text": "What is your main complaint?", "type": "paragraph"}, {"text": "How long have you had these symptoms?", "type": "text"}, {"text": "Do you have any allergies?", "type": "multiple_choice", "options": ["Yes", "No"]}, {"text": "Are you on any medication?", "type": "paragraph"}, {"text": "Date of last checkup", "type": "date"}]')
ON CONFLICT DO NOTHING;


-- ============================================================================
-- SECTION 6: VERIFICATION
-- ============================================================================

-- Check all tables
SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;

-- Check RLS is enabled
SELECT relname, relrowsecurity FROM pg_class
WHERE relname IN ('users', 'doctors', 'patients', 'admins', 'appointments', 'schedules', 'shifts', 'notifications', 'transactions', 'patient_history', 'history_templates', 'departments')
ORDER BY relname;

-- Check policies
SELECT schemaname, tablename, policyname FROM pg_policies WHERE schemaname = 'public' ORDER BY tablename;

-- Count seed data
SELECT 'admins' as tbl, COUNT(*) FROM public.admins
UNION ALL SELECT 'doctors', COUNT(*) FROM public.doctors
UNION ALL SELECT 'patients', COUNT(*) FROM public.patients
UNION ALL SELECT 'appointments', COUNT(*) FROM public.appointments
UNION ALL SELECT 'schedules', COUNT(*) FROM public.schedules
UNION ALL SELECT 'departments', COUNT(*) FROM public.departments
UNION ALL SELECT 'history_templates', COUNT(*) FROM public.history_templates;


-- ============================================================================
-- DONE!
-- ============================================================================

/*
===============================================================================
 LOGIN CREDENTIALS (after seeding):
===============================================================================

 Admin:
   - Email: admin@clinic.com
   - Passcode: admin123

 Doctors (use passcode to login):
   - Dr. Rahim Ahmed    -> passcode: 12345
   - Dr. Fariha Sultana -> passcode: 23456
   - Dr. Mohammad Karim -> passcode: 34567
   - Dr. Salma Khatun   -> passcode: 45678
   - Dr. Abul Hasan     -> passcode: 56789
   - Dr. Nurjahan Begum -> passcode: 67890
   - Dr. Md. Rafiq      -> passcode: 78901
   - Dr. Sabina Yasmin  -> passcode: 89012

 Patients (use email + password to login):
   - rubel@example.com     / patient123
   - sabina@example.com    / patient123
   - rahim@example.com     / patient123
   - fatema@example.com    / patient123
   - kamrul@example.com    / patient123
   - jahana@example.com    / patient123
   - abul@example.com      / patient123
   - mina@example.com      / patient123

===============================================================================
 Target: MAIN Supabase Project
   URL:  https://lbuveiutdjwqzebmelob.supabase.co
   Project Ref: lbuveiutdjwqzebmelob

 .env.local variables for MAIN:
   NEXT_PUBLIC_SUPABASE_URLMAIN=https://lbuveiutdjwqzebmelob.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEYMAIN=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   SUPABASE_SERVICE_ROLE_KEYMAIN=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
===============================================================================
*/
