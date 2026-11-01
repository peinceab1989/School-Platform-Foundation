-- Public admission application workflow backed by school-issued, verified forms.
-- The public endpoint validates the form purchase before creating any application.

begin;

alter table public.admission_applications
  add column if not exists form_purchase_id uuid
  references public.external_candidate_form_purchases(id) on delete restrict;

create unique index if not exists admission_applications_form_purchase_uidx
  on public.admission_applications (form_purchase_id)
  where form_purchase_id is not null;

create unique index if not exists admission_applications_number_uidx
  on public.admission_applications (school_id, application_number)
  where application_number is not null and length(trim(application_number)) > 0;

alter table public.external_candidate_form_purchases
  add column if not exists redeemed_by_application_id uuid
  references public.admission_applications(id) on delete set null;

create table if not exists public.admission_application_rate_events (
  id uuid primary key default gen_random_uuid(),
  rate_key text not null,
  created_at timestamptz not null default now()
);
create index if not exists admission_application_rate_events_idx
  on public.admission_application_rate_events (rate_key, created_at desc);
alter table public.admission_application_rate_events enable row level security;
revoke all on public.admission_application_rate_events from public, anon, authenticated;

commit;
