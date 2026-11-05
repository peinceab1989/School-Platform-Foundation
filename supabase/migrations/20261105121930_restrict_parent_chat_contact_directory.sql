create or replace function public.get_school_message_contacts(p_school_id uuid)
returns table(user_id uuid, role public.school_role, display_name text)
language sql
stable
security definer
set search_path = ''
as $function$
  select
    m.user_id,
    m.role,
    coalesce(nullif(p.display_name, ''), initcap(m.role::text) || ' member') as display_name
  from public.school_memberships m
  left join public.profiles p on p.id = m.user_id
  where m.school_id = p_school_id
    and m.status = 'active'::public.membership_status
    and auth.uid() is not null
    and exists (
      select 1
      from public.school_memberships me
      where me.school_id = p_school_id
        and me.user_id = auth.uid()
        and me.status = 'active'::public.membership_status
        and (
          me.role = 'admin'::public.school_role
          or (me.role = 'parent'::public.school_role and m.role = 'admin'::public.school_role)
        )
    )
  order by display_name;
$function$;

revoke all on function public.get_school_message_contacts(uuid) from public, anon;
grant execute on function public.get_school_message_contacts(uuid) to authenticated;