-- Correct RESA public website media uploads to validate the actual object path.
-- Qualifying storage.objects.name avoids shadowing by public.schools.name inside EXISTS.

drop policy if exists "RESA administrators upload website media" on storage.objects;

create policy "RESA administrators upload website media"
  on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'resa-public-website-media'
    and exists (
      select 1
      from public.schools school
      where school.id::text = (storage.foldername(storage.objects.name))[1]
        and (
          public.is_nexus_owner()
          or public.has_school_role(school.id, array['admin']::public.school_role[])
        )
    )
  );

comment on policy "RESA administrators upload website media" on storage.objects is
  'Only RESA proprietors and active school administrators may upload to the public website media bucket, and the first object-path folder must equal the school UUID.';
