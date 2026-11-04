-- Ensure any active teacher assigned to the practical class and subject can
-- securely review the submitted photo/video evidence, not only the authoring teacher.
drop policy if exists "RESA assigned teachers read practical evidence" on storage.objects;
create policy "RESA assigned teachers read practical evidence"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'resa-practical-evidence'
  and (storage.foldername(name))[1] = '469a9ed9-8e6c-45b8-a76c-89536adb1d3d'
  and exists (
    select 1
    from public.students st
    join public.assignments a
      on a.id = ((storage.foldername(objects.name))[3])::uuid
     and a.school_id = st.school_id
    join public.teacher_assignments ta
      on ta.school_id = a.school_id
     and ta.academic_session_id = a.academic_session_id
     and ta.class_id = a.class_id
     and ta.subject_id = a.subject_id
    join public.staff sf
      on sf.id = ta.staff_id
     and sf.school_id = ta.school_id
    where st.id = ((storage.foldername(objects.name))[2])::uuid
      and st.school_id = a.school_id
      and a.assignment_type = 'practical'
      and sf.user_id = (select auth.uid())
      and sf.status = 'active'
      and public.has_school_role(sf.school_id, array['teacher']::public.school_role[])
  )
);
