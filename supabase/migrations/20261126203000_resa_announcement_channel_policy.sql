-- Let administrators keep drafts and unpublish notices while the
-- announcement channel is paused, but prevent publishing during the pause.
drop policy if exists "resa announcement channel gate insert" on public.announcements;
create policy "resa announcement channel gate insert"
on public.announcements
as restrictive
for insert
to authenticated
with check (
  not is_published
  or public.resa_communication_channel_allowed(school_id, 'announcements')
);

drop policy if exists "resa announcement channel gate update" on public.announcements;
create policy "resa announcement channel gate update"
on public.announcements
as restrictive
for update
to authenticated
using (true)
with check (
  not is_published
  or public.resa_communication_channel_allowed(school_id, 'announcements')
);
