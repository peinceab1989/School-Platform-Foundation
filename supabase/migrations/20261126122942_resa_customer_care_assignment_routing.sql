create or replace function private.resa_resolve_customer_care_admin(p_school_id uuid, p_duty_key text)
returns uuid
language sql
stable
security definer
set search_path = ''
as $function$
  select coalesce(
    (
      select a.admin_user_id
      from public.resa_customer_care_assignments a
      join public.school_memberships m
        on m.school_id = a.school_id
       and m.user_id = a.admin_user_id
       and m.status = 'active'::public.membership_status
       and m.role = 'admin'::public.school_role
      where a.school_id = p_school_id
        and a.enabled
        and a.duty_key in (p_duty_key, 'all')
      order by case when a.duty_key = p_duty_key then 0 else 1 end, a.assigned_at desc
      limit 1
    ),
    (
      select s.chief_admin_user_id
      from public.resa_customer_care_settings s
      join public.school_memberships m
        on m.school_id = s.school_id
       and m.user_id = s.chief_admin_user_id
       and m.status = 'active'::public.membership_status
       and m.role = 'admin'::public.school_role
      where s.school_id = p_school_id
    )
  );
$function$;

revoke all on function private.resa_resolve_customer_care_admin(uuid, text) from public, anon;
grant execute on function private.resa_resolve_customer_care_admin(uuid, text) to authenticated;

create or replace function public.resolve_resa_customer_care_admin(p_school_id uuid, p_duty_key text default 'general')
returns uuid
language plpgsql
stable
security definer
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

create or replace function private.enforce_admin_only_customer_care_conversations()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  sender_role public.school_role;
  recipient_role public.school_role;
  assigned_admin uuid;
begin
  if new.conversation_type <> 'admin_support' then
    return new;
  end if;

  if (select auth.uid()) is null
     or new.created_by is distinct from (select auth.uid())
     or new.participant_one is distinct from (select auth.uid())
     or new.participant_one = new.participant_two then
    raise exception 'Customer Care conversations must be opened by the signed-in school member';
  end if;

  select membership.role into sender_role
  from public.school_memberships membership
  where membership.school_id = new.school_id
    and membership.user_id = (select auth.uid())
    and membership.status = 'active'::public.membership_status
  limit 1;

  select membership.role into recipient_role
  from public.school_memberships membership
  where membership.school_id = new.school_id
    and membership.user_id = new.participant_two
    and membership.status = 'active'::public.membership_status
  limit 1;

  if sender_role is null then
    raise exception 'An active school membership is required to contact Customer Care';
  end if;

  if recipient_role is distinct from 'admin'::public.school_role then
    raise exception 'Customer Care conversations can only be addressed to an active school administrator';
  end if;

  assigned_admin := private.resa_resolve_customer_care_admin(new.school_id, new.customer_care_duty);
  if assigned_admin is null or new.participant_two is distinct from assigned_admin then
    raise exception 'This Customer Care request must be routed to the administrator assigned to this duty';
  end if;

  return new;
end;
$function$;
