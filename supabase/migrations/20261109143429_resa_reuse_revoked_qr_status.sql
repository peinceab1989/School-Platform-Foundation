-- Reuse the most recent credential even when it has been revoked.
-- A new credential is created only for a person with no QR history, or after
-- an administrator explicitly chooses replacement.
create or replace function public.resa_issue_attendance_qr(
  p_school_id uuid, p_person_type text, p_person_id uuid, p_token_hash text,
  p_replace boolean default false
) returns jsonb
language plpgsql security invoker set search_path=''
as $function$
declare v_id uuid; v_status text; v_is_active boolean;
begin
  if auth.uid() is null or not public.has_school_role(p_school_id,array['admin']::public.school_role[]) then raise exception 'Admin access required'; end if;
  if p_person_type not in ('student','staff') or p_token_hash !~ '^[a-f0-9]{64}$' then raise exception 'Invalid QR credential'; end if;
  if not exists(select 1 from public.smart_access_settings s where s.school_id=p_school_id and ((p_person_type='student' and s.student_qr_enabled) or (p_person_type='staff' and s.staff_qr_enabled))) then raise exception 'QR attendance is not enabled'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_school_id::text || ':' || p_person_type || ':' || p_person_id::text,0));
  if p_person_type='student' then
    if not exists(select 1 from public.students where id=p_person_id and school_id=p_school_id and status='active') then raise exception 'Active student not found'; end if;
    select id,approval_status,is_active into v_id,v_status,v_is_active from public.attendance_qr_credentials where school_id=p_school_id and student_id=p_person_id order by created_at desc limit 1 for update;
  else
    if not exists(select 1 from public.staff where id=p_person_id and school_id=p_school_id and status='active') then raise exception 'Active staff member not found'; end if;
    select id,approval_status,is_active into v_id,v_status,v_is_active from public.attendance_qr_credentials where school_id=p_school_id and staff_id=p_person_id order by created_at desc limit 1 for update;
  end if;
  if v_id is not null and not p_replace then
    return jsonb_build_object('credential_id',v_id,'approval_status',v_status,'is_active',v_is_active,'already_exists',true);
  end if;
  if p_replace then
    if p_person_type='student' then
      update public.attendance_qr_credentials set is_active=false,revoked_at=now(),approval_status='revoked' where school_id=p_school_id and student_id=p_person_id and is_active;
    else
      update public.attendance_qr_credentials set is_active=false,revoked_at=now(),approval_status='revoked' where school_id=p_school_id and staff_id=p_person_id and is_active;
    end if;
  end if;
  if p_person_type='student' then
    insert into public.attendance_qr_credentials(school_id,person_type,student_id,token_hash,created_by,approval_status) values(p_school_id,'student',p_person_id,p_token_hash,auth.uid(),'pending') returning id into v_id;
  else
    insert into public.attendance_qr_credentials(school_id,person_type,staff_id,token_hash,created_by,approval_status) values(p_school_id,'staff',p_person_id,p_token_hash,auth.uid(),'pending') returning id into v_id;
  end if;
  return jsonb_build_object('credential_id',v_id,'issued_at',now(),'approval_status','pending','is_active',true,'already_exists',false,'replaced',p_replace);
end;
$function$;
revoke all on function public.resa_issue_attendance_qr(uuid,text,uuid,text,boolean) from public,anon;
grant execute on function public.resa_issue_attendance_qr(uuid,text,uuid,text,boolean) to authenticated;
