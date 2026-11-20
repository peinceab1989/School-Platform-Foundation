-- Scope teacher QR attendance to assigned learners and self-only staff check-in.
CREATE OR REPLACE FUNCTION public.resa_record_qr_attendance(p_token_hash text, p_station_id uuid, p_event_type text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
  if auth.uid() is null or p_event_type not in ('check_in','check_out') then raise exception 'Invalid QR attendance request'; end if;
  if p_token_hash ~ '^RESA-ID:[0-9a-fA-F-]{36}$' then
    select * into v_qr from public.attendance_qr_credentials where id=substring(p_token_hash from 9)::uuid and is_active for update;
  elsif p_token_hash ~ '^[a-f0-9]{64}$' then
    select * into v_qr from public.attendance_qr_credentials where token_hash=p_token_hash and is_active for update;
  else raise exception 'Invalid QR attendance request'; end if;
  if not found then raise exception 'QR credential is invalid or revoked'; end if;
  if v_qr.approval_status <> 'approved' then raise exception 'QR credential is awaiting administrator approval'; end if;
  if not public.has_school_role(v_qr.school_id,array['admin','teacher']::public.school_role[]) then raise exception 'Attendance operator access required'; end if;
  select * into v_device from public.biometric_devices where id=p_station_id and school_id=v_qr.school_id and is_active;
  if not found then raise exception 'Select an active attendance station'; end if;

  -- A teacher may record attendance only for assigned learners. A teacher may
  -- record their own staff attendance, but only an administrator can record
  -- attendance for another staff member.
  if v_qr.person_type='student' then
    if not public.has_school_role(v_qr.school_id,array['admin']::public.school_role[])
      and not public.can_access_student_record(v_qr.school_id,v_qr.student_id) then
      raise exception 'Teachers can record attendance only for learners in their assigned classes and sessions';
    end if;
  elsif v_qr.person_type='staff' then
    if not public.has_school_role(v_qr.school_id,array['admin']::public.school_role[])
      and not exists (
        select 1 from public.staff s
        where s.id=v_qr.staff_id and s.school_id=v_qr.school_id
          and s.user_id=auth.uid() and s.status='active'
      ) then
      raise exception 'Teachers may record QR attendance only for themselves; administrator access is required for another staff member';
    end if;
  else
    raise exception 'Unsupported QR person type';
  end if;

  if v_qr.person_type='student' then
    perform 1 from public.students where id=v_qr.student_id and school_id=v_qr.school_id and status='active' for update;
    if not found then raise exception 'Student is inactive'; end if;
    select * into v_row from public.student_attendance where school_id=v_qr.school_id and student_id=v_qr.student_id and attendance_date=v_today for update;
    if p_event_type='check_in' and v_row.check_in_at is not null then raise exception 'Already checked in today'; end if;
    if p_event_type='check_out' and (v_row.id is null or v_row.check_in_at is null or v_row.check_out_at is not null) then raise exception 'No valid check-in is available'; end if;
    insert into public.biometric_attendance_events(school_id,biometric_device_id,student_id,event_type,event_time,verification_method)
    values(v_qr.school_id,p_station_id,v_qr.student_id,p_event_type,now(),'qr_code') returning id,event_time into v_event_id,v_stamp;
    select concat_ws(' ',p.first_name,p.middle_name,p.last_name) into v_name from public.students s join public.people p on p.id=s.person_id and p.school_id=s.school_id where s.id=v_qr.student_id;
  else
    perform 1 from public.staff where id=v_qr.staff_id and school_id=v_qr.school_id and status='active' for update;
    if not found then raise exception 'Staff member is inactive'; end if;
    if p_event_type='check_in' then
      insert into public.staff_attendance(school_id,staff_id,attendance_date,status,check_in_time,recorded_by,remarks)
      values(v_qr.school_id,v_qr.staff_id,v_today,'present',v_time,auth.uid(),'QR check-in at '||v_device.device_name)
      on conflict(staff_id,attendance_date) do update set status='present',check_in_time=excluded.check_in_time,recorded_by=auth.uid(),remarks=concat_ws(' · ',public.staff_attendance.remarks,excluded.remarks)
      where public.staff_attendance.check_in_time is null returning * into v_staff;
      if not found then raise exception 'Already checked in today'; end if;
    else
      update public.staff_attendance set check_out_time=v_time,status='checked_out',recorded_by=auth.uid(),remarks=concat_ws(' · ',remarks,'QR check-out at '||v_device.device_name)
      where school_id=v_qr.school_id and staff_id=v_qr.staff_id and attendance_date=v_today and check_in_time is not null and check_out_time is null returning * into v_staff;
      if not found then raise exception 'Valid staff check-in required before check-out'; end if;
    end if;
    select concat_ws(' ',p.first_name,p.middle_name,p.last_name) into v_name from public.staff sf join public.people p on p.id=sf.person_id and p.school_id=sf.school_id where sf.id=v_qr.staff_id;
  end if;
  return jsonb_build_object('success',true,'person_type',v_qr.person_type,'person_id',coalesce(v_qr.student_id,v_qr.staff_id),'person_name',v_name,'event_type',p_event_type,'event_time',coalesce(v_stamp,now()),'station_name',v_device.device_name);
end;
$function$
;