create policy "Public visitors can read RESA Customer Care availability"
on public.resa_customer_care_settings
for select to anon
using (true);

grant select (
  school_id,
  availability_enabled,
  availability_days,
  availability_start,
  availability_end,
  timezone,
  website_popup_enabled,
  soft_sound_enabled
) on public.resa_customer_care_settings to anon;

create or replace view public.resa_customer_care_public_availability
with (security_invoker = true)
as
select
  school_id,
  availability_enabled,
  availability_days,
  availability_start,
  availability_end,
  timezone,
  website_popup_enabled,
  soft_sound_enabled
from public.resa_customer_care_settings;

grant select on public.resa_customer_care_public_availability to anon, authenticated;

revoke all on function public.get_resa_customer_care_availability(uuid) from public, anon, authenticated;
drop function public.get_resa_customer_care_availability(uuid);

create or replace function public.resolve_resa_customer_care_admin(p_school_id uuid, p_duty_key text default 'general')
returns uuid
language plpgsql
stable
set search_path = ''
as $function$
declare
  resolved_admin uuid;
begin
  if (select auth.uid()) is null then
    raise exception 'Sign in with an active RESA account to contact Customer Care';
  end if;

  if p_duty_key not in ('general','fees','admissions','cbt','results','attendance','technical') then
    raise exception 'Invalid Customer Care duty';
  end if;

  if not exists (
    select 1 from public.school_memberships m
    where m.school_id = p_school_id
      and m.user_id = (select auth.uid())
      and m.status = 'active'::public.membership_status
  ) then
    raise exception 'An active RESA membership is required to contact Customer Care';
  end if;

  resolved_admin := private.resa_resolve_customer_care_admin(p_school_id, p_duty_key);
  if resolved_admin is null then
    raise exception 'Customer Care is not currently assigned. Please try again later.';
  end if;
  return resolved_admin;
end;
$function$;

revoke all on function public.resolve_resa_customer_care_admin(uuid, text) from public, anon;
grant execute on function public.resolve_resa_customer_care_admin(uuid, text) to authenticated;
