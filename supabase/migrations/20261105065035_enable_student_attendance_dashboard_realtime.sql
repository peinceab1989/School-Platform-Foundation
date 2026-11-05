-- Allow student dashboards to receive their own attendance updates in realtime.
-- Row-level security still limits each student to their own attendance records.
do $$
begin
  alter publication supabase_realtime add table public.student_attendance;
exception
  when duplicate_object then null;
end
$$;
