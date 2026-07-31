-- Add paid and refunded columns to appointments table
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS paid INTEGER DEFAULT 0;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS refunded INTEGER DEFAULT 0;
-- Who booked the appointment (receptionist name)
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS booked_by TEXT;
