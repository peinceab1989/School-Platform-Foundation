-- Restrict child-release teachers to their assigned learners and revalidate
-- parent QR account status at the point of collection/event check-in.

CREATE OR REPLACE FUNCTION public.resa_record_child_collection_release(p_school_id uuid, p_student_id uuid, p_collector_full_name text, p_collector_relationship text, p_verification_method text, p_verification_note text, p_authorization_id uuid DEFAULT NULL::uuid, p_parent_qr_hash text DEFAULT NULL::text, p_station_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_parent_id uuid; v_auth public.child_collection_authorizations%rowtype; v_release_id uuid;
begin
 if auth.uid() is null or not public.has_school_role(p_school_id,array['admin','teacher']::public.school_role[]) then
  raise exception 'School staff permission is required'; end if;
 if not exists(select 1 from public.smart_access_settings s where s.school_id=p_school_id and s.child_pickup_enabled) then
  raise exception 'Child collection is disabled by the school'; end if;
 if length(trim(coalesce(p_collector_full_name,'')))<2 or length(trim(coalesce(p_verification_note,'')))<3 then
  raise exception 'Collector name and verification note are required'; end if;
 if not exists(select 1 from public.students s where s.id=p_student_id and s.school_id=p_school_id and s.status='active') then
  raise exception 'Active student not found'; end if;
 if not public.has_school_role(p_school_id,array['admin']::public.school_role[])
   and not public.can_access_student_record(p_school_id,p_student_id) then
  raise exception 'Teachers can release learners only in their assigned classes and sessions'; end if;
 if p_station_id is not null and not exists(select 1 from public.biometric_devices d where d.id=p_station_id and d.school_id=p_school_id and d.is_active) then
  raise exception 'Invalid attendance station'; end if;
 if p_authorization_id is not null then
  select * into v_auth from public.child_collection_authorizations
  where id=p_authorization_id and school_id=p_school_id and student_id=p_student_id for update;
  if not found or v_auth.approval_status<>'approved' or v_auth.consumed_at is not null
    or v_auth.valid_from>now() or (v_auth.valid_until is not null and v_auth.valid_until<=now()) then
   raise exception 'No valid unused approved collection authorization'; end if;
  if lower(trim(v_auth.collector_full_name))<>lower(trim(p_collector_full_name)) then
   raise exception 'Collector name does not match authorization'; end if;
  if p_verification_method<>'approved_collector' then raise exception 'Use approved collector verification'; end if;
  v_parent_id:=v_auth.parent_guardian_id;
  update public.child_collection_authorizations set consumed_at=now(),consumed_by=auth.uid() where id=v_auth.id;
 elsif p_verification_method='parent_qr' then
  if p_parent_qr_hash !~ '^[a-f0-9]{64}$' then raise exception 'Invalid parent QR'; end if;
  select q.parent_guardian_id into v_parent_id from public.parent_qr_credentials q
  join public.parent_student_portal_access l on l.school_id=q.school_id and l.parent_guardian_id=q.parent_guardian_id
  join public.student_parent_guardians rel on rel.school_id=q.school_id and rel.parent_guardian_id=q.parent_guardian_id and rel.student_id=p_student_id
  join public.parent_portal_accounts account on account.school_id=q.school_id and account.parent_guardian_id=q.parent_guardian_id and account.is_active
  join public.school_memberships membership on membership.school_id=account.school_id and membership.user_id=account.user_id
    and membership.role='parent'::public.school_role and membership.status='active'::public.membership_status
  join public.parents_guardians guardian on guardian.id=q.parent_guardian_id and guardian.school_id=q.school_id and guardian.portal_enabled
  where q.school_id=p_school_id and q.token_hash=p_parent_qr_hash and q.is_active
   and l.student_id=p_student_id and l.is_active;
  if not found then raise exception 'Parent QR is invalid, revoked, inactive or not linked to this student'; end if;
 elsif p_verification_method<>'manual_verified' then
  raise exception 'Approved authorization, linked parent QR or documented manual verification is required';
 end if;
 insert into public.child_collection_releases(school_id,student_id,parent_guardian_id,authorization_id,
  collector_full_name,collector_relationship,verification_method,released_by,station_id,verification_note)
 values(p_school_id,p_student_id,v_parent_id,p_authorization_id,trim(p_collector_full_name),
  nullif(trim(coalesce(p_collector_relationship,'')),''),p_verification_method,auth.uid(),p_station_id,trim(p_verification_note))
 returning id into v_release_id;
 return jsonb_build_object('success',true,'release_id',v_release_id,'released_at',now());
end;
$function$;

CREATE OR REPLACE FUNCTION public.resa_record_parent_event_checkin(p_school_id uuid, p_event_id uuid, p_parent_qr_hash text, p_station_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_parent_id uuid; v_event public.school_access_events%rowtype; v_id uuid;
begin
 if auth.uid() is null or not public.has_school_role(p_school_id,array['admin','teacher']::public.school_role[]) then raise exception 'Staff access required'; end if;
 if p_parent_qr_hash !~ '^[a-f0-9]{64}$' then raise exception 'Invalid parent QR'; end if;
 if not exists(select 1 from public.smart_access_settings s where s.school_id=p_school_id and s.parent_events_enabled and s.parent_qr_enabled) then
  raise exception 'Parent event QR is disabled'; end if;
 select * into v_event from public.school_access_events where id=p_event_id and school_id=p_school_id
  and is_open_for_registration and starts_at<=now() and (ends_at is null or ends_at>now());
 if not found then raise exception 'Event is not open for check-in'; end if;
 select q.parent_guardian_id into v_parent_id from public.parent_qr_credentials q
 join public.parent_portal_accounts account on account.school_id=q.school_id and account.parent_guardian_id=q.parent_guardian_id and account.is_active
 join public.school_memberships membership on membership.school_id=account.school_id and membership.user_id=account.user_id
  and membership.role='parent'::public.school_role and membership.status='active'::public.membership_status
 join public.parents_guardians guardian on guardian.id=q.parent_guardian_id and guardian.school_id=q.school_id and guardian.portal_enabled
 where q.school_id=p_school_id and q.token_hash=p_parent_qr_hash and q.is_active;
 if not found then raise exception 'Parent QR is invalid, revoked or the parent portal account is inactive'; end if;
 if p_station_id is not null and not exists(select 1 from public.biometric_devices d where d.id=p_station_id and d.school_id=p_school_id and d.is_active) then
  raise exception 'Invalid attendance station'; end if;
 insert into public.school_access_event_attendance(school_id,event_id,parent_guardian_id,recorded_by,station_id)
 values(p_school_id,p_event_id,v_parent_id,auth.uid(),p_station_id)
 on conflict(event_id,parent_guardian_id) do nothing returning id into v_id;
 if v_id is null then raise exception 'Parent already checked in for this event'; end if;
 return jsonb_build_object('success',true,'attendance_id',v_id,'event_name',v_event.event_name,'checked_in_at',now());
end;
$function$;
