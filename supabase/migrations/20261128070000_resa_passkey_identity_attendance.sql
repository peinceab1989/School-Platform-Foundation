-- RESA passkey credentials and cross-role verified attendance.
-- Passkeys store public keys only; no fingerprint, face image or biometric template is collected.
-- Client roles cannot read credential/challenge records or write attendance events directly.

create table if not exists public.resa_passkey_credentials (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  credential_id text not null unique,
  public_key text not null,
  signature_counter bigint not null default 0 check (signature_counter >= 0),
  transports text[] not null default '{}'::text[],
  device_type text not null default 'singleDevice'
    check (device_type in ('singleDevice', 'multiDevice')),
  backed_up boolean not null default false,
  label text not null default 'My device'
    check (length(trim(label)) between 1 and 80),
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);

create index if not exists resa_passkey_credentials_user_active_idx
  on public.resa_passkey_credentials (user_id, created_at desc)
  where revoked_at is null;

create table if not exists public.resa_passkey_challenges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  purpose text not null
    check (purpose in ('registration', 'authentication', 'attendance')),
  challenge text not null,
  school_id uuid references public.schools(id) on delete cascade,
  person_type text
    check (person_type is null or person_type in ('student', 'teacher', 'staff', 'parent', 'admin', 'proprietor')),
  person_id uuid,
  activity text
    check (activity is null or activity in ('school_arrival', 'school_departure', 'work_arrival', 'work_departure', 'school_visit', 'school_visit_exit')),
  event_type text
    check (event_type is null or event_type in ('check_in', 'check_out')),
  request_ip_hash text,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists resa_passkey_challenges_expiry_idx
  on public.resa_passkey_challenges (expires_at);
create index if not exists resa_passkey_challenges_user_recent_idx
  on public.resa_passkey_challenges (user_id, purpose, created_at desc);
create index if not exists resa_passkey_challenges_ip_recent_idx
  on public.resa_passkey_challenges (request_ip_hash, purpose, created_at desc)
  where request_ip_hash is not null;

create table if not exists public.resa_identity_attendance_events (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete restrict,
  person_type text not null
    check (person_type in ('student', 'teacher', 'staff', 'parent', 'admin', 'proprietor')),
  person_id uuid,
  activity text not null
    check (activity in ('school_arrival', 'school_departure', 'work_arrival', 'work_departure', 'school_visit', 'school_visit_exit')),
  event_type text not null check (event_type in ('check_in', 'check_out')),
  attendance_date date not null,
  event_time timestamptz not null default now(),
  verification_method text not null default 'passkey'
    check (verification_method = 'passkey'),
  credential_id text not null references public.resa_passkey_credentials(credential_id) on delete restrict,
  device_label text,
  station_id uuid references public.biometric_devices(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint resa_identity_attendance_one_action_per_day
    unique (school_id, user_id, activity, attendance_date, event_type)
);

create index if not exists resa_identity_attendance_school_recent_idx
  on public.resa_identity_attendance_events (school_id, event_time desc);
create index if not exists resa_identity_attendance_user_recent_idx
  on public.resa_identity_attendance_events (user_id, school_id, event_time desc);

alter table public.resa_passkey_credentials enable row level security;
alter table public.resa_passkey_challenges enable row level security;
alter table public.resa_identity_attendance_events enable row level security;

revoke all on table public.resa_passkey_credentials from anon, authenticated;
revoke all on table public.resa_passkey_challenges from anon, authenticated;
grant all on table public.resa_passkey_credentials to service_role;
grant all on table public.resa_passkey_challenges to service_role;

revoke all on table public.resa_identity_attendance_events from anon, authenticated;
grant select on table public.resa_identity_attendance_events to authenticated;
grant all on table public.resa_identity_attendance_events to service_role;

drop policy if exists "Users read own passkey attendance" on public.resa_identity_attendance_events;
create policy "Users read own passkey attendance"
  on public.resa_identity_attendance_events
  for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "School admins read passkey attendance" on public.resa_identity_attendance_events;
create policy "School admins read passkey attendance"
  on public.resa_identity_attendance_events
  for select to authenticated
  using (public.has_school_role(school_id, array['admin']::public.school_role[]));

drop policy if exists "School proprietors read passkey attendance" on public.resa_identity_attendance_events;
create policy "School proprietors read passkey attendance"
  on public.resa_identity_attendance_events
  for select to authenticated
  using (
    exists (
      select 1
      from public.school_payment_gateway_proprietors proprietor
      where proprietor.school_id = resa_identity_attendance_events.school_id
        and proprietor.user_id = (select auth.uid())
    )
  );

comment on table public.resa_passkey_credentials is
  'WebAuthn passkey public credentials. No biometric templates or fingerprint/face images are stored.';
comment on table public.resa_passkey_challenges is
  'Short-lived, single-use server-side WebAuthn challenges. Access is service-role only.';
comment on table public.resa_identity_attendance_events is
  'Server-verified passkey attendance events for students, teachers, staff, parents, administrators and proprietors.';
