-- Supabase Free projects cannot set a global upload limit above 50 MB.
-- Keep the private RESA Drive bucket within the plan limit so the UI never
-- promises uploads that the project cannot accept.
update storage.buckets
set file_size_limit = 52428800
where id = 'resa-drive';
