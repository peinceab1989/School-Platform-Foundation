-- Keep school messages inside the sender's active school and make message content immutable after sending.
DROP POLICY IF EXISTS "users can send school messages" ON public.school_messages;
CREATE POLICY "users can send school messages"
ON public.school_messages
FOR INSERT
TO authenticated
WITH CHECK (
  sender_id = (SELECT auth.uid())
  AND public.has_school_role(school_id)
  AND EXISTS (
    SELECT 1
    FROM public.school_memberships AS recipient_membership
    WHERE recipient_membership.school_id = school_messages.school_id
      AND recipient_membership.user_id = school_messages.recipient_id
      AND recipient_membership.status = 'active'::public.membership_status
  )
);

CREATE OR REPLACE FUNCTION public.prevent_school_message_content_mutation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $function$
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.school_id IS DISTINCT FROM OLD.school_id
     OR NEW.sender_id IS DISTINCT FROM OLD.sender_id
     OR NEW.recipient_id IS DISTINCT FROM OLD.recipient_id
     OR NEW.subject IS DISTINCT FROM OLD.subject
     OR NEW.message IS DISTINCT FROM OLD.message
     OR NEW.sent_at IS DISTINCT FROM OLD.sent_at THEN
    RAISE EXCEPTION 'School message content and recipients cannot be changed after sending';
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS school_messages_prevent_content_mutation ON public.school_messages;
CREATE TRIGGER school_messages_prevent_content_mutation
BEFORE UPDATE ON public.school_messages
FOR EACH ROW
EXECUTE FUNCTION public.prevent_school_message_content_mutation();

REVOKE EXECUTE ON FUNCTION public.prevent_school_message_content_mutation() FROM PUBLIC, anon, authenticated;
