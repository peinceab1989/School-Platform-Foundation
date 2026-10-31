alter table public.biometric_parent_notifications
  drop constraint if exists biometric_parent_notifications_event_fk;
alter table public.student_attendance
  drop constraint if exists student_attendance_biometric_event_id_fkey;
alter table public.student_attendance
  drop constraint if exists student_attendance_check_in_event_fk;
alter table public.student_attendance
  drop constraint if exists student_attendance_check_out_event_fk;

alter table public.biometric_attendance_events
  drop constraint if exists biometric_attendance_events_id_unique;

alter table public.biometric_parent_notifications
  add constraint biometric_parent_notifications_event_fk
  foreign key (biometric_event_id)
  references public.biometric_attendance_events(id) on delete cascade;

alter table public.student_attendance
  add constraint student_attendance_biometric_event_id_fkey
  foreign key (biometric_event_id)
  references public.biometric_attendance_events(id) on delete set null;

alter table public.student_attendance
  add constraint student_attendance_check_in_event_fk
  foreign key (check_in_event_id)
  references public.biometric_attendance_events(id) on delete set null;

alter table public.student_attendance
  add constraint student_attendance_check_out_event_fk
  foreign key (check_out_event_id)
  references public.biometric_attendance_events(id) on delete set null;