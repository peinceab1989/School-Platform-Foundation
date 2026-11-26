create or replace function public.nexus_public_module_is_enabled(p_module_key text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_enabled boolean;
begin
  if p_module_key is null or p_module_key not in (
    'resa_public_home','resa_about','resa_academics','resa_innovation_technology',
    'resa_practical_skills','resa_wisdom_inspiration','resa_activities_gallery',
    'resa_public_admissions','resa_public_contact','resa_admissions_application',
    'resa_cbt_registration','resa_maps','resa_portal_options','resa_practice_drills',
    'resa_public_customer_care','resa_public_ask','resa_pwa_install'
  ) then
    return false;
  end if;
  select c.is_enabled into v_enabled from public.nexus_module_controls c where c.module_key=p_module_key;
  return coalesce(v_enabled,false);
end;
$function$;

update public.nexus_module_controls
set settings=coalesce(settings,'{}'::jsonb)||jsonb_build_object(
  'enforcement_state','component_enforced',
  'health_state','unknown',
  'enforcement_note','The install prompt checks the public module gate. Disabling the prompt does not unregister the service worker or disable existing installed apps.'
)
where module_key='resa_pwa_install';

update public.nexus_module_controls
set settings=coalesce(settings,'{}'::jsonb)||jsonb_build_object(
  'enforcement_state','alias',
  'alias_of','resa_pwa_install',
  'health_state','unknown',
  'enforcement_note','Legacy PWA installation catalogue alias; the canonical RESA PWA install module controls the install prompt.'
)
where module_key='pwa_installation';

update public.nexus_module_controls
set settings=coalesce(settings,'{}'::jsonb)||jsonb_build_object(
  'enforcement_state','edge_function_enforced',
  'health_state','unknown',
  'enforcement_note','The push-dispatch Edge Function checks this owner-controlled module switch before sending any push notification.'
)
where module_key='resa_push_delivery';

update public.nexus_module_controls
set settings=coalesce(settings,'{}'::jsonb)||jsonb_build_object(
  'enforcement_state','monitor_only',
  'health_state','unknown',
  'enforcement_note','Shared platform dependency. It must not be disabled as an ordinary feature; health reporting is informational.'
)
where module_key in (
  'activity_audit','shared_cloudflare_pages','shared_cloudflare_workers',
  'shared_database_rls','shared_edge_functions','shared_external_integrations',
  'shared_realtime','shared_scheduled_jobs','shared_storage','shared_supabase_auth'
);

update public.nexus_module_controls
set settings=coalesce(settings,'{}'::jsonb)||jsonb_build_object(
  'enforcement_state','critical_always_on',
  'health_state','unknown',
  'enforcement_note','Critical authentication, account recovery, administrator dashboard or access-control service. It cannot be disabled from Engine Room.'
)
where module_key in (
  'resa_admin_dashboard','resa_authentication','resa_invitation_acceptance',
  'resa_password_reset','user_access_management'
);

update public.nexus_module_controls
set settings=coalesce(settings,'{}'::jsonb)||jsonb_build_object(
  'enforcement_state','external_surface',
  'health_state','unknown',
  'enforcement_note','This product or website surface is managed by its own JETAB TECH deployment, not by the RESA portal switchboard.'
)
where module_key in (
  'jetab_ai_product','resa_digital_campus_product','website_community',
  'website_contact_enquiry','website_faq','website_home',
  'website_mobile_navigation','website_seo_publication','website_service_catalogue'
);
