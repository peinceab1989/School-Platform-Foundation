-- Private photo access for student ID cards.
-- Student ID-card images use the resa-profile-photos bucket and are stored
-- below student-id-cards/<school_id>/<student_id>/... .
drop policy if exists "RESA school members can read student ID card photos" on storage.objects;
create policy "RESA school members can read student ID card photos"
on storage.objects for select to authenticated
using (
  bucket_id = 'resa-profile-photos'
  and (storage.foldername(name))[1] = 'student-id-cards'
  and public.has_school_role(((storage.foldername(name))[2])::uuid)
);

drop policy if exists "RESA admins can upload student ID card photos" on storage.objects;
create policy "RESA admins can upload student ID card photos"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'resa-profile-photos'
  and (storage.foldername(name))[1] = 'student-id-cards'
  and public.has_school_role(((storage.foldername(name))[2])::uuid, array['admin']::public.school_role[])
);

drop policy if exists "RESA admins can update student ID card photos" on storage.objects;
create policy "RESA admins can update student ID card photos"
on storage.objects for update to authenticated
using (
  bucket_id = 'resa-profile-photos'
  and (storage.foldername(name))[1] = 'student-id-cards'
  and public.has_school_role(((storage.foldername(name))[2])::uuid, array['admin']::public.school_role[])
)
with check (
  bucket_id = 'resa-profile-photos'
  and (storage.foldername(name))[1] = 'student-id-cards'
  and public.has_school_role(((storage.foldername(name))[2])::uuid, array['admin']::public.school_role[])
);

drop policy if exists "RESA admins can delete student ID card photos" on storage.objects;
create policy "RESA admins can delete student ID card photos"
on storage.objects for delete to authenticated
using (
  bucket_id = 'resa-profile-photos'
  and (storage.foldername(name))[1] = 'student-id-cards'
  and public.has_school_role(((storage.foldername(name))[2])::uuid, array['admin']::public.school_role[])
);
