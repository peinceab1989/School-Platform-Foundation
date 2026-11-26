-- Correct the enforcement inventory to match the actual AppRoutes entry points.
-- Do not label direct standalone pages as route-enforced until their own guard is wired.

update public.nexus_module_controls
set settings = coalesce(settings,'{}'::jsonb) || jsonb_build_object(
  'enforcement_state','registry_only',
  'health_state','unknown',
  'enforcement_note','The route is rendered outside the shared FoundationPage guard. Keep the switch locked until a dedicated route/component guard is implemented.'
)
where module_key in (
  'resa_maps',
  'resa_portal_options',
  'resa_practice_drills',
  'resa_test_data',
  'resa_password_reset',
  'resa_invitation_acceptance',
  'resa_admin_dashboard'
);

update public.nexus_module_controls
set settings = coalesce(settings,'{}'::jsonb) || jsonb_build_object(
  'enforcement_state','ui_route_enforced',
  'route','/attendance',
  'health_state','unknown',
  'enforcement_note','The authenticated /attendance route checks nexus_module_is_enabled before rendering.'
)
where module_key = 'resa_attendance';

update public.nexus_module_controls
set settings = coalesce(settings,'{}'::jsonb) || jsonb_build_object(
  'enforcement_state','alias',
  'alias_of','resa_notifications',
  'health_state','unknown',
  'enforcement_note','Legacy absence-alert catalogue entry. The canonical notifications module controls the route.'
)
where module_key = 'resa_absence_alerts';
