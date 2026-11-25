-- RESA staff appointments and delegated responsibilities.
-- Additive only: does not change existing staff, membership, class, or subject assignments.
create table if not exists public.staff_appointments (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  staff_id uuid not null references public.staff(id) on delete cascade,
  appointment_title text not null check (length(trim(appointment_title)) > 0),
  department text,
  start_date date not null,
  end_date date,
  reference_number text,
  notes text,
  status text not null default 'active' check (status in ('active','ended','revoked')),
  issued_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint staff_appointments_date_order check (end_date is null or end_date >= start_date)
);

create table if not exists public.staff_responsibility_assignments (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  staff_id uuid not null references public.staff(id) on delete cascade,
  title text not null check (length(trim(title)) > 0),
  description text,
  starts_on date not null,
  ends_on date,
  status text not null default 'active' check (status in ('active','completed','revoked')),
  assigned_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint staff_responsibility_date_order check (ends_on is null or ends_on >= starts_on)
);

create index if not exists staff_appointments_school_staff_start_idx
  on public.staff_appointments (school_id, staff_id, start_date desc);
create index if not exists staff_responsibility_school_staff_start_idx
  on public.staff_responsibility_assignments (school_id, staff_id, starts_on desc);

alter table public.staff_appointments enable row level security;
alter table public.staff_responsibility_assignments enable row level security;

grant select, insert, update, delete on public.staff_appointments to authenticated;
grant select, insert, update, delete on public.staff_responsibility_assignments to authenticated;

create policy staff_appointments_read_admin_or_owner
on public.staff_appointments for select to authenticated
using (
  public.has_school_role(school_id, array['admin']::public.school_role[])
  or exists (
    select 1 from public.staff s
    left join public.people p on p.id = s.person_id and p.school_id = s.school_id
    where s.id = staff_appointments.staff_id
      and s.school_id = staff_appointments.school_id
      and (s.user_id = (select auth.uid()) or p.user_id = (select auth.uid()))
  )
);
create policy staff_appointments_admin_insert
on public.staff_appointments for insert to authenticated
with check (
  public.has_school_role(school_id, array['admin']::public.school_role[])
  and exists (select 1 from public.staff s where s.id = staff_appointments.staff_id and s.school_id = staff_appointments.school_id)
);
create policy staff_appointments_admin_update
on public.staff_appointments for update to authenticated
using (public.has_school_role(school_id, array['admin']::public.school_role[]))
with check (
  public.has_school_role(school_id, array['admin']::public.school_role[])
  and exists (select 1 from public.staff s where s.id = staff_appointments.staff_id and s.school_id = staff_appointments.school_id)
);
create policy staff_appointments_admin_delete
on public.staff_appointments for delete to authenticated
using (public.has_school_role(school_id, array['admin']::public.school_role[]));

create policy staff_responsibilities_read_admin_or_owner
on public.staff_responsibility_assignments for select to authenticated
using (
  public.has_school_role(school_id, array['admin']::public.school_role[])
  or exists (
    select 1 from public.staff s
    left join public.people p on p.id = s.person_id and p.school_id = s.school_id
    where s.id = staff_responsibility_assignments.staff_id
      and s.school_id = staff_responsibility_assignments.school_id
      and (s.user_id = (select auth.uid()) or p.user_id = (select auth.uid()))
  )
);
create policy staff_responsibilities_admin_insert
on public.staff_responsibility_assignments for insert to authenticated
with check (
  public.has_school_role(school_id, array['admin']::public.school_role[])
  and exists (select 1 from public.staff s where s.id = staff_responsibility_assignments.staff_id and s.school_id = staff_responsibility_assignments.school_id)
);
create policy staff_responsibilities_admin_update
on public.staff_responsibility_assignments for update to authenticated
using (public.has_school_role(school_id, array['admin']::public.school_role[]))
with check (
  public.has_school_role(school_id, array['admin']::public.school_role[])
  and exists (select 1 from public.staff s where s.id = staff_responsibility_assignments.staff_id and s.school_id = staff_responsibility_assignments.school_id)
);
create policy staff_responsibilities_admin_delete
on public.staff_responsibility_assignments for delete to authenticated
using (public.has_school_role(school_id, array['admin']::public.school_role[]));

comment on table public.staff_appointments is 'RESA formal staff appointments and effective dates; visible to school administrators and the appointed staff member.';
comment on table public.staff_responsibility_assignments is 'RESA delegated duties and responsibility assignments; these do not grant additional portal roles or bypass existing permissions.';
