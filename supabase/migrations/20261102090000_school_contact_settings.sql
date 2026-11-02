-- Store official RESA customer-care and admissions contact numbers in School Settings.
-- Additive only: preserves all existing school profile and account data.
alter table public.school_settings
  add column if not exists whatsapp_phone text,
  add column if not exists admissions_phone text;
