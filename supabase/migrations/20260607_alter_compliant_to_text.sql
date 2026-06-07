-- Migration: Change patients.comp!liant column from boolean to text
-- Date: 2026-06-07
-- Reason: Store chief complaint as text instead of boolean

ALTER TABLE public.patients 
  ALTER COLUMN compliant TYPE TEXT;
