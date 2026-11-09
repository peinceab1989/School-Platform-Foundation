-- RESA administrator-approved QR credentials and universal push notifications.
-- Additive changes only. Existing QR tokens and attendance history are preserved.
create extension if not exists pg_net;

alter table public.attendance_qr_credentials
  add column if not exists approval_status text not null default 'pending',
  add column if not exists approved_by uuid references auth.users(id),
  add column if not exists approved_at timestamptz,
  add column if not exists approval_note text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.attendance_qr_credentials'::regclass
      and conname = 'attendance_qr_approval_status_check'
  ) then
    alter table public.attendance_qr_credentials
      add constraint attendance_qr_approval_status_check
      check (approval_status in ('pending','approved','rejected','revoked'));
  end if;
end $$;

-- Existing live credentials must be reviewed once by an administrator.
-- Previously revoked credentials remain revoked and are never reactivated here.
update public.attendance_qr_credentials
set approval_status = case when is_active then 'pending' else 'revoked' end,
    approved_by = null,
    approved_at = null
where approval_status = 'pending';

create index if not exists attendance_qr_approval_queue_idx
  on public.attendance_qr_credentials(school_id, approval_status, created_at desc)
  where is_active;

create or replace function public.resa_get_active_attendance_qr(
  p_school_id uuid,
  p_person_type text,
  p_person_id uuid
) returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare v_code uuid;
begin
  if auth.uid() is null or p_person_type not in ('student','staff') then
    raise exception 'Invalid QR lookup';
  end if;
  if not (
    public.has_school_role(p_school_id, array['admin']::public.school_role[])
    or (
      p_person_type = 'student' and exists (
        select 1 from public.students s
        left join public.people p on p.id = s.person_id and p.school_id = s.school_id
        where s.id = p_person_id and s.school_id = p_school_id
          and (s.user_id = auth.uid() or p.user_id = auth.uid()) and s.status = 'active'
      )
    )
    or (
      p_person_type = 'staff' and exists (
        select 1 from public.staff st
        left join public.people p on p.id = st.person_id and p.school_id = st.school_id
        where st.id = p_person_id and st.school_id = p_school_id
          and (st.user_id = auth.uid() or p.user_id = auth.uid()) and st.status = 'active'
      )
    )
  ) then
    raise exception 'You are not authorised to view this ID QR';
  end if;
  select q.id into v_code
  from public.attendance_qr_credentials q
  where q.school_id = p_school_id
    and q.person_type = p_person_type
    and q.is_active
    and q.approval_status = 'approved'
    and ((p_person_type = 'student' and q.student_id = p_person_id)
      or (p_person_type = 'staff' and q.staff_id = p_person_id))
  order by q.created_at desc
  limit 1;
  return v_code;
end;
$function$;

revoke all on function public.resa_get_active_attendance_qr(uuid,text,uuid) from public, anon;
grant execute on function public.resa_get_active_attendance_qr(uuid,text,uuid) to authenticated;

