-- RESA unified attendance register for Supabase Auth native passkeys.
-- Supabase Auth owns WebAuthn credential/challenge storage and verification.
-- RESA stores attendance events only; no fingerprint, face image or biometric template is collected.

create table if not exists public.resa_identity_attendance_events (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete restrict,
  person_type text not null
    check (person_type in ('student', 'teacher', 'staff', 'parent', 'admin', 'proprietor')),
  person_id uuid,
  person_name text not null default 'RESA account',
  activity text not null
    check (activity in ('school_arrival', 'school_departure', 'work_arrival', 'work_departure', 'school_visit', 'school_visit_exit')),
  event_type text not null check (event_type in ('check_in', 'check_out')),
  attendance_date date not null,
  event_time timestamptz not null default now(),
  verification_method text not null default 'passkey'
    check (verification_method = 'passkey'),
  auth_session_id uuid not null,
  biometric_event_id uuid references public.biometric_attendance_events(id) on delete set null,
  device_label text,
  created_at timestamptz not null default now(),
  constraint resa_identity_attendance_one_action_per_day
    unique (school_id, user_id, activity, attendance_date, event_type)
);


-- A logical device entry lets the existing biometric attendance processor,
-- student register and parent Realtime notification triggers process passkey events.
alter table public.biometric_attendance_events
  drop constraint if exists biometric_attendance_verification_check;
alter table public.biometric_attendance_events
  add constraint biometric_attendance_verification_check
  check (verification_method = any (array['fingerprint','face','card','other','qr_code','passkey']::text[]));

insert into public.biometric_devices (school_id, device_name, device_type, location, is_active)
select school.id, 'RESA Passkey (WebAuthn)', 'other',
       'Authenticated mobile device or approved school terminal', true
from public.schools school
where not exists (
  select 1 from public.biometric_devices device
  where device.school_id = school.id
    and device.device_name = 'RESA Passkey (WebAuthn)'
);

create or replace function public.protect_resa_passkey_attendance_device()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  if tg_op = 'DELETE' then
    if old.device_name = 'RESA Passkey (WebAuthn)' then
      raise exception 'The RESA passkey attendance device is system-managed and cannot be deleted';
    end if;
    return old;
  end if;

  if old.device_name = 'RESA Passkey (WebAuthn)'
    and (
      new.school_id is distinct from old.school_id
      or new.device_name is distinct from old.device_name
      or new.device_type is distinct from old.device_type
      or new.is_active is distinct from true
    ) then
    raise exception 'The RESA passkey attendance device is system-managed and must remain active';
  end if;
  return new;
end;
$function$;

revoke all on function public.protect_resa_passkey_attendance_device() from public, anon, authenticated;
drop trigger if exists protect_resa_passkey_attendance_device on public.biometric_devices;
create trigger protect_resa_passkey_attendance_device
  before update or delete on public.biometric_devices
  for each row execute function public.protect_resa_passkey_attendance_device();

create table if not exists public.resa_passkey_attendance_auth_uses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid not null,
  passkey_auth_time bigint not null,
  used_at timestamptz not null default now(),
  constraint resa_passkey_attendance_auth_use_once
    unique (user_id, session_id, passkey_auth_time)
);

alter table public.resa_passkey_attendance_auth_uses enable row level security;
revoke all on table public.resa_passkey_attendance_auth_uses from anon, authenticated;

create index if not exists resa_identity_attendance_school_recent_idx
  on public.resa_identity_attendance_events (school_id, event_time desc);
create index if not exists resa_identity_attendance_user_recent_idx
  on public.resa_identity_attendance_events (user_id, school_id, event_time desc);

alter table public.resa_identity_attendance_events enable row level security;
revoke all on table public.resa_identity_attendance_events from anon, authenticated;
grant select on table public.resa_identity_attendance_events to authenticated;

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

