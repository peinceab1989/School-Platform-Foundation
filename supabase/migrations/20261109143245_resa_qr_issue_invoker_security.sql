-- The QR issuer uses the existing admin-only RLS policy on attendance_qr_credentials.
-- Run as the authenticated caller rather than bypassing RLS.
alter function public.resa_issue_attendance_qr(uuid,text,uuid,text,boolean) security invoker;
revoke all on function public.resa_issue_attendance_qr(uuid,text,uuid,text,boolean) from public,anon;
grant execute on function public.resa_issue_attendance_qr(uuid,text,uuid,text,boolean) to authenticated;