create or replace function public.resa_issue_attendance_qr(
  p_school_id uuid,
  p_person_type text,
  p_person_id uuid,
  p_token_hash text
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare v_id uuid;
begin
  if auth.uid() is null or not public.has_school_role(p_school_id,array['admin']::public.school_role[]) then
    raise exception 'Admin access required';
  end if;
  if p_person_type not in ('student','staff') or p_token_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'Invalid QR credential';
  end if;
  if not exists (
    select 1 from public.smart_access_settings s
    where s.school_id=p_school_id
      and ((p_person_type='student' and s.student_qr_enabled)
        or (p_person_type='staff' and s.staff_qr_enabled))
  ) then
    raise exception 'QR attendance is not enabled';
  end if;
  if p_person_type='student' then
    if not exists(select 1 from public.students where id=p_person_id and school_id=p_school_id and status='active') then
      raise exception 'Active student not found';
    end if;
    update public.attendance_qr_credentials
      set is_active=false, revoked_at=now(), approval_status='revoked'
      where school_id=p_school_id and student_id=p_person_id and is_active;
    insert into public.attendance_qr_credentials(school_id,person_type,student_id,token_hash,created_by,approval_status)
      values(p_school_id,'student',p_person_id,p_token_hash,auth.uid(),'pending')
      returning id into v_id;
  else
    if not exists(select 1 from public.staff where id=p_person_id and school_id=p_school_id and status='active') then
      raise exception 'Active staff member not found';
    end if;
    update public.attendance_qr_credentials
      set is_active=false, revoked_at=now(), approval_status='revoked'
      where school_id=p_school_id and staff_id=p_person_id and is_active;
    insert into public.attendance_qr_credentials(school_id,person_type,staff_id,token_hash,created_by,approval_status)
      values(p_school_id,'staff',p_person_id,p_token_hash,auth.uid(),'pending')
      returning id into v_id;
  end if;
  return jsonb_build_object('credential_id',v_id,'issued_at',now(),'approval_status','pending');
end;
$function$;

revoke all on function public.resa_issue_attendance_qr(uuid,text,uuid,text) from public, anon;
grant execute on function public.resa_issue_attendance_qr(uuid,text,uuid,text) to authenticated;

create or replace function public.resa_record_qr_attendance(
  p_token_hash text,
  p_station_id uuid,
  p_event_type text
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_qr public.attendance_qr_credentials%rowtype;
  v_device public.biometric_devices%rowtype;
  v_today date := (now() at time zone 'Africa/Lagos')::date;
  v_time time := (now() at time zone 'Africa/Lagos')::time;
  v_row public.student_attendance%rowtype;
  v_staff public.staff_attendance%rowtype;
  v_event_id uuid;
  v_stamp timestamptz;
  v_name text;
begin
  if auth.uid() is null or p_event_type not in ('check_in','check_out') then
    raise exception 'Invalid QR attendance request';
  end if;
  if p_token_hash ~ '^RESA-ID:[0-9a-fA-F-]{36}$' then
    select * into v_qr from public.attendance_qr_credentials
    where id = substring(p_token_hash from 9)::uuid and is_active for update;
  elsif p_token_hash ~ '^[a-f0-9]{64}$' then
    select * into v_qr from public.attendance_qr_credentials
    where token_hash = p_token_hash and is_active for update;
  else
    raise exception 'Invalid QR attendance request';
  end if;
  if not found then raise exception 'QR credential is invalid or revoked'; end if;
  if v_qr.approval_status <> 'approved' then
    raise exception 'QR credential is awaiting administrator approval';
  end if;
  if not public.has_school_role(v_qr.school_id,array['admin','teacher']::public.school_role[]) then
    raise exception 'Attendance operator access required';
  end if;
  select * into v_device from public.biometric_devices
  where id=p_station_id and school_id=v_qr.school_id and is_active;
  if not found then raise exception 'Select an active attendance station'; end if;

  if v_qr.person_type='student' then
    perform 1 from public.students
    where id=v_qr.student_id and school_id=v_qr.school_id and status='active' for update;
    if not found then raise exception 'Student is inactive'; end if;
    select * into v_row from public.student_attendance
    where school_id=v_qr.school_id and student_id=v_qr.student_id and attendance_date=v_today for update;
    if p_event_type='check_in' and v_row.check_in_at is not null then raise exception 'Already checked in today'; end if;
    if p_event_type='check_out' and (v_row.id is null or v_row.check_in_at is null or v_row.check_out_at is not null) then
      raise exception 'No valid check-in is available';
    end if;
    insert into public.biometric_attendance_events(school_id,biometric_device_id,student_id,event_type,event_time,verification_method)
    values(v_qr.school_id,p_station_id,v_qr.student_id,p_event_type,now(),'qr_code')
    returning id,event_time into v_event_id,v_stamp;
    select concat_ws(' ',p.first_name,p.middle_name,p.last_name) into v_name
    from public.students s join public.people p on p.id=s.person_id and p.school_id=s.school_id
    where s.id=v_qr.student_id;
  else
    perform 1 from public.staff
    where id=v_qr.staff_id and school_id=v_qr.school_id and status='active' for update;
    if not found then raise exception 'Staff member is inactive'; end if;
    if p_event_type='check_in' then
      insert into public.staff_attendance(school_id,staff_id,attendance_date,status,check_in_time,recorded_by,remarks)
      values(v_qr.school_id,v_qr.staff_id,v_today,'present',v_time,auth.uid(),'QR check-in at '||v_device.device_name)
      on conflict(staff_id,attendance_date) do update set status='present',check_in_time=excluded.check_in_time,
        recorded_by=auth.uid(),remarks=concat_ws(' · ',public.staff_attendance.remarks,excluded.remarks)
      where public.staff_attendance.check_in_time is null returning * into v_staff;
      if not found then raise exception 'Already checked in today'; end if;
    else
      update public.staff_attendance set check_out_time=v_time,status='checked_out',recorded_by=auth.uid(),
        remarks=concat_ws(' · ',remarks,'QR check-out at '||v_device.device_name)
      where school_id=v_qr.school_id and staff_id=v_qr.staff_id and attendance_date=v_today
        and check_in_time is not null and check_out_time is null returning * into v_staff;
      if not found then raise exception 'Valid staff check-in required before check-out'; end if;
    end if;
    select concat_ws(' ',p.first_name,p.middle_name,p.last_name) into v_name
    from public.staff sf join public.people p on p.id=sf.person_id and p.school_id=sf.school_id
    where sf.id=v_qr.staff_id;
  end if;
  return jsonb_build_object('success',true,'person_type',v_qr.person_type,
    'person_id',coalesce(v_qr.student_id,v_qr.staff_id),'person_name',v_name,
    'event_type',p_event_type,'event_time',coalesce(v_stamp,now()),'station_name',v_device.device_name);
end;
$function$;

revoke all on function public.resa_record_qr_attendance(text,uuid,text) from public, anon;
grant execute on function public.resa_record_qr_attendance(text,uuid,text) to authenticated;

-- Every active portal membership receives in-app notification defaults.
create table if not exists public.resa_notification_preferences (
  school_id uuid not null references public.schools(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  enabled boolean not null default true,
  sound_choice text not null default 'chime' check (sound_choice in ('chime','bell','soft','none')),
  phone_notifications_enabled boolean not null default false,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  primary key (school_id,user_id)
);

create table if not exists public.resa_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth_key text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

alter table public.resa_notification_preferences enable row level security;
alter table public.resa_push_subscriptions enable row level security;
grant select, insert, update, delete on public.resa_notification_preferences to authenticated;
grant select, insert, update, delete on public.resa_push_subscriptions to authenticated;

drop policy if exists resa_notification_preferences_self_manage on public.resa_notification_preferences;
create policy resa_notification_preferences_self_manage
  on public.resa_notification_preferences for all to authenticated
  using (
    user_id = (select auth.uid())
    and exists (select 1 from public.school_memberships m
      where m.school_id = resa_notification_preferences.school_id
        and m.user_id = (select auth.uid()) and m.status = 'active')
  )
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.school_memberships m
      where m.school_id = resa_notification_preferences.school_id
        and m.user_id = (select auth.uid()) and m.status = 'active')
  );

drop policy if exists resa_push_subscriptions_self_manage on public.resa_push_subscriptions;
create policy resa_push_subscriptions_self_manage
  on public.resa_push_subscriptions for all to authenticated
  using (
    user_id = (select auth.uid())
    and exists (select 1 from public.school_memberships m
      where m.school_id = resa_push_subscriptions.school_id
        and m.user_id = (select auth.uid()) and m.status = 'active')
  )
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.school_memberships m
      where m.school_id = resa_push_subscriptions.school_id
        and m.user_id = (select auth.uid()) and m.status = 'active')
  );

