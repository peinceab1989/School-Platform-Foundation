revoke select on public.resa_customer_care_settings from authenticated;
grant select (
  school_id,
  availability_enabled,
  availability_days,
  availability_start,
  availability_end,
  timezone,
  website_popup_enabled,
  soft_sound_enabled
) on public.resa_customer_care_settings to authenticated;
grant update on public.resa_customer_care_settings to authenticated;

drop policy if exists "RESA members can read public Customer Care schedule" on public.resa_customer_care_settings;
create policy "RESA members can read public Customer Care schedule"
on public.resa_customer_care_settings
for select to authenticated
using (
  exists (
    select 1 from public.school_memberships m
    where m.school_id = resa_customer_care_settings.school_id
      and m.user_id = (select auth.uid())
      and m.status = 'active'::public.membership_status
  )
);

create or replace function public.resa_is_chief_admin(p_school_id uuid)
returns boolean
language sql
stable
set search_path = ''
as $function$
  select private.is_resa_chief_admin(p_school_id, (select auth.uid()));
$function$;

revoke all on function public.resa_is_chief_admin(uuid) from public, anon;
grant execute on function public.resa_is_chief_admin(uuid) to authenticated;
