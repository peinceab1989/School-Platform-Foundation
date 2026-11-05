drop policy if exists "school members can read vehicles" on public.school_vehicles;
create policy "authorised staff and assigned families can read vehicles"
on public.school_vehicles for select to authenticated
using (
  public.has_school_role(school_id, array['admin','teacher']::public.school_role[])
  or exists (
    select 1
    from public.transport_routes r
    join public.student_transport_assignments a
      on a.route_id = r.id and a.school_id = r.school_id
    join public.students s
      on s.id = a.student_id and s.school_id = a.school_id
    where r.vehicle_id = school_vehicles.id
      and r.school_id = school_vehicles.school_id
      and a.status = 'active'
      and (a.end_date is null or a.end_date >= current_date)
      and (s.user_id = (select auth.uid()) or public.parent_can_access_student(s.id))
  )
);

drop policy if exists "school members can read transport routes" on public.transport_routes;
create policy "authorised staff and assigned families can read transport routes"
on public.transport_routes for select to authenticated
using (
  public.has_school_role(school_id, array['admin','teacher']::public.school_role[])
  or exists (
    select 1
    from public.student_transport_assignments a
    join public.students s on s.id = a.student_id and s.school_id = a.school_id
    where a.route_id = transport_routes.id
      and a.school_id = transport_routes.school_id
      and a.status = 'active'
      and (a.end_date is null or a.end_date >= current_date)
      and (s.user_id = (select auth.uid()) or public.parent_can_access_student(s.id))
  )
);

create policy "assigned families and staff can read pickup points"
on public.transport_pickup_points for select to authenticated
using (
  public.has_school_role(school_id, array['admin','teacher']::public.school_role[])
  or exists (
    select 1
    from public.student_transport_assignments a
    join public.students s on s.id = a.student_id and s.school_id = a.school_id
    where a.route_id = transport_pickup_points.route_id
      and a.school_id = transport_pickup_points.school_id
      and a.pickup_point_id = transport_pickup_points.id
      and a.status = 'active'
      and (a.end_date is null or a.end_date >= current_date)
      and (s.user_id = (select auth.uid()) or public.parent_can_access_student(s.id))
  )
);

create policy "students and parents can read own transport assignments"
on public.student_transport_assignments for select to authenticated
using (
  exists (
    select 1 from public.students s
    where s.id = student_transport_assignments.student_id
      and s.school_id = student_transport_assignments.school_id
      and (s.user_id = (select auth.uid()) or public.parent_can_access_student(s.id))
  )
);