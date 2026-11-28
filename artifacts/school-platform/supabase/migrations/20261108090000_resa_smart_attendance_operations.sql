-- RESA Smart Attendance operational records.
-- Additive only: preserves existing student_attendance, staff_attendance,
-- biometric_devices and biometric_attendance_events data.

create table if not exists public.attendance_qr_credentials (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  person_type text not null check (person_type in ('student','staff')),
  student_id uuid references public.students(id) on delete cascade,
  staff_id uuid references public.staff(id) on delete cascade,
  token_hash text not null unique check (length(token_hash) = 64),
  is_active boolean not null default true,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  constraint attendance_qr_exactly_one_person check (
    (person_type = 'student' and student_id is not null and staff_id is null)
    or (person_type = 'staff' and staff_id is not null and student_id is null)
  )
);

create index if not exists attendance_qr_school_active_idx
  on public.attendance_qr_credentials(school_id, is_active);

create table if not exists public.attendance_manual_audit (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  person_type text not null check (person_type in ('student','staff')),
  student_id uuid references public.students(id) on delete restrict,
  staff_id uuid references public.staff(id) on delete restrict,
  action text not null check (action in ('check_in','check_out','status_override')),
  reason text not null check (length(trim(reason)) >= 5),
  previous_value jsonb,
  new_value jsonb not null,
  recorded_by uuid not null default auth.uid() references auth.users(id),
  recorded_at timestamptz not null default now(),
  constraint attendance_manual_exactly_one_person check (
    (person_type = 'student' and student_id is not null and staff_id is null)
    or (person_type = 'staff' and staff_id is not null and student_id is null)
  )
);

create index if not exists attendance_manual_audit_school_date_idx
  on public.attendance_manual_audit(school_id, recorded_at desc);

create table if not exists public.attendance_checkpoint_alerts (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  attendance_date date not null,
  person_type text not null check (person_type in ('student','staff')),
  student_id uuid references public.students(id) on delete cascade,
  staff_id uuid references public.staff(id) on delete cascade,
  alert_status text not null default 'pending'
    check (alert_status in ('pending','acknowledged','resolved')),
  first_detected_at timestamptz not null default now(),
  last_reminded_at timestamptz,
  reminder_count integer not null default 0 check (reminder_count >= 0),
  acknowledged_by uuid references auth.users(id),
  acknowledged_at timestamptz,
  acknowledgement_note text,
  constraint attendance_checkpoint_exactly_one_person check (
    (person_type = 'student' and student_id is not null and staff_id is null)
    or (person_type = 'staff' and staff_id is not null and student_id is null)
  ),
  constraint attendance_checkpoint_one_per_person_day unique
    (school_id, attendance_date, person_type, student_id, staff_id)
);

create index if not exists attendance_checkpoint_pending_idx
  on public.attendance_checkpoint_alerts(school_id, attendance_date, alert_status);

alter table public.attendance_qr_credentials enable row level security;
alter table public.attendance_manual_audit enable row level security;
alter table public.attendance_checkpoint_alerts enable row level security;

grant select, insert, update on public.attendance_qr_credentials to authenticated;
grant select, insert on public.attendance_manual_audit to authenticated;
grant select, insert, update on public.attendance_checkpoint_alerts to authenticated;

drop policy if exists "attendance admins manage QR credentials" on public.attendance_qr_credentials;
create policy "attendance admins manage QR credentials"
  on public.attendance_qr_credentials for all to authenticated
  using (public.has_school_role(school_id, array['admin']::public.school_role[]))
  with check (public.has_school_role(school_id, array['admin']::public.school_role[]));

drop policy if exists "attendance admins read manual audit" on public.attendance_manual_audit;
create policy "attendance admins read manual audit"
  on public.attendance_manual_audit for select to authenticated
  using (public.has_school_role(school_id, array['admin']::public.school_role[]));

drop policy if exists "attendance admins append manual audit" on public.attendance_manual_audit;
create policy "attendance admins append manual audit"
  on public.attendance_manual_audit for insert to authenticated
  with check (
    recorded_by = (select auth.uid())
    and public.has_school_role(school_id, array['admin']::public.school_role[])
  );

drop policy if exists "attendance admins manage checkpoint alerts" on public.attendance_checkpoint_alerts;
create policy "attendance admins manage checkpoint alerts"
  on public.attendance_checkpoint_alerts for all to authenticated
  using (public.has_school_role(school_id, array['admin']::public.school_role[]))
  with check (public.has_school_role(school_id, array['admin']::public.school_role[]));

-- The audit table is append-only for authenticated clients.
revoke update, delete, truncate on public.attendance_manual_audit from authenticated;
