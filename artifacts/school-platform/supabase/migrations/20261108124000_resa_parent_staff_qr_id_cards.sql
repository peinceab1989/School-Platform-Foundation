-- Allow school administrators to print staff and parent QR identity cards
-- using existing self-managed profile photographs. No photo is made public.
-- Access is scoped to the staff/parent's own school and SELECT only.

drop policy if exists "RESA admins can read linked staff and parent profile photos"
  on storage.objects;

create policy "RESA admins can read linked staff and parent profile photos"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'resa-profile-photos'
  and (
    exists (
      select 1
      from public.staff sf
      where (
        sf.user_id::text = (storage.foldername(objects.name))[1]
        or exists (
          select 1
          from public.people p
          where p.id = sf.person_id
            and p.school_id = sf.school_id
            and p.user_id::text = (storage.foldername(objects.name))[1]
        )
      )
      and public.has_school_role(sf.school_id, array['admin']::public.school_role[])
    )
    or exists (
      select 1
      from public.parent_portal_accounts pa
      where pa.user_id::text = (storage.foldername(objects.name))[1]
        and pa.is_active
        and public.has_school_role(pa.school_id, array['admin']::public.school_role[])
    )
  )
);

comment on policy "RESA admins can read linked staff and parent profile photos"
on storage.objects is
'School administrators may view only staff and parent profile photos belonging to their own school, for printing identity cards. No write or public access is granted.';
