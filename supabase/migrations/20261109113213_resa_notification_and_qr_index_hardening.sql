-- pg_net is not relocatable; keep the active extension in place to preserve its request queue.

create index if not exists attendance_qr_credentials_approved_by_idx
  on public.attendance_qr_credentials(approved_by) where approved_by is not null;
create index if not exists attendance_qr_credentials_created_by_idx
  on public.attendance_qr_credentials(created_by) where created_by is not null;
create index if not exists attendance_qr_credentials_student_id_idx
  on public.attendance_qr_credentials(student_id) where student_id is not null;
create index if not exists attendance_qr_credentials_staff_id_idx
  on public.attendance_qr_credentials(staff_id) where staff_id is not null;
create index if not exists resa_notification_preferences_user_id_idx
  on public.resa_notification_preferences(user_id);
create index if not exists resa_push_subscriptions_school_id_idx
  on public.resa_push_subscriptions(school_id);
create index if not exists resa_push_subscriptions_user_id_idx
  on public.resa_push_subscriptions(user_id);
