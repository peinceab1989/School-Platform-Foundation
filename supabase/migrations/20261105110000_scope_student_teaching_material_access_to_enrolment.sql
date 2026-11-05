-- Keep student access to teaching-material metadata and files aligned.
-- Students must be active and enrolled in the material's class and, when set,
-- the material's academic session. School-wide materials remain available to
-- active students in the school.

drop policy if exists "teaching materials visible to school staff or published student"
  on public.teaching_materials;

create policy "teaching materials visible to school staff or enrolled published student"
on public.teaching_materials
for select
to authenticated
using (
  has_school_role(school_id, array['admin'::school_role, 'teacher'::school_role])
  or (
    is_published = true
    and has_school_role(school_id, array['student'::school_role])
    and exists (
      select 1
      from public.students s
      join public.student_enrollments se
        on se.student_id = s.id
       and se.school_id = s.school_id
      where s.school_id = teaching_materials.school_id
        and s.user_id = auth.uid()
        and s.status = 'active'
        and se.status = 'active'
        and (teaching_materials.class_id is null or se.class_id = teaching_materials.class_id)
        and (teaching_materials.academic_session_id is null or se.academic_session_id = teaching_materials.academic_session_id)
    )
  )
);

drop policy if exists "students read published teaching material files"
  on storage.objects;

create policy "students read enrolled published teaching material files"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'resa-teaching-materials'
  and exists (
    select 1
    from public.teaching_materials tm
    where tm.storage_path = storage.objects.name
      and tm.school_id::text = (storage.foldername(storage.objects.name))[1]
      and tm.is_published = true
      and has_school_role(tm.school_id, array['student'::school_role])
      and exists (
        select 1
        from public.students s
        join public.student_enrollments se
          on se.student_id = s.id
         and se.school_id = s.school_id
        where s.school_id = tm.school_id
          and s.user_id = auth.uid()
          and s.status = 'active'
          and se.status = 'active'
          and (tm.class_id is null or se.class_id = tm.class_id)
          and (tm.academic_session_id is null or se.academic_session_id = tm.academic_session_id)
      )
  )
);