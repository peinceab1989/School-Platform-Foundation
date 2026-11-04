-- Add a practical assessment type to the existing RESA assignment workflow.
-- Existing assignments remain homework by default; no existing rows are deleted.
alter table public.assignments
  add column if not exists assignment_type text not null default 'homework',
  add column if not exists practical_rubric jsonb not null default '[]'::jsonb;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.assignments'::regclass
      and conname = 'assignments_assignment_type_check'
  ) then
    alter table public.assignments
      add constraint assignments_assignment_type_check
      check (assignment_type in ('homework','practical','project'));
  end if;
end $$;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'resa-practical-evidence',
  'resa-practical-evidence',
  false,
  104857600,
  array[
    'image/jpeg','image/png','image/webp','image/heic',
    'video/mp4','video/quicktime','video/webm',
    'application/pdf','text/plain',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword'
  ]
)
on conflict (id) do update set
  public = false,
  file_size_limit = 104857600,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "RESA students upload own practical evidence" on storage.objects;
create policy "RESA students upload own practical evidence"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'resa-practical-evidence'
  and (storage.foldername(name))[1] = '469a9ed9-8e6c-45b8-a76c-89536adb1d3d'
  and exists (
    select 1
    from public.students st
    join public.assignments a
      on a.id = ((storage.foldername(name))[3])::uuid
     and a.school_id = st.school_id
    join public.student_enrollments se
      on se.school_id = st.school_id
     and se.student_id = st.id
     and se.class_id = a.class_id
     and se.academic_session_id = a.academic_session_id
     and se.status = 'active'
    where st.id = ((storage.foldername(name))[2])::uuid
      and st.school_id = '469a9ed9-8e6c-45b8-a76c-89536adb1d3d'::uuid
      and st.user_id = (select auth.uid())
      and st.status = 'active'
      and a.status = 'published'
      and a.assignment_type = 'practical'
  )
);

drop policy if exists "RESA practical evidence visible to owners teachers and admins" on storage.objects;
create policy "RESA practical evidence visible to owners teachers and admins"
on storage.objects for select to authenticated
using (
  bucket_id = 'resa-practical-evidence'
  and (storage.foldername(name))[1] = '469a9ed9-8e6c-45b8-a76c-89536adb1d3d'
  and (
    public.has_school_role('469a9ed9-8e6c-45b8-a76c-89536adb1d3d'::uuid, array['admin']::public.school_role[])
    or exists (
      select 1
      from public.students st
      join public.assignments a
        on a.id = ((storage.foldername(name))[3])::uuid
       and a.school_id = st.school_id
      where st.id = ((storage.foldername(name))[2])::uuid
        and st.school_id = '469a9ed9-8e6c-45b8-a76c-89536adb1d3d'::uuid
        and (
          st.user_id = (select auth.uid())
          or exists (
            select 1 from public.staff sf
            where sf.id = a.staff_id
              and sf.school_id = a.school_id
              and sf.user_id = (select auth.uid())
              and sf.status = 'active'
              and public.has_school_role(sf.school_id, array['teacher']::public.school_role[])
          )
        )
    )
  )
);

comment on column public.assignments.assignment_type is
'RESA learning activity type: homework, practical or project.';
comment on column public.assignments.practical_rubric is
'Teacher-defined practical assessment rubric stored as a JSON array of criteria.';
