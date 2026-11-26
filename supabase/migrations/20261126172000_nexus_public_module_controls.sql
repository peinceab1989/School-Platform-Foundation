-- Safe public boolean gate for explicitly allow-listed RESA website/app sections.
-- It exposes no registry rows, names, metadata or private control settings.

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
    'resa_public_home',
    'resa_about',
    'resa_academics',
    'resa_innovation_technology',
    'resa_practical_skills',
    'resa_wisdom_inspiration',
    'resa_activities_gallery',
    'resa_public_admissions',
    'resa_public_contact',
    'resa_admissions_application',
    'resa_cbt_registration',
    'resa_maps',
    'resa_portal_options',
    'resa_practice_drills'
  ) then
    return false;
  end if;

  select c.is_enabled into v_enabled
  from public.nexus_module_controls c
  where c.module_key = p_module_key;

  return coalesce(v_enabled,false);
end;
$function$;

revoke all on function public.nexus_public_module_is_enabled(text) from public;
grant execute on function public.nexus_public_module_is_enabled(text) to anon,authenticated;

comment on function public.nexus_public_module_is_enabled(text) is
  'Returns only the enabled boolean for a fixed allow-list of public RESA sections. Does not expose Engine Room metadata.';

update public.nexus_module_controls
set settings = coalesce(settings,'{}'::jsonb) || jsonb_build_object(
  'enforcement_state','component_enforced',
  'health_state','unknown',
  'enforcement_note','A dedicated public route gate checks nexus_public_module_is_enabled before rendering this page.'
)
where module_key in (
  'resa_public_home',
  'resa_about',
  'resa_academics',
  'resa_innovation_technology',
  'resa_practical_skills',
  'resa_wisdom_inspiration',
  'resa_activities_gallery',
  'resa_public_admissions',
  'resa_public_contact',
  'resa_admissions_application',
  'resa_cbt_registration',
  'resa_maps',
  'resa_portal_options',
  'resa_practice_drills'
);
