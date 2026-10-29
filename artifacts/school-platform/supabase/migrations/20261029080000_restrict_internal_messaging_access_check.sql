-- This helper is intended for the database's message-insert authorization path,
-- not as a public RPC that lets callers probe arbitrary user IDs.
revoke all on function public.student_messaging_access_enabled(uuid, uuid)
from public, anon, authenticated;
