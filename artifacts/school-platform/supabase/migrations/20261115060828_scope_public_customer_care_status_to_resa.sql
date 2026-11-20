-- Restrict the public customer-care status RPC to RESA's public website school.
-- The function remains callable for the public widget, but arbitrary school IDs
-- cannot be used to probe customer-care settings across tenants.

create or replace function public.get_public_customer_care_status(p_school_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select case
    when p_school_id = '469a9ed9-8e6c-45b8-a76c-89536adb1d3d'::uuid then
      coalesce(
        (
          select s.customer_care_enabled
          from public.resa_chat_settings as s
          where s.school_id = '469a9ed9-8e6c-45b8-a76c-89536adb1d3d'::uuid
        ),
        true
      )
    else false
  end;
$function$;

revoke all on function public.get_public_customer_care_status(uuid) from public;
grant execute on function public.get_public_customer_care_status(uuid) to anon, authenticated;
