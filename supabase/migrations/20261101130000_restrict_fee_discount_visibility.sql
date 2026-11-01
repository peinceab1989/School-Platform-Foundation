-- Restrict student fee discount records to school administrators and the
-- parent/guardian who is linked to the specific student. Teachers and unrelated
-- school members must not be able to inspect family concessions or waivers.

begin;

drop policy if exists "school members can read student fee discounts"
  on public.student_fee_discounts;

drop policy if exists "parents can read their linked student fee discounts"
  on public.student_fee_discounts;

create policy "parents can read their linked student fee discounts"
  on public.student_fee_discounts
  for select to authenticated
  using (
    public.parent_can_access_student(student_id)
    and exists (
      select 1
      from public.parent_student_portal_access link
      where link.student_id = student_fee_discounts.student_id
        and link.school_id = student_fee_discounts.school_id
        and link.is_active = true
        and public.parent_can_access_guardian(link.parent_guardian_id)
    )
  );

-- Trigger functions are invoked by their triggers only, not exposed as RPCs.
revoke all on function public.sync_parent_fee_portal_views_for_assignment() from public, anon, authenticated;
revoke all on function public.sync_parent_fee_portal_views_for_family_link() from public, anon, authenticated;

commit;
