-- Adds the billing branch to appointments.
--
-- The branch is captured from the account that creates the appointment
-- (miadmcu@gmail.com / miapcu@gmail.com => 'cumilla', everyone else => 'shyamoli').
-- Consultation fees are derived from it (cumilla: new 700 / follow up 500,
-- shyamoli: new 1000 / follow up 700), so every viewer of the appointment sees
-- the same amounts regardless of which account they are signed in with.
--
-- Existing rows default to 'shyamoli' (the original fee structure).

alter table public.appointments
  add column if not exists branch text not null default 'shyamoli';

comment on column public.appointments.branch is
  'Billing branch that created the appointment. Controls consultation fees.';