insert into public.resa_notification_preferences(school_id,user_id,enabled,sound_choice)
select school_id,user_id,true,'chime'
from public.school_memberships
where status='active'
on conflict (school_id,user_id) do nothing;

-- Only the trusted Edge Function can retrieve the encrypted VAPID material and webhook token.
create or replace function public.resa_get_push_secrets()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_role text := current_setting('request.jwt.claim.role', true);
  v_result jsonb;
begin
  if v_role <> 'service_role' then
    raise exception 'Push secret access denied';
  end if;
  select jsonb_object_agg(name,decrypted_secret) into v_result
  from vault.decrypted_secrets
  where name in ('resa_push_vapid_public_key','resa_push_vapid_private_key','resa_push_webhook_token');
  return coalesce(v_result,'{}'::jsonb);
end;
$function$;
revoke all on function public.resa_get_push_secrets() from public, anon, authenticated;
grant execute on function public.resa_get_push_secrets() to service_role;

-- Database events are handed to the Edge Function asynchronously; secrets remain in Vault.
create or replace function public.resa_queue_push_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_token text;
  v_payload jsonb;
  v_event_type text;
begin
  select decrypted_secret into v_token
  from vault.decrypted_secrets
  where name='resa_push_webhook_token'
  limit 1;
  if v_token is null then return new; end if;

  if tg_table_name='school_messages' then
    v_event_type := 'school_message';
    v_payload := jsonb_build_object('event_type',v_event_type,'record',to_jsonb(new));
  elsif tg_table_name='resa_chat_messages' then
    v_event_type := 'chat_message';
    v_payload := jsonb_build_object('event_type',v_event_type,'record',to_jsonb(new));
  elsif tg_table_name='biometric_parent_notifications' then
    v_event_type := 'attendance';
    v_payload := jsonb_build_object('event_type',v_event_type,'record',to_jsonb(new));
  elsif tg_table_name='announcements' then
    if not new.is_published then return new; end if;
    v_event_type := 'announcement';
    v_payload := jsonb_build_object('event_type',v_event_type,'record',to_jsonb(new));
  else
    return new;
  end if;

  perform net.http_post(
    url := 'https://mhwwzzxwpsqwhxrsuwaa.supabase.co/functions/v1/resa-push-dispatch',
    headers := jsonb_build_object('Content-Type','application/json','x-resa-push-token',v_token),
    body := v_payload,
    timeout_milliseconds := 5000
  );
  return new;
end;
$function$;
revoke all on function public.resa_queue_push_event() from public, anon, authenticated;

drop trigger if exists resa_push_school_message_insert on public.school_messages;
create trigger resa_push_school_message_insert
  after insert on public.school_messages
  for each row execute function public.resa_queue_push_event();

drop trigger if exists resa_push_chat_message_insert on public.resa_chat_messages;
create trigger resa_push_chat_message_insert
  after insert on public.resa_chat_messages
  for each row execute function public.resa_queue_push_event();

drop trigger if exists resa_push_parent_attendance_insert on public.biometric_parent_notifications;
create trigger resa_push_parent_attendance_insert
  after insert on public.biometric_parent_notifications
  for each row execute function public.resa_queue_push_event();

drop trigger if exists resa_push_announcement_publish on public.announcements;
create trigger resa_push_announcement_publish
  after insert or update of is_published, published_at on public.announcements
  for each row execute function public.resa_queue_push_event();
