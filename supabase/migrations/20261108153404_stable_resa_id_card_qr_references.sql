-- Stable, revocable ID-card QR references. The QR contains only the credential row UUID,
-- never a name, admission number, staff number, or other personal information.
-- Attendance still requires an authenticated operator, active station, active credential,
-- and in-person photo verification.
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
  where q.school_id = p_school_id and q.person_type = p_person_type
    and q.is_active
    and ((p_person_type = 'student' and q.student_id = p_person_id)
      or (p_person_type = 'staff' and q.staff_id = p_person_id))
  order by q.created_at desc limit 1;
  return v_code;
end;
$function$;

revoke all on function public.resa_get_active_attendance_qr(uuid,text,uuid) from public, anon;
grant execute on function public.resa_get_active_attendance_qr(uuid,text,uuid) to authenticated;

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

  -- RESA-ID references are stable card identifiers. Legacy RESA1 secret hashes
  -- remain accepted so already-issued cards continue to work during transition.
  if p_token_hash ~ '^RESA-ID:[0-9a-fA-F-]{36}$' then
    select * into v_qr
    from public.attendance_qr_credentials
    where id = substring(p_token_hash from 9)::uuid and is_active
    for update;
  elsif p_token_hash ~ '^[a-f0-9]{64}$' then
    select * into v_qr
    from public.attendance_qr_credentials
    where token_hash = p_token_hash and is_active
    for update;
  else
    raise exception 'Invalid QR attendance request';
  end if;
  if not found then raise exception 'QR credential is invalid or revoked'; end if;
  if not public.has_school_role(v_qr.school_id,array['admin','teacher']::public.school_role[]) then
    raise exception 'Attendance operator access required';
  end if;
  select * into v_device from public.biometric_devices
  where id=p_station_id and school_id=v_qr.school_id and is_active;
  if not found then raise exception 'Select an active attendance station'; end if;

  if v_qr.person_type='student' then
    perform 1 from public.students where id=v_qr.student_id and school_id=v_qr.school_id and status='active' for update;
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
    perform 1 from public.staff where id=v_qr.staff_id and school_id=v_qr.school_id and status='active' for update;
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
