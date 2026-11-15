-- RESA Drive UI offers "Authorised RESA portal members" as a visibility option.
-- The existing CHECK constraint omitted "school", so the metadata insert failed
-- after the object upload and the client then cleaned up the uploaded object.
-- Add the intended value without changing any existing file rows or policies.
alter table public.resa_drive_files
  drop constraint if exists resa_drive_files_visibility_check;

alter table public.resa_drive_files
  add constraint resa_drive_files_visibility_check
  check (visibility = any (array['private', 'staff', 'parents', 'public', 'school']::text[]));
