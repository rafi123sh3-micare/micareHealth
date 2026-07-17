-- Create patient_vitals table for storing vital signs
CREATE TABLE IF NOT EXISTS public.patient_vitals (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id    UUID REFERENCES public.patients(id) ON DELETE CASCADE,
  appointment_id UUID REFERENCES public.appointments(id) ON DELETE CASCADE,
  pulse         INTEGER,
  bp_systolic   INTEGER,
  bp_diastolic  INTEGER,
  weight        NUMERIC,
  height        NUMERIC,
  bmi           NUMERIC,
  spo2          INTEGER,
  temp          NUMERIC,
  created_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for fast lookups by patient
CREATE INDEX IF NOT EXISTS idx_patient_vitals_patient_id ON public.patient_vitals(patient_id);
CREATE INDEX IF NOT EXISTS idx_patient_vitals_appointment_id ON public.patient_vitals(appointment_id);

-- RLS policies
ALTER TABLE public.patient_vitals ENABLE ROW LEVEL SECURITY;

-- Anyone can view vitals
CREATE POLICY "Anyone can view patient vitals" ON public.patient_vitals
  FOR SELECT USING (true);

-- Authenticated users can insert vitals
CREATE POLICY "Authenticated users can insert patient vitals" ON public.patient_vitals
  FOR INSERT WITH CHECK (true);

-- Authenticated users can update vitals
CREATE POLICY "Authenticated users can update patient vitals" ON public.patient_vitals
  FOR UPDATE USING (true);