-- A passkey sign-in creates a short-lived Supabase Auth session with amr.method='passkey'.
-- This RPC accepts only a recent passkey-authenticated session, not an ordinary password session.
-- The user's identity and school role are resolved and checked again inside this transaction.
create or replace function public.resa_record_passkey_attendance(
  p_school_id uuid,
  p_person_type text,
  p_person_id uuid,
  p_activity text,
  p_event_type text,
  p_device_label text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_claims jsonb := auth.jwt();
  v_amr jsonb;
  v_passkey_time bigint;
  v_auth_time bigint;
  v_session_id uuid;
  v_now timestamptz := now();
  v_today date := (now() at time zone 'Africa/Lagos')::date;
  v_local_time time := (now() at time zone 'Africa/Lagos')::time;
  v_attendance_id uuid;
  v_event_id uuid;
  v_biometric_event_id uuid;
  v_passkey_device_id uuid;
  v_person_name text;
  v_staff_category text;
begin
  if v_user_id is null then
    raise exception 'Sign in to RESA before recording attendance';
  end if;

  v_auth_time := nullif(v_claims ->> 'auth_time', '')::bigint;
  v_amr := coalesce(v_claims -> 'amr', '[]'::jsonb);
  if jsonb_typeof(v_amr) = 'array' then
    select max(nullif(entry.value ->> 'timestamp', '')::bigint)
      into v_passkey_time
    from jsonb_array_elements(v_amr) as entry(value)
    where entry.value ->> 'method' = 'passkey';
  end if;
  if v_auth_time is null or v_passkey_time is null
    or v_passkey_time < extract(epoch from v_now)::bigint - 120
    or v_auth_time < extract(epoch from v_now)::bigint - 120 then
    raise exception 'A fresh fingerprint/passkey verification is required for every attendance action';
  end if;

  v_session_id := nullif(v_claims ->> 'session_id', '')::uuid;
  if v_session_id is null then
    raise exception 'The verified passkey session is incomplete. Sign in again';
  end if;
  begin
    insert into public.resa_passkey_attendance_auth_uses (user_id, session_id, passkey_auth_time)
    values (v_user_id, v_session_id, v_passkey_time);
  exception when unique_violation then
    raise exception 'This passkey verification has already been used. Verify again for each attendance action';
  end;

  if p_school_id is null or p_person_type is null
    or p_person_type not in ('student','teacher','staff','parent','admin','proprietor')
    or p_activity is null
    or p_event_type is null or p_event_type not in ('check_in','check_out') then
    raise exception 'Invalid RESA attendance request';
  end if;
  if p_person_type in ('admin','proprietor') and p_person_id is not null then
    raise exception 'School leadership attendance does not accept a person record override';
  end if;
  if (p_activity in ('school_arrival','work_arrival','school_visit') and p_event_type <> 'check_in')
    or (p_activity in ('school_departure','work_departure','school_visit_exit') and p_event_type <> 'check_out') then
    raise exception 'The attendance action does not match the selected activity';
  end if;

  if p_person_type = 'student' then
    if p_activity not in ('school_arrival','school_departure')
      or not exists (
        select 1 from public.students s
        where s.id = p_person_id and s.school_id = p_school_id and s.status = 'active'
          and (
            s.user_id = v_user_id
            or exists (
              select 1 from public.student_portal_accounts a
              where a.school_id = p_school_id and a.student_id = s.id
                and a.user_id = v_user_id and a.is_active
            )
            or exists (
              select 1 from public.people p
              where p.id = s.person_id and p.school_id = s.school_id and p.user_id = v_user_id
            )
          )
      ) then
      raise exception 'The student identity is not linked to this active account';
    end if;

    select device.id into v_passkey_device_id
    from public.biometric_devices device
    where device.school_id = p_school_id
      and device.device_name = 'RESA Passkey (WebAuthn)'
      and device.is_active = true
    limit 1;
    if v_passkey_device_id is null then
      raise exception 'The school passkey attendance station is not active. Contact the school administrator';
    end if;

    select concat_ws(' ', p.first_name, p.middle_name, p.last_name)
      into v_person_name
    from public.students s
    join public.people p on p.id = s.person_id and p.school_id = s.school_id
    where s.id = p_person_id and s.school_id = p_school_id;

    -- Existing database triggers validate current enrolment, update student_attendance,
    -- and create the linked parent notification for this verified event.
    insert into public.biometric_attendance_events (
      school_id, biometric_device_id, student_id, event_type, event_time, verification_method
    ) values (
      p_school_id, v_passkey_device_id, p_person_id, p_event_type, v_now, 'passkey'
    ) returning id into v_biometric_event_id;

  elsif p_person_type in ('teacher','staff') then
    if p_activity not in ('work_arrival','work_departure') then
      raise exception 'Invalid staff attendance activity';
    end if;
    select sf.staff_category into v_staff_category
    from public.staff sf
    left join public.people p on p.id = sf.person_id and p.school_id = sf.school_id
    where sf.id = p_person_id and sf.school_id = p_school_id and sf.status = 'active'
      and (
        sf.user_id = v_user_id
        or p.user_id = v_user_id
      )
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
        p_school_id, p_person_id, v_today, 'present', v_local_time, v_user_id, 'Passkey verified check-in'
      )
      on conflict (staff_id, attendance_date) do update
        set status = 'present', check_in_time = excluded.check_in_time,
            recorded_by = v_user_id,
            remarks = concat_ws(' · ', nullif(public.staff_attendance.remarks,''), 'Passkey verified check-in')
        where public.staff_attendance.check_in_time is null
      returning id into v_attendance_id;
      if v_attendance_id is null then
        raise exception 'Staff attendance has already been checked in today';
      end if;
    else
      update public.staff_attendance
      set check_out_time = v_local_time, recorded_by = v_user_id,
          remarks = concat_ws(' · ', nullif(remarks,''), 'Passkey verified check-out')
      where school_id = p_school_id and staff_id = p_person_id
        and attendance_date = v_today and check_in_time is not null and check_out_time is null
      returning id into v_attendance_id;
      if v_attendance_id is null then
        raise exception 'A valid staff check-in is required before check-out';
      end if;
    end if;

  elsif p_person_type = 'parent' then
    if p_activity = 'school_visit_exit' and not exists (
      select 1 from public.resa_identity_attendance_events event
      where event.school_id = p_school_id and event.user_id = v_user_id
        and event.person_type = 'parent' and event.person_id = p_person_id
        and event.activity = 'school_visit' and event.event_type = 'check_in'
        and event.attendance_date = v_today
    ) then
      raise exception 'A valid parent school-visit check-in is required before check-out';
    end if;
    if p_activity not in ('school_visit','school_visit_exit')
      or not exists (
        select 1 from public.parent_portal_accounts a
        where a.school_id = p_school_id and a.parent_guardian_id = p_person_id
          and a.user_id = v_user_id and a.is_active
      ) then
      raise exception 'The parent identity is not linked to this active account';
    end if;
    select concat_ws(' ', p.first_name, p.middle_name, p.last_name)
      into v_person_name
    from public.parents_guardians g
    join public.people p on p.id = g.person_id and p.school_id = g.school_id
    where g.id = p_person_id and g.school_id = p_school_id;

  elsif p_person_type = 'admin' then
    if p_event_type = 'check_out' and not exists (
      select 1 from public.resa_identity_attendance_events event
      where event.school_id = p_school_id and event.user_id = v_user_id
        and event.person_type = 'admin' and event.activity = 'work_arrival'
        and event.event_type = 'check_in' and event.attendance_date = v_today
    ) then
      raise exception 'A valid administrator check-in is required before check-out';
    end if;
    if p_activity not in ('work_arrival','work_departure') or not exists (
      select 1 from public.school_memberships m
      where m.school_id = p_school_id and m.user_id = v_user_id
        and m.role = 'admin'::public.school_role and m.status = 'active'
    ) then
      raise exception 'Active school administrator access is required';
    end if;
    select coalesce(nullif(concat_ws(' ', p.first_name, p.middle_name, p.last_name),''), p.email, 'RESA administrator') into v_person_name
    from public.people p where p.school_id = p_school_id and p.user_id = v_user_id limit 1;

  elsif p_person_type = 'proprietor' then
    if p_event_type = 'check_out' and not exists (
      select 1 from public.resa_identity_attendance_events event
      where event.school_id = p_school_id and event.user_id = v_user_id
        and event.person_type = 'proprietor' and event.activity = 'work_arrival'
        and event.event_type = 'check_in' and event.attendance_date = v_today
    ) then
      raise exception 'A valid proprietor check-in is required before check-out';
    end if;
    if p_activity not in ('work_arrival','work_departure') or not exists (
      select 1 from public.school_payment_gateway_proprietors p
      where p.school_id = p_school_id and p.user_id = v_user_id
    ) then
      raise exception 'Authorised school proprietor access is required';
    end if;
    select coalesce(nullif(concat_ws(' ', p.first_name, p.middle_name, p.last_name),''), p.email, 'RESA proprietor') into v_person_name
    from public.people p where p.school_id = p_school_id and p.user_id = v_user_id limit 1;
  end if;

  insert into public.resa_identity_attendance_events (
    school_id, user_id, person_type, person_id, person_name, activity, event_type,
    attendance_date, event_time, verification_method, auth_session_id, biometric_event_id, device_label
  ) values (
    p_school_id, v_user_id, p_person_type, p_person_id, coalesce(nullif(v_person_name,''),'RESA account'), p_activity, p_event_type,
    v_today, v_now, 'passkey', v_session_id, v_biometric_event_id,
    nullif(left(trim(coalesce(p_device_label,'')),80),'')
  ) returning id into v_event_id;

  return jsonb_build_object(
    'success', true, 'event_id', v_event_id, 'person_type', p_person_type,
    'person_id', p_person_id, 'person_name', coalesce(nullif(v_person_name,''),'RESA account'),
    'activity', p_activity, 'event_type', p_event_type, 'event_time', v_now,
    'attendance_date', v_today, 'verification_method', 'passkey'
  );
