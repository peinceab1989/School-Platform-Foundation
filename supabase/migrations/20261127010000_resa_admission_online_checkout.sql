-- Secure online admission-form checkout foundation.
-- Price is intentionally NULL until RESA confirms the existing approved amount.
-- Paystack remains unavailable until proprietor-controlled gateway settings are enabled.

create table if not exists public.school_admission_settings (
  school_id uuid primary key references public.schools(id) on delete cascade,
  form_price numeric(12,2),
  currency text not null default 'NGN' check (currency = 'NGN'),
  online_checkout_enabled boolean not null default false,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  constraint school_admission_form_price_positive check (form_price is null or form_price > 0)
);

insert into public.school_admission_settings (school_id,form_price,currency,online_checkout_enabled)
values ('469a9ed9-8e6c-45b8-a76c-89536adb1d3d',null,'NGN',false)
on conflict (school_id) do nothing;

alter table public.school_admission_settings enable row level security;
drop policy if exists "School admins manage admission settings" on public.school_admission_settings;
create policy "School admins manage admission settings"
  on public.school_admission_settings for all to authenticated
  using (public.has_school_role(school_id,array['admin'::public.school_role]))
  with check (public.has_school_role(school_id,array['admin'::public.school_role]));
grant select,insert,update on public.school_admission_settings to authenticated;
grant all on public.school_admission_settings to service_role;
grant select,insert,update on public.external_candidate_form_purchases to service_role;

create table if not exists public.admission_form_payment_intents (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  buyer_email text not null,
  buyer_phone text not null,
  applicant_name text not null,
  class_applied_for text not null,
  parent_name text not null,
  parent_email text,
  amount numeric(12,2) not null check (amount > 0),
  amount_minor bigint not null check (amount_minor > 0),
  currency text not null default 'NGN' check (currency = 'NGN'),
  provider text not null default 'paystack' check (provider = 'paystack'),
  payment_environment text not null check (payment_environment in ('test','live')),
  provider_reference text not null unique,
  provider_transaction_id text,
  client_request_key uuid not null,
  checkout_url text,
  status text not null default 'pending' check (status in ('pending','processing','paid','expired','failed')),
  form_purchase_id uuid references public.external_candidate_form_purchases(id) on delete restrict,
  expires_at timestamptz not null,
  paid_at timestamptz,
  failure_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint admission_form_intent_paid_shape check (
    (status = 'paid' and form_purchase_id is not null and paid_at is not null)
    or status <> 'paid'
  ),
  constraint admission_form_intent_school_request_unique unique (school_id,client_request_key)
);

create unique index if not exists admission_form_intent_provider_transaction_uidx
  on public.admission_form_payment_intents(provider,provider_transaction_id)
  where provider_transaction_id is not null;
create index if not exists admission_form_intent_status_expiry_idx
  on public.admission_form_payment_intents(school_id,status,expires_at);

alter table public.admission_form_payment_intents enable row level security;
revoke all on public.admission_form_payment_intents from public,anon,authenticated;
grant all on public.admission_form_payment_intents to service_role;

-- Paystack-verified purchases are system-created; staff verification remains
-- attributable to the staff user for manually confirmed bank/cash payments.
alter table public.external_candidate_form_purchases
  alter column verified_by drop not null,
  alter column created_by drop not null;

create or replace function public.set_school_admission_settings_actor()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $function$
begin
  if auth.uid() is not null then
    new.updated_by := auth.uid();
  end if;
  new.updated_at := now();
  return new;
end;
$function$;

drop trigger if exists school_admission_settings_set_actor on public.school_admission_settings;
create trigger school_admission_settings_set_actor
  before insert or update on public.school_admission_settings
  for each row execute function public.set_school_admission_settings_actor();
revoke all on function public.set_school_admission_settings_actor() from public,anon,authenticated;

drop trigger if exists school_admission_settings_nexus_audit on public.school_admission_settings;
create trigger school_admission_settings_nexus_audit
  after insert or update or delete on public.school_admission_settings
  for each row execute function public.nexus_audit_row_change();

