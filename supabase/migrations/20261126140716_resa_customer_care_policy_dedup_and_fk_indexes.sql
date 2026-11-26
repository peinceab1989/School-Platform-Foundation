-- Remove overlapping read policies while preserving effective access.
drop policy if exists "RESA admins can read Customer Care settings" on public.resa_customer_care_settings;
drop policy if exists "RESA Chief Admin manages Customer Care assignments" on public.resa_customer_care_assignments;
create policy "RESA Chief Admin inserts Customer Care assignments"
on public.resa_customer_care_assignments for insert to authenticated
with check (
  private.is_resa_chief_admin(school_id,(select auth.uid()))
  and exists (select 1 from public.school_memberships m
    where m.school_id=resa_customer_care_assignments.school_id
      and m.user_id=resa_customer_care_assignments.admin_user_id
      and m.status='active'::public.membership_status
      and m.role='admin'::public.school_role)
);
create policy "RESA Chief Admin updates Customer Care assignments"
on public.resa_customer_care_assignments for update to authenticated
using (private.is_resa_chief_admin(school_id,(select auth.uid())))
with check (
  private.is_resa_chief_admin(school_id,(select auth.uid()))
  and exists (select 1 from public.school_memberships m
    where m.school_id=resa_customer_care_assignments.school_id
      and m.user_id=resa_customer_care_assignments.admin_user_id
      and m.status='active'::public.membership_status
      and m.role='admin'::public.school_role)
);
create policy "RESA Chief Admin deletes Customer Care assignments"
on public.resa_customer_care_assignments for delete to authenticated
using (private.is_resa_chief_admin(school_id,(select auth.uid())));
create index if not exists resa_customer_care_assignments_admin_user_idx on public.resa_customer_care_assignments(admin_user_id);
create index if not exists resa_customer_care_assignments_assigned_by_idx on public.resa_customer_care_assignments(assigned_by);
create index if not exists resa_customer_care_settings_chief_admin_idx on public.resa_customer_care_settings(chief_admin_user_id);
create index if not exists resa_customer_care_settings_updated_by_idx on public.resa_customer_care_settings(updated_by);
