-- RESA Paystack is an optional, school-admin-controlled payment channel.
-- Defaults OFF. Secrets and test/live mode remain server-side Edge Function secrets.
create table if not exists public.resa_payment_gateway_settings (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null unique references public.schools(id) on delete restrict,
  paystack_enabled boolean not null default false,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.resa_payment_gateway_settings enable row level security;
revoke all on table public.resa_payment_gateway_settings from public, anon;
grant select, insert, update on table public.resa_payment_gateway_settings to authenticated;
drop policy if exists "School admins manage payment gateway settings" on public.resa_payment_gateway_settings;
create policy "School admins manage payment gateway settings"
  on public.resa_payment_gateway_settings
  for all to authenticated
  using (public.has_school_role(school_id, array['admin'::public.school_role]))
  with check (public.has_school_role(school_id, array['admin'::public.school_role]));

create table if not exists public.resa_payment_gateway_audit (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete restrict,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  old_values jsonb,
  new_values jsonb,
  created_at timestamptz not null default now()
);
create index if not exists resa_payment_gateway_audit_school_created_idx
  on public.resa_payment_gateway_audit (school_id, created_at desc);
alter table public.resa_payment_gateway_audit enable row level security;
revoke all on table public.resa_payment_gateway_audit from public, anon, authenticated;
grant select on table public.resa_payment_gateway_audit to authenticated;
drop policy if exists "School admins read payment gateway audit" on public.resa_payment_gateway_audit;
create policy "School admins read payment gateway audit"
  on public.resa_payment_gateway_audit
  for select to authenticated
  using (public.has_school_role(school_id, array['admin'::public.school_role]));

create or replace function public.audit_resa_payment_gateway_setting()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  insert into public.resa_payment_gateway_audit
    (school_id, actor_id, action, old_values, new_values)
  values (
    coalesce(new.school_id, old.school_id),
    auth.uid(),
    case when tg_op = 'INSERT' then 'created'
         when old.paystack_enabled is distinct from new.paystack_enabled then
           case when new.paystack_enabled then 'paystack_enabled' else 'paystack_disabled' end
         else 'settings_updated' end,
    case when tg_op = 'INSERT' then null else jsonb_build_object('paystack_enabled', old.paystack_enabled) end,
    jsonb_build_object('paystack_enabled', new.paystack_enabled, 'updated_by', new.updated_by)
  );
  return new;
end;
$function$;
revoke all on function public.audit_resa_payment_gateway_setting() from public, anon, authenticated;
drop trigger if exists resa_payment_gateway_settings_audit on public.resa_payment_gateway_settings;
create trigger resa_payment_gateway_settings_audit
  after insert or update on public.resa_payment_gateway_settings
  for each row execute function public.audit_resa_payment_gateway_setting();

comment on table public.resa_payment_gateway_settings is
  'Admin-controlled availability switch for optional Paystack checkout. Disabled by default; provider secrets remain in Edge Function secrets.';
comment on column public.resa_payment_gateway_settings.paystack_enabled is
  'When false, all new Paystack checkout initialization is blocked server-side. Offline school payment methods remain available.';
