-- Private profile photo storage. Each authenticated account can manage only its own folder.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('resa-profile-photos', 'resa-profile-photos', false, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set
  public = false,
  file_size_limit = 5242880,
  allowed_mime_types = array['image/jpeg','image/png','image/webp'];

drop policy if exists "Users read own RESA profile photos" on storage.objects;
create policy "Users read own RESA profile photos"
on storage.objects for select to authenticated
using (bucket_id = 'resa-profile-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "Users upload own RESA profile photos" on storage.objects;
create policy "Users upload own RESA profile photos"
on storage.objects for insert to authenticated
with check (bucket_id = 'resa-profile-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "Users update own RESA profile photos" on storage.objects;
create policy "Users update own RESA profile photos"
on storage.objects for update to authenticated
using (bucket_id = 'resa-profile-photos' and (storage.foldername(name))[1] = (select auth.uid())::text)
with check (bucket_id = 'resa-profile-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "Users delete own RESA profile photos" on storage.objects;
create policy "Users delete own RESA profile photos"
on storage.objects for delete to authenticated
using (bucket_id = 'resa-profile-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
