-- Public Customer Care is independently controlled at the visitor intake Edge Function.
-- Existing visitor conversations and administrator replies remain available when new intake is paused.

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
    'resa_practice_drills',
    'resa_public_customer_care'
  ) then
    return false;
  end if;

  select c.is_enabled into v_enabled
  from public.nexus_module_controls c
  where c.module_key = p_module_key;

  return coalesce(v_enabled,false);
end;
$function$;

update public.nexus_module_controls
set settings = coalesce(settings,'{}'::jsonb) || jsonb_build_object(
  'enforcement_state','edge_function_enforced',
  'health_state','unknown',
  'enforcement_note','The visitor_start action checks the public boolean gate. Existing conversations and admin replies remain available when new intake is paused.'
)
where module_key = 'resa_public_customer_care';