create or replace function public.record_verified_admission_form_purchase(
  p_intent_id uuid,
  p_provider_transaction_id text,
  p_verified_amount_minor bigint,
  p_verified_currency text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_intent public.admission_form_payment_intents%rowtype;
  v_purchase public.external_candidate_form_purchases%rowtype;
  v_form_number text;
  v_receipt_number text;
  v_now timestamptz := clock_timestamp();
begin
  if coalesce(p_provider_transaction_id,'') = '' then
    raise exception 'A verified provider transaction ID is required';
  end if;

  select * into v_intent
  from public.admission_form_payment_intents
  where id = p_intent_id
  for update;

  if not found then
    raise exception 'Admission payment intent not found';
  end if;

  if v_intent.status = 'paid' then
    select * into v_purchase
    from public.external_candidate_form_purchases
    where id = v_intent.form_purchase_id;
    if not found then
      raise exception 'Paid admission intent has no form purchase; reconciliation is required';
    end if;
    return jsonb_build_object(
      'success',true,'already_processed',true,
      'form_number',v_purchase.form_number,'receipt_number',v_purchase.receipt_number,
      'form_purchase_id',v_purchase.id
    );
  end if;

  if p_verified_currency <> 'NGN'
    or p_verified_amount_minor <> v_intent.amount_minor
    or round(v_intent.amount * 100)::bigint <> v_intent.amount_minor then
    raise exception 'Verified provider amount or currency does not match the admission intent';
  end if;

  if exists (
    select 1 from public.admission_form_payment_intents other
    where other.provider = v_intent.provider
      and other.provider_transaction_id = p_provider_transaction_id
      and other.id <> v_intent.id
  ) then
    raise exception 'Provider transaction has already been applied to another intent';
  end if;

  v_form_number := 'RESA-ADM-F-' || to_char(v_now at time zone 'Africa/Lagos','YYYY') || '-' ||
    upper(substr(replace(gen_random_uuid()::text,'-',''),1,16));
  v_receipt_number := 'RESA-FR-' || to_char(v_now at time zone 'Africa/Lagos','YYYY') || '-' ||
    upper(substr(replace(gen_random_uuid()::text,'-',''),1,16));

  insert into public.external_candidate_form_purchases (
    school_id,form_number,form_type,amount_paid,payment_reference,receipt_number,paid_at,
    verification_status,verified_by,verified_at,created_by
  ) values (
    v_intent.school_id,v_form_number,'admission',v_intent.amount,
    v_intent.provider_reference,v_receipt_number,(v_now at time zone 'Africa/Lagos')::date,
    'verified',null,v_now,null
  )
  returning * into v_purchase;

  update public.admission_form_payment_intents
  set status = 'paid',
      provider_transaction_id = p_provider_transaction_id,
      form_purchase_id = v_purchase.id,
      paid_at = v_now,
      updated_at = v_now,
      failure_code = null
  where id = v_intent.id;

  return jsonb_build_object(
    'success',true,'already_processed',false,
    'form_number',v_purchase.form_number,'receipt_number',v_purchase.receipt_number,
    'form_purchase_id',v_purchase.id
  );
end;
$function$;

revoke all on function public.record_verified_admission_form_purchase(uuid,text,bigint,text) from public,anon,authenticated;
grant execute on function public.record_verified_admission_form_purchase(uuid,text,bigint,text) to service_role;

comment on table public.school_admission_settings is 'Administrator-controlled admission form price and online checkout switch. Price remains unset until confirmed by RESA.';
comment on table public.admission_form_payment_intents is 'Private, short-lived Paystack admission checkout intents. A form number is issued only by the verified-payment RPC.';

drop trigger if exists admission_form_payment_intents_nexus_audit on public.admission_form_payment_intents;
create trigger admission_form_payment_intents_nexus_audit
  after insert or update or delete on public.admission_form_payment_intents
  for each row execute function public.nexus_audit_row_change();
