-- Cover the attendance/audit foreign keys used by history and user-deletion checks.
-- IF NOT EXISTS keeps this migration safe to retry on the existing RESA project.
create index if not exists student_attendance_check_in_event_idx
  on public.student_attendance (check_in_event_id)
  where check_in_event_id is not null;

create index if not exists student_attendance_check_out_event_idx
  on public.student_attendance (check_out_event_id)
  where check_out_event_id is not null;

create index if not exists staff_attendance_recorded_by_idx
  on public.staff_attendance (recorded_by)
  where recorded_by is not null;

create index if not exists staff_movement_book_recorded_by_idx
  on public.staff_movement_book (recorded_by)
  where recorded_by is not null;

create index if not exists staff_movement_book_returned_recorded_by_idx
  on public.staff_movement_book (returned_recorded_by)
  where returned_recorded_by is not null;
