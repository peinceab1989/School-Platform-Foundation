-- Parent notification inbox access must follow the same active account,
-- guardian portal, linked-student and school-membership checks as the parent portal.
drop policy if exists "parents can read their linked attendance notifications"
  on public.biometric_parent_notifications;
create policy "parents can read their linked attendance notifications"
on public.biometric_parent_notifications
for select to authenticated
using (
  exists (
    select 1
    from public.parents_guardians g
    join public.people p
      on p.id = g.person_id and p.school_id = g.school_id
    join public.parent_student_portal_access access_link
      on access_link.parent_guardian_id = g.id
     and access_link.school_id = g.school_id
    join public.parent_portal_accounts portal_account
      on portal_account.parent_guardian_id = g.id
     and portal_account.school_id = g.school_id
     and portal_account.user_id = p.user_id
     and portal_account.is_active = true
    join public.school_memberships membership
      on membership.school_id = g.school_id
     and membership.user_id = p.user_id
     and membership.role = 'parent'::public.school_role
     and membership.status = 'active'::public.membership_status
    where g.id = biometric_parent_notifications.parent_guardian_id
      and g.school_id = biometric_parent_notifications.school_id
      and p.user_id = (select auth.uid())
      and g.portal_enabled = true
      and access_link.student_id = biometric_parent_notifications.student_id
      and access_link.is_active = true
  )
);

drop policy if exists "parents can mark own attendance alerts read"
  on public.biometric_parent_notifications;
create policy "parents can mark own attendance alerts read"
on public.biometric_parent_notifications
for update to authenticated
using (
  exists (
    select 1
    from public.parents_guardians g
    join public.people p
      on p.id = g.person_id and p.school_id = g.school_id
    join public.parent_student_portal_access access_link
      on access_link.parent_guardian_id = g.id
     and access_link.school_id = g.school_id
    join public.parent_portal_accounts portal_account
      on portal_account.parent_guardian_id = g.id
     and portal_account.school_id = g.school_id
     and portal_account.user_id = p.user_id
     and portal_account.is_active = true
    join public.school_memberships membership
      on membership.school_id = g.school_id
     and membership.user_id = p.user_id
     and membership.role = 'parent'::public.school_role
     and membership.status = 'active'::public.membership_status
    where g.id = biometric_parent_notifications.parent_guardian_id
      and g.school_id = biometric_parent_notifications.school_id
      and p.user_id = (select auth.uid())
      and g.portal_enabled = true
      and access_link.student_id = biometric_parent_notifications.student_id
      and access_link.is_active = true
  )
)
with check (
  exists (
    select 1
    from public.parents_guardians g
    join public.people p
      on p.id = g.person_id and p.school_id = g.school_id
    join public.parent_student_portal_access access_link
      on access_link.parent_guardian_id = g.id
     and access_link.school_id = g.school_id
    join public.parent_portal_accounts portal_account
      on portal_account.parent_guardian_id = g.id
     and portal_account.school_id = g.school_id
     and portal_account.user_id = p.user_id
     and portal_account.is_active = true
    join public.school_memberships membership
      on membership.school_id = g.school_id
     and membership.user_id = p.user_id
     and membership.role = 'parent'::public.school_role
     and membership.status = 'active'::public.membership_status
    where g.id = biometric_parent_notifications.parent_guardian_id
      and g.school_id = biometric_parent_notifications.school_id
      and p.user_id = (select auth.uid())
      and g.portal_enabled = true
      and access_link.student_id = biometric_parent_notifications.student_id
      and access_link.is_active = true
  )
);
