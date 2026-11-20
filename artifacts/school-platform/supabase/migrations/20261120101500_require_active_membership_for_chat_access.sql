-- Require an active school membership for every chat read/write path.
-- This prevents a suspended or removed school account from retaining access
-- merely because its user ID remains on a historical direct conversation.

CREATE OR REPLACE FUNCTION public.resa_get_unread_chat_count(p_school_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SET search_path = ''
AS $function$
  SELECT count(*)::integer
  FROM public.resa_chat_messages AS message
  JOIN public.resa_chat_conversations AS conversation
    ON conversation.id = message.conversation_id
   AND conversation.school_id = message.school_id
  WHERE message.school_id = p_school_id
    AND auth.uid() IS NOT NULL
    AND public.has_school_role(
      p_school_id,
      ARRAY['admin'::public.school_role,'teacher'::public.school_role,'student'::public.school_role,'parent'::public.school_role]
    )
    AND message.sender_id <> auth.uid()
    AND (
      public.has_school_role(p_school_id, ARRAY['admin'::public.school_role])
      OR (
        conversation.conversation_type = 'group'
        AND EXISTS (
          SELECT 1 FROM public.resa_chat_group_members AS member
          WHERE member.conversation_id = conversation.id
            AND member.school_id = conversation.school_id
            AND member.user_id = auth.uid()
        )
      )
      OR (
        conversation.conversation_type <> 'group'
        AND (conversation.participant_one = auth.uid() OR conversation.participant_two = auth.uid())
      )
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.resa_chat_message_reads AS read_receipt
      WHERE read_receipt.message_id = message.id
        AND read_receipt.school_id = message.school_id
        AND read_receipt.user_id = auth.uid()
    );
$function$;

DROP POLICY IF EXISTS "group members read conversations" ON public.resa_chat_conversations;
CREATE POLICY "group members read conversations" ON public.resa_chat_conversations
FOR SELECT TO authenticated
USING (
  conversation_type = 'group'
  AND public.has_school_role(school_id, ARRAY['admin'::public.school_role,'teacher'::public.school_role,'student'::public.school_role,'parent'::public.school_role])
  AND EXISTS (
    SELECT 1 FROM public.resa_chat_group_members AS member
    WHERE member.conversation_id = resa_chat_conversations.id
      AND member.school_id = resa_chat_conversations.school_id
      AND member.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "group members update conversation activity" ON public.resa_chat_conversations;
CREATE POLICY "group members update conversation activity" ON public.resa_chat_conversations
FOR UPDATE TO authenticated
USING (
  conversation_type = 'group'
  AND public.has_school_role(school_id, ARRAY['admin'::public.school_role,'teacher'::public.school_role,'student'::public.school_role,'parent'::public.school_role])
  AND EXISTS (
    SELECT 1 FROM public.resa_chat_group_members AS member
    WHERE member.conversation_id = resa_chat_conversations.id
      AND member.school_id = resa_chat_conversations.school_id
      AND member.user_id = auth.uid()
  )
)
WITH CHECK (
  conversation_type = 'group'
  AND public.has_school_role(school_id, ARRAY['admin'::public.school_role,'teacher'::public.school_role,'student'::public.school_role,'parent'::public.school_role])
  AND EXISTS (
    SELECT 1 FROM public.resa_chat_group_members AS member
    WHERE member.conversation_id = resa_chat_conversations.id
      AND member.school_id = resa_chat_conversations.school_id
      AND member.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "participants and admins read chat messages" ON public.resa_chat_messages;
CREATE POLICY "participants and admins read chat messages" ON public.resa_chat_messages
FOR SELECT TO authenticated
USING (
  public.has_school_role(school_id, ARRAY['admin'::public.school_role])
  OR (
    public.has_school_role(school_id, ARRAY['teacher'::public.school_role,'student'::public.school_role,'parent'::public.school_role])
    AND EXISTS (
      SELECT 1 FROM public.resa_chat_conversations AS conversation
      WHERE conversation.id = resa_chat_messages.conversation_id
        AND conversation.school_id = resa_chat_messages.school_id
        AND (conversation.participant_one = auth.uid() OR conversation.participant_two = auth.uid())
    )
  )
);

DROP POLICY IF EXISTS "group members read messages" ON public.resa_chat_messages;
CREATE POLICY "group members read messages" ON public.resa_chat_messages
FOR SELECT TO authenticated
USING (
  public.has_school_role(school_id, ARRAY['admin'::public.school_role,'teacher'::public.school_role,'student'::public.school_role,'parent'::public.school_role])
  AND EXISTS (
    SELECT 1 FROM public.resa_chat_group_members AS member
    WHERE member.conversation_id = resa_chat_messages.conversation_id
      AND member.school_id = resa_chat_messages.school_id
      AND member.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "participants send messages when chat enabled" ON public.resa_chat_messages;
CREATE POLICY "participants send messages when chat enabled" ON public.resa_chat_messages
FOR INSERT TO authenticated
WITH CHECK (
  sender_id = auth.uid()
  AND public.has_school_role(school_id, ARRAY['admin'::public.school_role,'teacher'::public.school_role,'student'::public.school_role,'parent'::public.school_role])
  AND EXISTS (
    SELECT 1 FROM public.resa_chat_settings AS settings
    WHERE settings.school_id = resa_chat_messages.school_id AND settings.chat_enabled = true
  )
  AND EXISTS (
    SELECT 1 FROM public.resa_chat_conversations AS conversation
    WHERE conversation.id = resa_chat_messages.conversation_id
      AND conversation.school_id = resa_chat_messages.school_id
      AND (conversation.participant_one = auth.uid() OR conversation.participant_two = auth.uid())
  )
);

DROP POLICY IF EXISTS "group members send messages" ON public.resa_chat_messages;
CREATE POLICY "group members send messages" ON public.resa_chat_messages
FOR INSERT TO authenticated
WITH CHECK (
  sender_id = auth.uid()
  AND public.has_school_role(school_id, ARRAY['admin'::public.school_role,'teacher'::public.school_role,'student'::public.school_role,'parent'::public.school_role])
  AND EXISTS (
    SELECT 1 FROM public.resa_chat_settings AS settings
    WHERE settings.school_id = resa_chat_messages.school_id AND settings.chat_enabled = true
  )
  AND EXISTS (
    SELECT 1 FROM public.resa_chat_conversations AS conversation
    JOIN public.resa_chat_group_members AS member
      ON member.conversation_id = conversation.id AND member.school_id = conversation.school_id
    WHERE conversation.id = resa_chat_messages.conversation_id
      AND conversation.school_id = resa_chat_messages.school_id
      AND conversation.conversation_type = 'group'
      AND member.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "participants update last message time" ON public.resa_chat_conversations;
CREATE POLICY "participants update last message time" ON public.resa_chat_conversations
FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.resa_chat_settings AS settings
    WHERE settings.school_id = resa_chat_conversations.school_id AND settings.chat_enabled = true
  )
  AND public.has_school_role(school_id, ARRAY['admin'::public.school_role,'teacher'::public.school_role,'student'::public.school_role,'parent'::public.school_role])
  AND (auth.uid() = participant_one OR auth.uid() = participant_two)
)
WITH CHECK (
  public.has_school_role(school_id, ARRAY['admin'::public.school_role,'teacher'::public.school_role,'student'::public.school_role,'parent'::public.school_role])
  AND (auth.uid() = participant_one OR auth.uid() = participant_two)
);

DROP POLICY IF EXISTS "chat participants read conversation receipts" ON public.resa_chat_message_reads;
CREATE POLICY "chat participants read conversation receipts" ON public.resa_chat_message_reads
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.resa_chat_messages AS message
    JOIN public.resa_chat_conversations AS conversation
      ON conversation.id = message.conversation_id AND conversation.school_id = message.school_id
    WHERE message.id = resa_chat_message_reads.message_id
      AND message.school_id = resa_chat_message_reads.school_id
      AND (
        public.has_school_role(message.school_id, ARRAY['admin'::public.school_role])
        OR (
          public.has_school_role(message.school_id, ARRAY['teacher'::public.school_role,'student'::public.school_role,'parent'::public.school_role])
          AND (
            (conversation.conversation_type = 'group' AND EXISTS (
              SELECT 1 FROM public.resa_chat_group_members AS member
              WHERE member.conversation_id = conversation.id
                AND member.school_id = conversation.school_id
                AND member.user_id = auth.uid()
            ))
            OR
            (conversation.conversation_type <> 'group' AND (conversation.participant_one = auth.uid() OR conversation.participant_two = auth.uid()))
          )
        )
      )
  )
);

DROP POLICY IF EXISTS "chat users mark own messages read" ON public.resa_chat_message_reads;
CREATE POLICY "chat users mark own messages read" ON public.resa_chat_message_reads
FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.resa_chat_messages AS message
    JOIN public.resa_chat_conversations AS conversation
      ON conversation.id = message.conversation_id AND conversation.school_id = message.school_id
    WHERE message.id = resa_chat_message_reads.message_id
      AND message.school_id = resa_chat_message_reads.school_id
      AND message.sender_id <> auth.uid()
      AND (
        public.has_school_role(message.school_id, ARRAY['admin'::public.school_role])
        OR (
          public.has_school_role(message.school_id, ARRAY['teacher'::public.school_role,'student'::public.school_role,'parent'::public.school_role])
          AND (
            (conversation.conversation_type = 'group' AND EXISTS (
              SELECT 1 FROM public.resa_chat_group_members AS member
              WHERE member.conversation_id = conversation.id
                AND member.school_id = conversation.school_id
                AND member.user_id = auth.uid()
            ))
            OR
            (conversation.conversation_type <> 'group' AND (conversation.participant_one = auth.uid() OR conversation.participant_two = auth.uid()))
          )
        )
      )
  )
);
