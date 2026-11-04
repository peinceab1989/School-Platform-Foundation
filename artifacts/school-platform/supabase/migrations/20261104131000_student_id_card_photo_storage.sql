-- Private student passport-photo access for ID cards.
-- Actual application paths are <school_id>/<student_id>/<filename>.
drop policy if exists "RESA admins upload student ID photos" on storage.objects;
create policy "RESA admins upload student ID photos"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'resa-profile-photos'
  and exists (
    select 1 from public.schools sc
    where sc.id = ((storage.foldername(storage.objects.name))[1])::uuid
      and public.has_school_role(sc.id, array['admin']::public.school_role[])
  )
);

drop policy if exists "RESA linked students and admins read student ID photos" on storage.objects;
create policy "RESA linked students and admins read student ID photos"
on storage.objects for select to authenticated
using (
  bucket_id = 'resa-profile-photos'
  and exists (
    select 1
    from public.students st
    left join public.people p
      on p.id = st.person_id and p.school_id = st.school_id
    where st.id = ((storage.foldername(storage.objects.name))[2])::uuid
      and st.school_id = ((storage.foldername(storage.objects.name))[1])::uuid
      and (
        st.user_id = (select auth.uid())
        or p.user_id = (select auth.uid())
        or public.has_school_role(st.school_id, array['admin']::public.school_role[])
      )
  )
);
