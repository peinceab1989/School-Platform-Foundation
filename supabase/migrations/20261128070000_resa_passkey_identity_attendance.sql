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


-- The Edge Function verifies the WebAuthn signature first, then invokes this
-- service-role-only transaction to update the existing student/staff registers,
-- write the universal identity event, and notify linked parents.
create or replace function public.resa_record_passkey_attendance(
  p_school_id uuid,
  p_user_id uuid,
  p_person_type text,
  p_person_id uuid,
  p_activity text,
  p_event_type text,
  p_credential_id text,
  p_device_label text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_today date := (now() at time zone 'Africa/Lagos')::date;
  v_local_time time := (now() at time zone 'Africa/Lagos')::time;
  v_now timestamptz := now();
  v_session_id uuid;
  v_class_id uuid;
  v_attendance_id uuid;
  v_event_id uuid;
  v_person_name text;
  v_staff_category text;
begin
  if current_setting('request.jwt.claim.role', true) <> 'service_role' then
    raise exception 'Passkey attendance must be recorded by the verified server endpoint';
  end if;
  if p_school_id is null or p_user_id is null or p_person_type not in ('student','teacher','staff','parent','admin','proprietor')
    or p_event_type not in ('check_in','check_out')
    or p_credential_id is null then
    raise exception 'Invalid passkey attendance request';
  end if;
  if not exists (
    select 1 from public.resa_passkey_credentials c
    where c.user_id = p_user_id and c.credential_id = p_credential_id and c.revoked_at is null
  ) then
    raise exception 'This passkey is not active for the account';
  end if;

  if p_person_type = 'student' then
    if p_activity not in ('school_arrival','school_departure')
      or not exists (
        select 1 from public.students s
        where s.id = p_person_id and s.school_id = p_school_id and s.status = 'active'
          and (
            s.user_id = p_user_id
            or exists (
              select 1 from public.student_portal_accounts a
              where a.school_id = p_school_id and a.student_id = s.id
                and a.user_id = p_user_id and a.is_active
            )
          )
      ) then
      raise exception 'The student identity is not linked to this active account';
    end if;

    select e.academic_session_id, e.class_id
      into v_session_id, v_class_id
    from public.student_enrollments e
    join public.academic_sessions a
      on a.id = e.academic_session_id and a.school_id = e.school_id and a.is_current
    where e.school_id = p_school_id and e.student_id = p_person_id and e.status = 'active'
    order by e.enrollment_date desc
    limit 1;
    if v_session_id is null or v_class_id is null then
      raise exception 'The student has no active class enrolment in the current academic session';
    end if;

    select concat_ws(' ', p.first_name, p.middle_name, p.last_name)
      into v_person_name
    from public.students s
    join public.people p on p.id = s.person_id and p.school_id = s.school_id
    where s.id = p_person_id and s.school_id = p_school_id;

    if p_event_type = 'check_in' then
      select sa.id into v_attendance_id
      from public.student_attendance sa
      where sa.school_id = p_school_id and sa.student_id = p_person_id and sa.attendance_date = v_today
      for update;
      if v_attendance_id is not null then
        if exists (select 1 from public.student_attendance sa where sa.id = v_attendance_id and sa.check_in_at is not null) then
          raise exception 'Student attendance has already been checked in today';
        end if;
        update public.student_attendance
        set check_in_at = v_now, status = 'present',
            remarks = concat_ws(' · ', nullif(remarks,''), 'Passkey verified check-in')
        where id = v_attendance_id;
      else
        insert into public.student_attendance (
          school_id, student_id, academic_session_id, class_id, attendance_date,
          status, check_in_at, remarks
        ) values (
          p_school_id, p_person_id, v_session_id, v_class_id, v_today,
          'present', v_now, 'Passkey verified check-in'
        ) returning id into v_attendance_id;
      end if;
    else
      update public.student_attendance
      set check_out_at = v_now,
          remarks = concat_ws(' · ', nullif(remarks,''), 'Passkey verified check-out')
      where school_id = p_school_id and student_id = p_person_id
        and attendance_date = v_today and check_in_at is not null and check_out_at is null
      returning id into v_attendance_id;
      if v_attendance_id is null then
        raise exception 'A valid student check-in is required before check-out';
      end if;
    end if;

  elsif p_person_type in ('teacher','staff') then
    if p_activity not in ('work_arrival','work_departure') then
      raise exception 'Invalid staff attendance activity';
    end if;
    select sf.staff_category into v_staff_category
    from public.staff sf
    left join public.people p on p.id = sf.person_id and p.school_id = sf.school_id
    where sf.id = p_person_id and sf.school_id = p_school_id and sf.status = 'active'
      and (sf.user_id = p_user_id or p.user_id = p_user_id)
    for update of sf;
    if not found then
      raise exception 'The staff identity is not linked to this active account';
    end if;
    if p_person_type = 'teacher' and v_staff_category <> 'academic' then
      raise exception 'This staff record is not classified as academic teaching staff';
    end if;
    if p_person_type = 'staff' and v_staff_category = 'academic' then
      raise exception 'This staff record is classified as academic teaching staff';
    end if;
    select concat_ws(' ', p.first_name, p.middle_name, p.last_name)
      into v_person_name
    from public.staff sf
    join public.people p on p.id = sf.person_id and p.school_id = sf.school_id
    where sf.id = p_person_id and sf.school_id = p_school_id;

    if p_event_type = 'check_in' then
      insert into public.staff_attendance (
        school_id, staff_id, attendance_date, status, check_in_time, recorded_by, remarks
      ) values (
        p_school_id, p_person_id, v_today, 'present', v_local_time, p_user_id, 'Passkey verified check-in'
      )
      on conflict (staff_id, attendance_date) do update
        set status = 'present', check_in_time = excluded.check_in_time,
            recorded_by = p_user_id,
            remarks = concat_ws(' · ', nullif(public.staff_attendance.remarks,''), 'Passkey verified check-in')
        where public.staff_attendance.check_in_time is null
      returning id into v_attendance_id;
      if v_attendance_id is null then
        raise exception 'Staff attendance has already been checked in today';
      end if;
    else
      update public.staff_attendance
      set check_out_time = v_local_time, status = 'checked_out', recorded_by = p_user_id,
          remarks = concat_ws(' · ', nullif(remarks,''), 'Passkey verified check-out')
      where school_id = p_school_id and staff_id = p_person_id
        and attendance_date = v_today and check_in_time is not null and check_out_time is null
      returning id into v_attendance_id;
      if v_attendance_id is null then
        raise exception 'A valid staff check-in is required before check-out';
      end if;
    end if;

  elsif p_person_type = 'parent' then
    if p_activity not in ('school_visit','school_visit_exit') then
      raise exception 'Invalid parent attendance activity';
    end if;
    if not exists (
      select 1 from public.parent_portal_accounts a
      where a.school_id = p_school_id and a.parent_guardian_id = p_person_id
        and a.user_id = p_user_id and a.is_active
    ) then
      raise exception 'The parent identity is not linked to this active account';
    end if;
    select concat_ws(' ', p.first_name, p.middle_name, p.last_name)
      into v_person_name
    from public.parents_guardians g
    join public.people p on p.id = g.person_id and p.school_id = g.school_id
    where g.id = p_person_id and g.school_id = p_school_id;

  elsif p_person_type = 'admin' then
    if p_activity not in ('work_arrival','work_departure') or not exists (
      select 1 from public.school_memberships m
      where m.school_id = p_school_id and m.user_id = p_user_id
        and m.role = 'admin'::public.school_role and m.status = 'active'
    ) then
      raise exception 'Active school administrator access is required';
    end if;
    select coalesce(p.email, 'RESA administrator') into v_person_name
    from public.people p where p.school_id = p_school_id and p.user_id = p_user_id limit 1;

  elsif p_person_type = 'proprietor' then
    if p_activity not in ('work_arrival','work_departure') or not exists (
      select 1 from public.school_payment_gateway_proprietors p
      where p.school_id = p_school_id and p.user_id = p_user_id
    ) then
      raise exception 'Authorised school proprietor access is required';
    end if;
    select coalesce(p.email, 'RESA proprietor') into v_person_name
    from public.people p where p.school_id = p_school_id and p.user_id = p_user_id limit 1;
  end if;

  if (p_activity in ('school_arrival','work_arrival','school_visit') and p_event_type <> 'check_in')
    or (p_activity in ('school_departure','work_departure','school_visit_exit') and p_event_type <> 'check_out') then
    raise exception 'The attendance action does not match the selected activity';
  end if;

  insert into public.resa_identity_attendance_events (
    school_id, user_id, person_type, person_id, activity, event_type,
    attendance_date, event_time, verification_method, credential_id, device_label
  ) values (
    p_school_id, p_user_id, p_person_type, p_person_id, p_activity, p_event_type,
    v_today, v_now, 'passkey', p_credential_id, nullif(left(trim(coalesce(p_device_label,'')),80),'')
  ) returning id into v_event_id;

  if p_person_type = 'student' then
    insert into public.biometric_parent_notifications (
      school_id, student_id, parent_guardian_id, channel, notification_type, message, status
    )
    select
      p_school_id, p_person_id, spg.parent_guardian_id, 'in_app', 'attendance',
      coalesce(nullif(v_person_name,''),'Your child') ||
        case when p_event_type = 'check_in' then ' has checked in at RESA.' else ' has checked out from RESA.' end,
      'pending'
    from public.student_parent_guardians spg
    join public.parent_portal_accounts pa
      on pa.school_id = spg.school_id and pa.parent_guardian_id = spg.parent_guardian_id
      and pa.is_active
    where spg.school_id = p_school_id and spg.student_id = p_person_id;
  end if;

  return jsonb_build_object(
    'success', true, 'event_id', v_event_id, 'person_type', p_person_type,
    'person_id', p_person_id, 'person_name', coalesce(nullif(v_person_name,''),'RESA account'),
    'activity', p_activity, 'event_type', p_event_type, 'event_time', v_now,
    'attendance_date', v_today, 'verification_method', 'passkey'
  );
end;
$function$;

revoke all on function public.resa_record_passkey_attendance(uuid,uuid,text,uuid,text,text,text,text) from public, anon, authenticated;
grant execute on function public.resa_record_passkey_attendance(uuid,uuid,text,uuid,text,text,text,text) to service_role;
