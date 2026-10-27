-- RESA staff ID card and staff admission-letter print permissions.
-- Only school admins can grant/revoke; staff can read their own grants.
create table if not exists public.staff_document_permissions (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  staff_id uuid not null references public.staff(id) on delete cascade,
  document_type text not null check (document_type in ('id_card','admission_letter')),
  can_print boolean not null default false,
  granted_by uuid references auth.users(id),
  granted_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (school_id, staff_id, document_type)
);

create index if not exists staff_document_permissions_staff_idx
  on public.staff_document_permissions(school_id, staff_id);

alter table public.staff_document_permissions enable row level security;
grant select, insert, update, delete on public.staff_document_permissions to authenticated;

drop policy if exists staff_document_permissions_admin_manage on public.staff_document_permissions;
create policy staff_document_permissions_admin_manage
on public.staff_document_permissions
for all to authenticated
using (public.has_school_role(school_id, array['admin']::public.school_role[]))
with check (
  public.has_school_role(school_id, array['admin']::public.school_role[])
  and exists (
    select 1 from public.staff s
    where s.id = staff_document_permissions.staff_id
      and s.school_id = staff_document_permissions.school_id
  )
);

drop policy if exists staff_document_permissions_staff_read_own on public.staff_document_permissions;
create policy staff_document_permissions_staff_read_own
on public.staff_document_permissions
for select to authenticated
using (
  exists (
    select 1 from public.staff s
    where s.id = staff_document_permissions.staff_id
      and s.school_id = staff_document_permissions.school_id
      and s.user_id = (select auth.uid())
  )
  or exists (
    select 1 from public.staff s
    join public.people p on p.id = s.person_id and p.school_id = s.school_id
    where s.id = staff_document_permissions.staff_id
      and s.school_id = staff_document_permissions.school_id
      and p.user_id = (select auth.uid())
  )
);

comment on table public.staff_document_permissions is
'RESA print permissions for staff ID cards and staff admission letters. Staff can read only their own permissions; school admins grant and revoke.';
