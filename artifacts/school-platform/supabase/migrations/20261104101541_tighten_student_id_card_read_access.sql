-- Student ID cards contain personal identifiers and passport-photo paths.
-- Restrict reads to school admins, the linked student and linked guardians.
drop policy if exists "school members can read student id cards" on public.student_id_cards;
create policy "students parents and school admins can read permitted student id cards"
on public.student_id_cards
for select to authenticated
using (
  public.has_school_role(school_id, array['admin']::public.school_role[])
  or exists (
    select 1
    from public.students st
    left join public.people p
      on p.id = st.person_id and p.school_id = st.school_id
    where st.id = student_id_cards.student_id
      and st.school_id = student_id_cards.school_id
      and (
        st.user_id = (select auth.uid())
        or p.user_id = (select auth.uid())
        or public.parent_can_access_student(st.id)
      )
  )
);
