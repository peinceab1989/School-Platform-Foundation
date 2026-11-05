-- The student file-access policy joins storage objects to teaching materials by path.
-- Index that lookup without changing or removing any existing records.
create index if not exists teaching_materials_storage_path_idx
  on public.teaching_materials (storage_path)
  where storage_path is not null;