-- Permit only active RESA administrators to receive the generic Customer Care refresh signal.
-- The broadcast payload contains no visitor identity, message body, or conversation token.
drop policy if exists resa_admin_receive_public_care_refresh on realtime.messages;
create policy resa_admin_receive_public_care_refresh
on realtime.messages
for select
to authenticated
using (
  realtime.topic() = 'resa-public-care-notifications-469a9ed9-8e6c-45b8-a76c-89536adb1d3d'
  and exists (
    select 1
    from public.school_memberships sm
    where sm.school_id = '469a9ed9-8e6c-45b8-a76c-89536adb1d3d'::uuid
      and sm.user_id = (select auth.uid())
      and sm.role = 'admin'
      and sm.status = 'active'
  )
);
