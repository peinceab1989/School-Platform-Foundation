-- Student ID-card permission grants mirror the staff print-permission model.
-- Only school administrators can grant/revoke; students can read their own grant.
create table if not exists public.student_document_permissions (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  document_type text not null check (document_type in ('id_card')),
  can_print boolean not null default false,
  granted_by uuid references auth.users(id),
  granted_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (school_id, student_id, document_type)
);

create index if not exists student_document_permissions_student_idx
  on public.student_document_permissions(school_id, student_id);

alter table public.student_document_permissions enable row level security;
grant select, insert, update, delete on public.student_document_permissions to authenticated;

drop policy if exists student_document_permissions_admin_manage on public.student_document_permissions;
create policy student_document_permissions_admin_manage
on public.student_document_permissions
for all to authenticated
using (public.has_school_role(school_id, array['admin']::public.school_role[]))
with check (
  public.has_school_role(school_id, array['admin']::public.school_role[])
  and exists (
    select 1 from public.students s
    where s.id = student_document_permissions.student_id
      and s.school_id = student_document_permissions.school_id
  )
);

drop policy if exists student_document_permissions_student_read_own on public.student_document_permissions;
create policy student_document_permissions_student_read_own
on public.student_document_permissions
for select to authenticated
using (
  exists (
    select 1 from public.students s
    where s.id = student_document_permissions.student_id
      and s.school_id = student_document_permissions.school_id
      and s.user_id = (select auth.uid())
  )
  or exists (
    select 1 from public.students s
    join public.people p on p.id = s.person_id and p.school_id = s.school_id
    where s.id = student_document_permissions.student_id
      and s.school_id = student_document_permissions.school_id
      and p.user_id = (select auth.uid())
  )
);

comment on table public.student_document_permissions is
'RESA student ID-card print permissions. School administrators grant and revoke; students can read their own grant.';
