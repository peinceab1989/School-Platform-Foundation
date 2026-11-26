-- Distinguish human-verified manual admission form purchases from Paystack-verified purchases.
-- Existing manual purchases retain their human attribution.

alter table public.external_candidate_form_purchases
  add column if not exists verification_source text not null default 'manual';

alter table public.external_candidate_form_purchases
  add constraint external_form_purchase_verification_source_check
  check (
    (verification_source = 'manual' and verified_by is not null and created_by is not null)
    or
    (verification_source = 'paystack' and verified_by is null and created_by is null)
  );

create or replace function public.enforce_external_form_purchase_verification_source()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $function$
begin
  if auth.uid() is not null then
    if new.verification_source <> 'manual'
      or new.verified_by is distinct from auth.uid()
      or new.created_by is distinct from auth.uid() then
      raise exception 'Manual admission form verification must be attributed to the signed-in school administrator.';
    end if;
  elsif new.verification_source <> 'paystack' then
    raise exception 'System-created admission form purchases must use the verified Paystack path.';
  end if;
  return new;
end;
$function$;

drop trigger if exists external_form_purchase_verification_source_guard on public.external_candidate_form_purchases;
create trigger external_form_purchase_verification_source_guard
  before insert or update of verification_source,verified_by,created_by on public.external_candidate_form_purchases
  for each row execute function public.enforce_external_form_purchase_verification_source();

revoke all on function public.enforce_external_form_purchase_verification_source() from public,anon,authenticated;

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
    verification_status,verified_by,verified_at,created_by,verification_source
  ) values (
    v_intent.school_id,v_form_number,'admission',v_intent.amount,
    v_intent.provider_reference,v_receipt_number,(v_now at time zone 'Africa/Lagos')::date,
    'verified',null,v_now,null,'paystack'
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
