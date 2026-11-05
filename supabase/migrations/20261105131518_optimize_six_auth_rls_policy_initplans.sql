DO $$
DECLARE
  p record;
  new_using text;
BEGIN
  FOR p IN
    SELECT schemaname, tablename, policyname, qual
    FROM pg_policies
    WHERE schemaname = 'public'
      AND (tablename, policyname) IN (
        ('staff','school members can read staff'),
        ('teacher_assignments','school members can read teacher assignments'),
        ('class_timetables','school members can read class timetables'),
        ('message_broadcasts','school members can read broadcasts'),
        ('school_form_submissions','school members can read form submissions'),
        ('student_portal_accounts','school members can read student portal accounts')
      )
  LOOP
    new_using := replace(p.qual, 'auth.uid()', '(select auth.uid())');
    IF new_using IS DISTINCT FROM p.qual THEN
      EXECUTE format('ALTER POLICY %I ON %I.%I USING (%s)',
        p.policyname, p.schemaname, p.tablename, new_using);
    END IF;
  END LOOP;
END $$;
