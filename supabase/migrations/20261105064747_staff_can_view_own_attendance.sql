drop policy if exists "staff can read own attendance" on public.staff_attendance;
create policy "staff can read own attendance"
on public.staff_attendance
for select
to authenticated
using (
  exists (
    select 1
    from public.staff s
    left join public.people p
      on p.id = s.person_id
     and p.school_id = s.school_id
    where s.id = staff_attendance.staff_id
      and s.school_id = staff_attendance.school_id
      and (s.user_id = auth.uid() or p.user_id = auth.uid())
  )
);

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'staff_attendance'
  ) then
    alter publication supabase_realtime add table public.staff_attendance;
  end if;
end $$;