end;
$function$;

revoke all on function public.resa_record_passkey_attendance(uuid,text,uuid,text,text,text) from public, anon;
grant execute on function public.resa_record_passkey_attendance(uuid,text,uuid,text,text,text) to authenticated;

comment on table public.resa_identity_attendance_events is
  'Server-verified, fresh-passkey attendance events for students, teachers, staff, parents, administrators and proprietors. Supabase Auth stores WebAuthn public credentials; RESA does not store biometric templates.';


-- Return only the calling user's own RESA identity categories for the selected school.
create or replace function public.resa_get_attendance_identities(p_school_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $function$
  with identity_rows as (
    select
      'proprietor'::text as person_type,
      null::uuid as person_id,
      'School proprietor'::text as display_label,
      array['work_arrival','work_departure']::text[] as allowed_activities
    where exists (
      select 1 from public.school_payment_gateway_proprietors proprietor
      where proprietor.school_id = p_school_id and proprietor.user_id = auth.uid()
    )
    union all
    select
      'admin'::text, null::uuid, 'School administrator'::text,
      array['work_arrival','work_departure']::text[]
    where exists (
      select 1 from public.school_memberships membership
      where membership.school_id = p_school_id and membership.user_id = auth.uid()
        and membership.role = 'admin'::public.school_role and membership.status = 'active'
    )
    union all
    select
      'student'::text, student.id, 'Student attendance'::text,
      array['school_arrival','school_departure']::text[]
    from public.students student
    left join public.people person
      on person.id = student.person_id and person.school_id = student.school_id
    left join public.student_portal_accounts account
      on account.school_id = student.school_id and account.student_id = student.id and account.is_active
    where student.school_id = p_school_id and student.status = 'active'
      and (student.user_id = auth.uid() or person.user_id = auth.uid() or account.user_id = auth.uid())
    union all
    select
      case when staff.staff_category = 'academic' then 'teacher' else 'staff' end,
      staff.id,
      case when staff.staff_category = 'academic' then 'Teacher attendance' else 'Staff attendance' end,
      array['work_arrival','work_departure']::text[]
    from public.staff staff
    left join public.people person
      on person.id = staff.person_id and person.school_id = staff.school_id
    where staff.school_id = p_school_id and staff.status = 'active'
      and (staff.user_id = auth.uid() or person.user_id = auth.uid())
    union all
    select
      'parent'::text, guardian.id, 'Parent / guardian'::text,
      array['school_visit','school_visit_exit']::text[]
    from public.parent_portal_accounts account
    join public.parents_guardians guardian
      on guardian.id = account.parent_guardian_id and guardian.school_id = account.school_id
    where account.school_id = p_school_id and account.user_id = auth.uid() and account.is_active
  ),
  deduplicated as (
    select distinct on (person_type, person_id)
      person_type, person_id, display_label, allowed_activities
    from identity_rows
    order by person_type, person_id, display_label
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'person_type', person_type,
        'person_id', person_id,
        'display_label', display_label,
        'allowed_activities', allowed_activities
      ) order by person_type, display_label
    ),
    '[]'::jsonb
  )
  from deduplicated;
