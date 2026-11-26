-- Keep the new attribution rule scoped to admission forms.
-- External CBT form purchases continue using their existing verification workflow.

create or replace function public.enforce_external_form_purchase_verification_source()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $function$
begin
  if new.form_type <> 'admission' then
    return new;
  end if;

  if auth.uid() is not null then
    if new.verification_source <> 'manual'
      or new.verified_by is distinct from auth.uid()
      or new.created_by is distinct from auth.uid() then
      raise exception 'Manual admission form verification must be attributed to the signed-in school administrator.';
    end if;
    return new;
  end if;

  if auth.role() = 'service_role'
    and new.verification_source = 'paystack'
    and new.verified_by is null
    and new.created_by is null then
    return new;
  end if;

  raise exception 'Admission form purchases must be verified by a signed-in administrator or the trusted Paystack settlement handler.';
end;
$function$;

drop trigger if exists external_form_purchase_verification_source_guard on public.external_candidate_form_purchases;
create trigger external_form_purchase_verification_source_guard
  before insert or update of form_type,verification_source,verified_by,created_by
  on public.external_candidate_form_purchases
  for each row execute function public.enforce_external_form_purchase_verification_source();

revoke all on function public.enforce_external_form_purchase_verification_source() from public,anon,authenticated;
