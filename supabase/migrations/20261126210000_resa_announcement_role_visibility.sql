-- Apply role-level announcement visibility while preserving administrator
-- access to drafts and the ability to unpublish notices when the channel is off.
drop policy if exists "resa announcement role visibility gate" on public.announcements;
create policy "resa announcement role visibility gate"
on public.announcements
as restrictive
for select
to authenticated
using (
  public.has_school_role(school_id, array['admin']::public.school_role[])
  or public.resa_communication_channel_allowed(school_id, 'announcements')
);
