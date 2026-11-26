-- Durable per-user read receipts for school announcements.
-- Additive: no announcement content or existing message history is changed.
create table if not exists public.resa_announcement_reads (
  school_id uuid not null references public.schools(id) on delete cascade,
  announcement_id uuid not null references public.announcements(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (announcement_id, user_id)
);

create index if not exists resa_announcement_reads_user_school_idx
  on public.resa_announcement_reads(user_id, school_id, read_at desc);

alter table public.resa_announcement_reads enable row level security;

drop policy if exists resa_announcement_reads_select_own on public.resa_announcement_reads;
create policy resa_announcement_reads_select_own
  on public.resa_announcement_reads for select to authenticated
  using (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.school_memberships m
      where m.school_id = resa_announcement_reads.school_id
        and m.user_id = (select auth.uid())
        and m.status = 'active'
    )
  );

drop policy if exists resa_announcement_reads_insert_own on public.resa_announcement_reads;
create policy resa_announcement_reads_insert_own
  on public.resa_announcement_reads for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.school_memberships m
      where m.school_id = resa_announcement_reads.school_id
        and m.user_id = (select auth.uid())
        and m.status = 'active'
    )
    and exists (
      select 1 from public.announcements a
      where a.id = resa_announcement_reads.announcement_id
        and a.school_id = resa_announcement_reads.school_id
        and a.is_published = true
    )
  );

drop policy if exists resa_announcement_reads_update_own on public.resa_announcement_reads;
create policy resa_announcement_reads_update_own
  on public.resa_announcement_reads for update to authenticated
  using (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.school_memberships m
      where m.school_id = resa_announcement_reads.school_id
        and m.user_id = (select auth.uid())
        and m.status = 'active'
    )
  )
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.school_memberships m
      where m.school_id = resa_announcement_reads.school_id
        and m.user_id = (select auth.uid())
        and m.status = 'active'
    )
  );

grant select, insert, update on public.resa_announcement_reads to authenticated;
revoke delete on public.resa_announcement_reads from anon, authenticated;

-- Keep read receipts synchronised between the recipient's open devices.
do $publication$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = 'resa_announcement_reads'
     ) then
    execute 'alter publication supabase_realtime add table public.resa_announcement_reads';
  end if;
end;
$publication$;
