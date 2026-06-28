-- ============================================================================
-- CLINIC CONNECT - COMPLETE SUPABASE SCHEMA (NO SEED DATA)
-- Paste this entire file into the Supabase SQL Editor and run it.
-- Target: MAIN Supabase Project (lbuveiutdjwqzebmelob.supabase.co)
-- ============================================================================

-- ============================================================================
-- SECTION 0: CLEAN SLATE
-- ============================================================================

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

CREATE TABLE IF NOT EXISTS public.departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

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

CREATE TABLE IF NOT EXISTS public.admins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  passcode TEXT NOT NULL,
  name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

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

CREATE TABLE IF NOT EXISTS public.shifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id UUID REFERENCES public.doctors(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

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

CREATE TABLE IF NOT EXISTS public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  date DATE NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.patient_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID REFERENCES public.patients(id) ON DELETE CASCADE,
  question_id TEXT NOT NULL,
  disease_name TEXT NOT NULL,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

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
-- SECTION 3: ROW LEVEL SECURITY
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

-- Drop existing policies (safe for first run)
DO $$ BEGIN
  EXECUTE COALESCE(
    (SELECT string_agg('DROP POLICY IF EXISTS "' || policyname || '" ON "' || tablename || '";', E'\n')
     FROM pg_policies WHERE schemaname = 'public'),
    'SELECT 1'
  );
END $$;

-- USERS POLICIES
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

-- DOCTORS POLICIES
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

-- PATIENTS POLICIES
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

-- ADMINS POLICIES
CREATE POLICY "Admins view admins" ON public.admins
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.admins WHERE email = auth.jwt()->>'email')
  );

-- APPOINTMENTS POLICIES
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

-- SCHEDULES POLICIES
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

-- SHIFTS POLICIES
CREATE POLICY "Anyone view shifts" ON public.shifts
  FOR SELECT USING (true);
CREATE POLICY "Admins manage shifts" ON public.shifts
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.admins WHERE email = auth.jwt()->>'email')
  );

-- NOTIFICATIONS POLICIES
CREATE POLICY "Users view own notifications" ON public.notifications
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users update own notifications" ON public.notifications
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Anyone insert notifications" ON public.notifications
  FOR INSERT WITH CHECK (true);

-- TRANSACTIONS POLICIES
CREATE POLICY "Admins manage transactions" ON public.transactions
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.admins WHERE email = auth.jwt()->>'email')
  );

-- PATIENT HISTORY POLICIES
CREATE POLICY "Anyone view patient history" ON public.patient_history
  FOR SELECT USING (true);
CREATE POLICY "Anyone insert patient history" ON public.patient_history
  FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone delete patient history" ON public.patient_history
  FOR DELETE USING (true);

-- HISTORY TEMPLATES POLICIES
CREATE POLICY "Anyone view history templates" ON public.history_templates
  FOR SELECT USING (true);

-- DEPARTMENTS POLICIES
CREATE POLICY "Anyone view departments" ON public.departments
  FOR SELECT USING (true);

-- ============================================================================
-- SECTION 4: TRIGGERS & FUNCTIONS
-- ============================================================================

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

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

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

DROP TRIGGER IF EXISTS trg_fill_patient_mobile ON public.appointments;
CREATE TRIGGER trg_fill_patient_mobile
  BEFORE INSERT OR UPDATE ON public.appointments
  FOR EACH ROW
  EXECUTE FUNCTION public.fill_patient_mobile();

-- ============================================================================
-- DONE!
-- ============================================================================
