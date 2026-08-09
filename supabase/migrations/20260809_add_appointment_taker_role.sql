-- Add role column to the admins table to support the "Appointment Taker" role.
-- Values: 'admin' (default) | 'appointment_taker'
ALTER TABLE public.admins ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'admin';

-- Example: create an Appointment Taker account (change email/passcode first):
-- INSERT INTO public.admins (email, passcode, name, role)
-- VALUES ('taker@clinicconnect.local', '1234', 'Appointment Taker', 'appointment_taker');
