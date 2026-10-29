-- Allow administrators to independently enable or disable the public floating customer-care widget.
alter table public.resa_chat_settings
  add column if not exists customer_care_enabled boolean not null default true;

insert into public.resa_chat_settings (school_id, chat_enabled, customer_care_enabled)
select id, false, true from public.schools
on conflict (school_id) do update
set customer_care_enabled = coalesce(public.resa_chat_settings.customer_care_enabled, true);

create or replace function public.get_public_customer_care_status(p_school_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select s.customer_care_enabled
     from public.resa_chat_settings s
     where s.school_id = p_school_id),
    true
  );
$$;

revoke all on function public.get_public_customer_care_status(uuid) from public;
grant execute on function public.get_public_customer_care_status(uuid) to anon, authenticated;
