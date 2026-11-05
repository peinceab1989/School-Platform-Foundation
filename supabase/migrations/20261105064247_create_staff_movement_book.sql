create table if not exists public.staff_movement_book (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  staff_id uuid not null references public.staff(id) on delete restrict,
  movement_type text not null default 'official_exit'
    check (movement_type in ('official_exit','personal_exit','field_duty','official_return')),
  purpose text not null check (length(trim(purpose)) between 3 and 1000),
  destination text not null check (length(trim(destination)) between 2 and 300),
  departure_at timestamptz not null default now(),
  expected_return_at timestamptz,
  actual_return_at timestamptz,
  status text not null default 'out' check (status in ('out','returned','overdue','cancelled')),
  remarks text,
  recorded_by uuid references auth.users(id) on delete set null,
  returned_recorded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint staff_movement_return_after_departure
    check (actual_return_at is null or actual_return_at >= departure_at),
  constraint staff_movement_expected_after_departure
    check (expected_return_at is null or expected_return_at >= departure_at),
  constraint staff_movement_return_status_consistent
    check ((status = 'returned' and actual_return_at is not null) or status <> 'returned')
);

create index if not exists staff_movement_book_school_departure_idx
  on public.staff_movement_book (school_id, departure_at desc);
create index if not exists staff_movement_book_staff_status_idx
  on public.staff_movement_book (school_id, staff_id, status);

alter table public.staff_movement_book enable row level security;

drop policy if exists "school admins can manage staff movement book" on public.staff_movement_book;
create policy "school admins can manage staff movement book"
  on public.staff_movement_book
  for all
  to authenticated
  using (has_school_role(school_id, array['admin'::school_role]))
  with check (has_school_role(school_id, array['admin'::school_role]));

grant select, insert, update, delete on public.staff_movement_book to authenticated;
