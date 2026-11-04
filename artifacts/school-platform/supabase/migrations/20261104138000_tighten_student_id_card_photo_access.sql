-- Keep student ID-card passport photos private to the linked student,
-- linked parent/guardian, or school administrator. The application stores
-- photos at <school_id>/<student_id>/<filename> in the private bucket.
drop policy if exists "RESA school members can read student ID card photos" on storage.objects;
drop policy if exists "RESA linked students and admins read student ID photos" on storage.objects;

create policy "RESA linked students guardians and admins read student ID photos"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'resa-profile-photos'
  and exists (
    select 1
    from public.students st
    left join public.people p
      on p.id = st.person_id
     and p.school_id = st.school_id
    where st.id = ((storage.foldername(storage.objects.name))[2])::uuid
      and st.school_id = ((storage.foldername(storage.objects.name))[1])::uuid
      and (
        st.user_id = (select auth.uid())
        or p.user_id = (select auth.uid())
        or public.parent_can_access_student(st.id)
        or public.has_school_role(st.school_id, array['admin']::public.school_role[])
      )
  )
);
