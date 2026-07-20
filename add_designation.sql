-- Run this in Supabase SQL Editor to add designation column
ALTER TABLE doctors ADD COLUMN IF NOT EXISTS designation TEXT;

-- Set the designation for Dr. Rafi
UPDATE doctors SET designation = 'Chief Consultant (Orthopedics & Sports Medicine)' WHERE id = 'ffd0ae89-ce65-43ec-94d6-561363921506';
