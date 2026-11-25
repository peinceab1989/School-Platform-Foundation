-- Remove Supabase default broad table grants from public API roles.
-- Authenticated users retain only CRUD privileges, which remain constrained by RLS.
revoke all privileges on table public.staff_appointments from anon, authenticated;
revoke all privileges on table public.staff_responsibility_assignments from anon, authenticated;
grant select, insert, update, delete on table public.staff_appointments to authenticated;
grant select, insert, update, delete on table public.staff_responsibility_assignments to authenticated;
