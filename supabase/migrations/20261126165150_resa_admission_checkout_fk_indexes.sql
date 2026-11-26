-- Index the new admission-checkout foreign keys and make the private intent denial explicit.
create index if not exists admission_form_payment_intents_form_purchase_idx
  on public.admission_form_payment_intents(form_purchase_id)
  where form_purchase_id is not null;

create index if not exists school_admission_settings_updated_by_idx
  on public.school_admission_settings(updated_by)
  where updated_by is not null;

drop policy if exists "Deny direct admission intent access" on public.admission_form_payment_intents;
create policy "Deny direct admission intent access"
  on public.admission_form_payment_intents for all to anon,authenticated
  using (false)
  with check (false);
