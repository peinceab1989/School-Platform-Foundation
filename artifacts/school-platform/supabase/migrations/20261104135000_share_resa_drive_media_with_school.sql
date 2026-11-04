-- Allow authenticated RESA members to read only files explicitly shared
-- with the school in the existing RESA Drive metadata table.
-- Private uploads remain administrator-only.
drop policy if exists "RESA school members can preview shared drive files" on storage.objects;
create policy "RESA school members can preview shared drive files"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'resa-drive'
  and exists (
    select 1
    from public.resa_drive_files f
    where f.storage_path = storage.objects.name
      and f.school_id = '469a9ed9-8e6c-45b8-a76c-89536adb1d3d'::uuid
      and f.is_active = true
      and (f.visibility = 'school' or f.published_to_website = true)
      and public.has_school_role(f.school_id)
  )
);
