create table if not exists public.teaching_materials (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  title text not null check (length(trim(title)) between 2 and 180),
  material_type text not null default 'teaching_note' check (material_type in ('scheme_of_work','lesson_note','worksheet','revision_material','other')),
  class_id uuid references public.school_classes(id) on delete set null,
  subject_id uuid references public.subjects(id) on delete set null,
  academic_session_id uuid references public.academic_sessions(id) on delete set null,
  topic text,
  description text,
  storage_path text,
  extracted_text text,
  uploaded_by uuid not null references auth.users(id) on delete restrict,
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists teaching_materials_school_class_subject_idx
  on public.teaching_materials(school_id, class_id, subject_id, is_published);

alter table public.teaching_materials enable row level security;

drop policy if exists "teaching materials visible to school staff or published students" on public.teaching_materials;
create policy "teaching materials visible to school staff or published students"
on public.teaching_materials for select to authenticated
using (
  public.has_school_role(school_id, array['admin','teacher']::public.school_role[])
  or (is_published = true and public.has_school_role(school_id, array['student']::public.school_role[]))
);

drop policy if exists "admins manage teaching materials" on public.teaching_materials;
create policy "admins manage teaching materials"
on public.teaching_materials for all to authenticated
using (public.has_school_role(school_id, array['admin']::public.school_role[]))
with check (public.has_school_role(school_id, array['admin']::public.school_role[]));

drop policy if exists "teachers manage assigned teaching materials" on public.teaching_materials;
create policy "teachers manage assigned teaching materials"
on public.teaching_materials for all to authenticated
using (
  public.has_school_role(school_id, array['teacher']::public.school_role[])
  and exists (
    select 1 from public.staff st
    join public.teacher_assignments ta on ta.staff_id = st.id and ta.school_id = st.school_id
    where st.school_id = teaching_materials.school_id and st.user_id = auth.uid() and st.status = 'active'
      and (teaching_materials.class_id is null or ta.class_id = teaching_materials.class_id)
      and (teaching_materials.subject_id is null or ta.subject_id = teaching_materials.subject_id)
      and (teaching_materials.academic_session_id is null or ta.academic_session_id = teaching_materials.academic_session_id)
  )
)
with check (
  public.has_school_role(school_id, array['teacher']::public.school_role[])
  and uploaded_by = auth.uid()
  and exists (
    select 1 from public.staff st
    join public.teacher_assignments ta on ta.staff_id = st.id and ta.school_id = st.school_id
    where st.school_id = teaching_materials.school_id and st.user_id = auth.uid() and st.status = 'active'
      and (teaching_materials.class_id is null or ta.class_id = teaching_materials.class_id)
      and (teaching_materials.subject_id is null or ta.subject_id = teaching_materials.subject_id)
      and (teaching_materials.academic_session_id is null or ta.academic_session_id = teaching_materials.academic_session_id)
  )
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('resa-teaching-materials', 'resa-teaching-materials', false, 15728640,
  array['application/pdf','text/plain','text/markdown','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/msword'])
on conflict (id) do update set public = false, file_size_limit = 15728640, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "school staff upload teaching materials" on storage.objects;
create policy "school staff upload teaching materials"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'resa-teaching-materials'
  and (storage.foldername(name))[1] is not null
  and exists (
    select 1 from public.school_memberships sm
    where sm.school_id::text = (storage.foldername(name))[1] and sm.user_id = auth.uid()
      and sm.status = 'active' and sm.role in ('admin','teacher')
  )
);

drop policy if exists "school staff read teaching materials files" on storage.objects;
create policy "school staff read teaching materials files"
on storage.objects for select to authenticated
using (
  bucket_id = 'resa-teaching-materials'
  and exists (
    select 1 from public.school_memberships sm
    where sm.school_id::text = (storage.foldername(name))[1] and sm.user_id = auth.uid()
      and sm.status = 'active' and sm.role in ('admin','teacher')
  )
);

drop policy if exists "students read published teaching material files" on storage.objects;
create policy "students read published teaching material files"
on storage.objects for select to authenticated
using (
  bucket_id = 'resa-teaching-materials'
  and exists (
    select 1 from public.teaching_materials tm
    where tm.storage_path = storage.objects.name
      and tm.school_id::text = (storage.foldername(storage.objects.name))[1]
      and tm.is_published = true
      and public.has_school_role(tm.school_id, array['student']::public.school_role[])
  )
);
