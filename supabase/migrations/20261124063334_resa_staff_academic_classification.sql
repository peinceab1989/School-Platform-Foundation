-- RESA staff classification: additive and non-destructive.
-- Existing employee records remain explicitly unclassified until an administrator reviews them.
alter table public.staff
  add column if not exists staff_category text not null default 'unclassified';

alter table public.staff
  drop constraint if exists staff_staff_category_check;

alter table public.staff
  add constraint staff_staff_category_check
  check (staff_category in ('academic', 'non_academic', 'unclassified'));

comment on column public.staff.staff_category is
  'Administrative classification: academic teaching staff, non-academic support staff, or unclassified pending administrator review.';