$function$;

revoke all on function public.resa_get_attendance_identities(uuid) from public, anon;
grant execute on function public.resa_get_attendance_identities(uuid) to authenticated;

-- Immutable content snapshots provide a simple, school-scoped revision history.
create table if not exists public.public_website_content_revisions (
  id uuid primary key default gen_random_uuid(),
  revision_number bigint generated always as identity unique,
  school_id uuid not null references public.schools(id) on delete cascade,
  content_id uuid not null references public.public_website_content(id) on delete cascade,
  changed_by uuid references auth.users(id) on delete set null,
  action text not null check (action in ('created','updated','published','unpublished')),
  snapshot jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists public_website_content_revisions_content_idx
  on public.public_website_content_revisions (school_id, content_id, created_at desc);

alter table public.public_website_content_revisions enable row level security;
revoke all on table public.public_website_content_revisions from anon, authenticated;
grant select on table public.public_website_content_revisions to authenticated;

drop policy if exists "School admins read website content revisions" on public.public_website_content_revisions;
create policy "School admins read website content revisions"
  on public.public_website_content_revisions
  for select to authenticated
  using (
    public.is_nexus_owner()
    or public.has_school_role(school_id, array['admin']::public.school_role[])
  );

create or replace function public.capture_public_website_content_revision()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_action text;
begin
  if tg_op = 'INSERT' then
    v_action := 'created';
  elsif old.is_published is distinct from new.is_published then
    v_action := case when new.is_published then 'published' else 'unpublished' end;
  else
    v_action := 'updated';
  end if;

  insert into public.public_website_content_revisions (
    school_id, content_id, changed_by, action, snapshot
  ) values (
    new.school_id, new.id, auth.uid(), v_action, to_jsonb(new)
  );
  return new;
end;
$function$;

revoke all on function public.capture_public_website_content_revision() from public, anon, authenticated;
drop trigger if exists public_website_content_revision_capture on public.public_website_content;
create trigger public_website_content_revision_capture
  after insert or update on public.public_website_content
  for each row execute function public.capture_public_website_content_revision();

comment on table public.public_website_content_revisions is
  'Immutable school-scoped snapshots of public website content changes, readable by authorised school administrators and proprietor only.';

-- Public website imagery is separated from private school documents and drive files.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'resa-public-website-media',
  'resa-public-website-media',
  true,
  8388608,
  array['image/jpeg','image/png','image/webp','image/gif']::text[]
)
on conflict (id) do nothing;

drop policy if exists "Public can view RESA website media" on storage.objects;
create policy "Public can view RESA website media"
  on storage.objects
  for select to public
  using (bucket_id = 'resa-public-website-media');

drop policy if exists "RESA administrators upload website media" on storage.objects;
create policy "RESA administrators upload website media"
  on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'resa-public-website-media'
    and exists (
      select 1
      from public.schools school
      where school.id::text = (storage.foldername(name))[1]
        and (
          public.is_nexus_owner()
          or public.has_school_role(school.id, array['admin']::public.school_role[])
        )
    )
  );

