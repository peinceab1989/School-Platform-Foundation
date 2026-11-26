-- Correct the school-scoped guardian relationship check in the recipient
-- authorization helper. This follow-up is deliberately separate so existing
-- deployments can apply it without replaying earlier communication migrations.
do $$
declare
  ddl text;
begin
  ddl := pg_get_functiondef(
    'private.resa_chat_recipient_allowed(uuid,uuid,text)'::regprocedure
  );
  ddl := replace(
    ddl,
    'pg.school_id = pg.school_id',
    'pg.school_id = spg.school_id'
  );
  execute ddl;
end $$;
