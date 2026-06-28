-- Add fee_type column to appointments table
ALTER TABLE public.appointments 
ADD COLUMN IF NOT EXISTS fee_type TEXT DEFAULT 'new';

COMMENT ON COLUMN public.appointments.fee_type IS 'Patient fee type: new (1000), follow_up (700), report (0)';

-- Add advance column to appointments table
ALTER TABLE public.appointments
ADD COLUMN IF NOT EXISTS advance NUMERIC DEFAULT 0;

COMMENT ON COLUMN public.appointments.advance IS 'Advance payment amount collected during walk-in';
