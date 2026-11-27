-- RESA administrator-managed admission payment channels.
-- Only the proprietor-controlled server function can read/write configuration.
-- Enabled payment instructions are exposed through the public quote action only.

create table if not exists public.school_admission_payment_methods (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  method_type text not null check (method_type in ('bank_transfer','pos','cash','other')),
  display_name text not null check (length(trim(display_name)) between 2 and 100),
  bank_name text,
  account_name text,
  account_number text,
  payment_url text,
  instructions text not null default '' check (length(instructions) <= 2000),
  is_enabled boolean not null default false,
  display_order integer not null default 0 check (display_order between 0 and 1000),
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint resa_admission_bank_details_required check (
    method_type <> 'bank_transfer'
    or (
      nullif(trim(bank_name),'') is not null
      and nullif(trim(account_name),'') is not null
      and account_number ~ '^[0-9]{6,20}$'
    )
  ),
  constraint resa_admission_payment_url_https check (
    payment_url is null or payment_url ~ '^https://'
  )
);

create index if not exists school_admission_payment_methods_public_idx
  on public.school_admission_payment_methods(school_id,is_enabled,display_order,created_at);

alter table public.school_admission_payment_methods enable row level security;
revoke all on public.school_admission_payment_methods from public,anon,authenticated;
grant all on public.school_admission_payment_methods to service_role;

create table if not exists public.school_admission_payment_method_audit (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  method_id uuid references public.school_admission_payment_methods(id) on delete set null,
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null check (action in ('created','updated','enabled','disabled')),
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists school_admission_payment_method_audit_idx
  on public.school_admission_payment_method_audit(school_id,created_at desc);
alter table public.school_admission_payment_method_audit enable row level security;
revoke all on public.school_admission_payment_method_audit from public,anon,authenticated;
grant all on public.school_admission_payment_method_audit to service_role;

comment on table public.school_admission_payment_methods is
  'Proprietor-managed public instructions for RESA admission-form payment. Only enabled rows are returned by the trusted public quote endpoint. Manual payment never auto-issues an admission form; staff must verify funds first.';
