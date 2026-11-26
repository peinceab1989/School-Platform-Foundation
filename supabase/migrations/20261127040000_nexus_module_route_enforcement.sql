-- Read-only module enforcement check for authenticated RESA members.
-- The function exposes only one boolean; Engine Room settings remain owner-only.

create or replace function public.nexus_module_is_enabled(p_module_key text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_enabled boolean;
begin
  if auth.uid() is null
    or p_module_key is null
    or length(p_module_key) > 100
    or p_module_key !~ '^[a-z0-9_]+$' then
    return false;
  end if;

  if not public.is_nexus_owner()
    and not exists (
      select 1 from public.school_memberships m
      where m.user_id = (select auth.uid())
        and m.status = 'active'
    ) then
    return false;
  end if;

  select c.is_enabled into v_enabled
  from public.nexus_module_controls c
  where c.module_key = p_module_key;

  return coalesce(v_enabled,true);
end;
$function$;

revoke all on function public.nexus_module_is_enabled(text) from public,anon;
grant execute on function public.nexus_module_is_enabled(text) to authenticated;

comment on function public.nexus_module_is_enabled(text) is
  'Returns only the enabled flag for one registered RESA module after verifying an authenticated active school member or Nexus owner. Used by the client route guard; backend data access remains protected by RLS and Edge Function authorization.';

update public.nexus_module_controls n
set settings = coalesce(n.settings,'{}'::jsonb) || jsonb_build_object(
  'enforcement_state','ui_route_enforced',
  'route',v.route,
  'health_state','unknown',
  'enforcement_note','The authenticated RESA route checks nexus_module_is_enabled before rendering. Database RLS and Edge Function permissions remain the backend security boundary.'
)
from (values
  ('resa_school_settings','/school-settings'),
  ('resa_admissions_management','/admissions-management'),
  ('resa_results_entry','/results-management'),
  ('resa_examinations','/examinations'),
  ('resa_external_cbt_management','/external-cbt-management'),
  ('resa_external_cbt','/external-cbt'),
  ('resa_results_publication','/my-results'),
  ('resa_student_cbt','/student-cbt'),
  ('resa_practice_drills','/practice-drills'),
  ('resa_biometric_attendance','/biometric-attendance'),
  ('resa_form_teacher_attendance','/form-teacher-attendance'),
  ('resa_staff_attendance','/staff-attendance'),
  ('resa_announcements','/announcements'),
  ('resa_communications_centre','/resa-chat'),
  ('resa_notifications','/notifications'),
  ('resa_school_communication','/school-communication'),
  ('resa_admin_dashboard','/admin'),
  ('resa_parent_dashboard','/parent-dashboard'),
  ('resa_student_dashboard','/student-dashboard'),
  ('resa_teacher_dashboard','/teacher-dashboard'),
  ('resa_payments_gateway','/payment-gateway-settings'),
  ('resa_fees_management','/fees-management'),
  ('resa_portal_options','/portal-options'),
  ('resa_parent_authorisations','/parent-authorizations'),
  ('resa_smart_access','/smart-access-management'),
  ('resa_student_id_cards','/student-id-cards'),
  ('resa_technical_operations','/technical-operations'),
  ('resa_test_data','/test-data-setup'),
  ('resa_publication_centre','/publication-centre'),
  ('resa_school_reports','/school-reports'),
  ('resa_password_reset','/reset-password'),
  ('resa_school_cctv','/school-cctv'),
  ('resa_hr_management','/hr-management'),
  ('resa_invitation_acceptance','/accept-invitation'),
  ('resa_staff_invitations','/staff-invitations'),
  ('resa_parent_management','/parent-management'),
  ('resa_student_records','/students'),
  ('resa_technical_support','/technical-support'),
  ('resa_assignments','/assignments'),
  ('resa_classes','/classes'),
  ('resa_subjects','/subjects'),
  ('resa_teaching_assignments','/teaching-assignments'),
  ('resa_teaching_materials','/teaching-materials'),
  ('resa_maps','/maps'),
  ('resa_student_enrolments','/student-enrolments'),
  ('resa_drive','/resa-drive')
) as v(module_key,route)
where n.module_key = v.module_key;

update public.nexus_module_controls n
set settings = coalesce(n.settings,'{}'::jsonb) || jsonb_build_object(
  'enforcement_state','alias',
  'alias_of',v.canonical_key,
  'health_state','unknown',
  'enforcement_note','Legacy catalogue alias. The canonical module key controls the actual route.'
)
from (values
  ('account_activation','resa_invitation_acceptance'),
  ('admissions','resa_admissions_management'),
  ('ai_practice','resa_practice_drills'),
  ('attendance','resa_attendance'),
  ('biometric_attendance','resa_biometric_attendance'),
  ('cbt','resa_examinations'),
  ('classes_subjects','resa_classes'),
  ('fees','resa_fees_management'),
  ('form_teacher_attendance','resa_form_teacher_attendance'),
  ('hr_recruitment','resa_hr_management'),
  ('notifications','resa_notifications'),
  ('parent_portal','resa_parent_dashboard'),
  ('public_website','resa_public_home'),
  ('reports','resa_school_reports'),
  ('results','resa_results_entry'),
  ('staff','resa_hr_management'),
  ('staff_invitations','resa_staff_invitations'),
  ('student_cbt','resa_student_cbt'),
  ('student_password_management','resa_password_reset'),
  ('student_portal','resa_student_dashboard'),
  ('students','resa_student_records'),
  ('announcements','resa_announcements'),
  ('school_communication','resa_school_communication'),
  ('parent_authorizations','resa_parent_authorisations'),
  ('staff_id_cards','resa_staff_id_cards'),
  ('student_id_cards','resa_student_id_cards'),
  ('assignments','resa_assignments'),
  ('teaching_materials','resa_teaching_materials'),
  ('timetable','resa_timetable'),
  ('resa_school_calendar','school_calendar')
) as v(module_key,canonical_key)
where n.module_key = v.module_key;

update public.nexus_module_controls
set settings = coalesce(settings,'{}'::jsonb) || jsonb_build_object(
  'enforcement_state','registry_only',
  'health_state','unknown',
  'enforcement_note','No verified standalone library/inventory route is currently wired. This entry is catalogue-only.'
)
where module_key = 'library_inventory';
