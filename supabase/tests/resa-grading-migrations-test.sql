-- Behavioural regression tests for the pending RESA grading/CBT migrations.
-- Run after the synthetic baseline and the three migration files.

SET request.jwt.claim.sub = '20000000-0000-0000-0000-000000000001';
SET request.jwt.claim.role = 'admin';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.online_exams
    WHERE id IS NULL
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'online_exams' AND column_name = 'term_id'
  ) THEN
    RAISE EXCEPTION 'Migration did not add online_exams.term_id';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.school_grading_configurations
    WHERE school_id = '10000000-0000-0000-0000-000000000001'
      AND academic_session_id = '60000000-0000-0000-0000-000000000001'
      AND term_id = '70000000-0000-0000-0000-000000000001'
      AND version = 1 AND cat1_max = 20 AND cat2_max = 20
      AND exam_max = 60 AND coursework_max = 0
  ) THEN
    RAISE EXCEPTION 'Legacy grading configuration was not seeded as 20/20/60/0';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.student_subject_results
    WHERE id = '81000000-0000-0000-0000-000000000001'
      AND ca_score = 40 AND exam_score = 60 AND total_score = 100
      AND cat1_score IS NULL AND cat2_score IS NULL
      AND grading_configuration_id IS NULL
  ) THEN
    RAISE EXCEPTION 'Historical combined-CA result was modified';
  END IF;
END;
$$;

-- Existing terms with saved marks cannot have their grading scheme rewritten.
DO $$
BEGIN
  BEGIN
    PERFORM public.create_school_grading_configuration(
      '10000000-0000-0000-0000-000000000001',
      '60000000-0000-0000-0000-000000000001',
      '70000000-0000-0000-0000-000000000001',
      20, 20, 50, 10, 4, 3, 3
    );
    RAISE EXCEPTION 'Expected legacy-term configuration change to be rejected';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM = 'Expected legacy-term configuration change to be rejected' THEN
      RAISE;
    END IF;
  END;
END;
$$;

-- A teacher cannot create an administrator-only grading configuration.
SET request.jwt.claim.role = 'teacher';
DO $$
BEGIN
  BEGIN
    PERFORM public.create_school_grading_configuration(
      '10000000-0000-0000-0000-000000000001',
      '60000000-0000-0000-0000-000000000001',
      '70000000-0000-0000-0000-000000000002',
      20, 20, 50, 10, 4, 3, 3
    );
    RAISE EXCEPTION 'Expected teacher role to be rejected';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM = 'Expected teacher role to be rejected' THEN
      RAISE;
    END IF;
  END;
END;
$$;

SET request.jwt.claim.role = 'admin';

CREATE TEMP TABLE test_grading_config AS
SELECT public.create_school_grading_configuration(
  '10000000-0000-0000-0000-000000000001',
  '60000000-0000-0000-0000-000000000001',
  '70000000-0000-0000-0000-000000000002',
  20, 20, 50, 10, 4, 3, 3
) AS id;

DO $$
DECLARE
  cfg_id uuid;
BEGIN
  SELECT id INTO cfg_id FROM test_grading_config;

  IF NOT EXISTS (
    SELECT 1 FROM public.school_grading_configuration_audit
    WHERE grading_configuration_id = cfg_id AND action = 'created'
  ) THEN
    RAISE EXCEPTION 'Grading configuration audit row was not written';
  END IF;

  IF has_table_privilege('authenticated', 'public.school_grading_configurations', 'INSERT') THEN
    RAISE EXCEPTION 'Authenticated users must not insert grading configurations directly';
  END IF;

  IF has_table_privilege('authenticated', 'public.school_grading_configuration_audit', 'INSERT') THEN
    RAISE EXCEPTION 'Authenticated users must not insert audit rows directly';
  END IF;

  IF has_function_privilege('anon', 'public.create_school_grading_configuration(uuid,uuid,uuid,numeric,numeric,numeric,numeric,numeric,numeric,numeric)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Anonymous users must not execute the grading configuration RPC';
  END IF;
END;
$$;

INSERT INTO public.student_term_results (
  id, school_id, student_id, academic_session_id, term_id, class_id,
  total_score, average_score, workflow_status
) VALUES (
  '80000000-0000-0000-0000-000000000002',
  '10000000-0000-0000-0000-000000000001',
  '30000000-0000-0000-0000-000000000001',
  '60000000-0000-0000-0000-000000000001',
  '70000000-0000-0000-0000-000000000002',
  '40000000-0000-0000-0000-000000000001',
  0, 0, 'draft'
);

INSERT INTO public.student_subject_results (
  id, school_id, term_result_id, student_id, subject_id,
  cat1_score, cat2_score, ca_score, exam_score, coursework_score,
  notes_score, assignments_score, projects_score,
  grading_configuration_id, total_score, grade
)
SELECT
  '81000000-0000-0000-0000-000000000002',
  '10000000-0000-0000-0000-000000000001',
  '80000000-0000-0000-0000-000000000002',
  '30000000-0000-0000-0000-000000000001',
  '50000000-0000-0000-0000-000000000001',
  20, 20, 40, 50, 10, 4, 3, 3, id, 100, 'A'
FROM test_grading_config;

-- Component maxima are enforced by the selected version.
DO $$
DECLARE
  cfg_id uuid;
BEGIN
  SELECT id INTO cfg_id FROM test_grading_config;
  BEGIN
    INSERT INTO public.student_subject_results (
      school_id, term_result_id, student_id, subject_id,
      cat1_score, cat2_score, ca_score, exam_score, coursework_score,
      grading_configuration_id, total_score
    ) VALUES (
      '10000000-0000-0000-0000-000000000001',
      '80000000-0000-0000-0000-000000000002',
      '30000000-0000-0000-0000-000000000001',
      '50000000-0000-0000-0000-000000000001',
      21, 20, 41, 50, 10, cfg_id, 101
    );
    RAISE EXCEPTION 'Expected CAT 1 score above its maximum to be rejected';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM = 'Expected CAT 1 score above its maximum to be rejected' THEN
      RAISE;
    END IF;
  END;

  BEGIN
    UPDATE public.student_subject_results
    SET student_id = '30000000-0000-0000-0000-000000000002'
    WHERE id = '81000000-0000-0000-0000-000000000002';
    RAISE EXCEPTION 'Expected cross-student result identity change to be rejected';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM = 'Expected cross-student result identity change to be rejected' THEN
      RAISE;
    END IF;
  END;

  BEGIN
    PERFORM public.create_school_grading_configuration(
      '10000000-0000-0000-0000-000000000001',
      '60000000-0000-0000-0000-000000000001',
      '70000000-0000-0000-0000-000000000002',
      25, 15, 50, 10, 4, 3, 3
    );
    RAISE EXCEPTION 'Expected grading configuration change after saved marks to be rejected';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM = 'Expected grading configuration change after saved marks to be rejected' THEN
      RAISE;
    END IF;
  END;
END;
$$;

-- CBT scores scale to the term's configured exam maximum, not a hard-coded 60.
INSERT INTO public.online_exams (
  id, school_id, academic_session_id, class_id, subject_id, title, total_marks, term_id
) VALUES (
  '90000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  '60000000-0000-0000-0000-000000000001',
  '40000000-0000-0000-0000-000000000001',
  '50000000-0000-0000-0000-000000000001',
  'Synthetic CBT exam', 100, '70000000-0000-0000-0000-000000000002'
);

INSERT INTO public.online_exam_attempts (
  id, school_id, exam_id, student_id, status, submitted_at
) VALUES (
  '91000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  '90000000-0000-0000-0000-000000000001',
  '30000000-0000-0000-0000-000000000002',
  'submitted', now()
);

INSERT INTO public.online_exam_questions (id, school_id, exam_id, question_type, marks)
VALUES
  ('92000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '90000000-0000-0000-0000-000000000001', 'multiple_choice', 50),
  ('92000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', '90000000-0000-0000-0000-000000000001', 'multiple_choice', 50);

INSERT INTO public.online_exam_answers (school_id, attempt_id, question_id, marks_awarded)
VALUES
  ('10000000-0000-0000-0000-000000000001', '91000000-0000-0000-0000-000000000001', '92000000-0000-0000-0000-000000000001', 40),
  ('10000000-0000-0000-0000-000000000001', '91000000-0000-0000-0000-000000000001', '92000000-0000-0000-0000-000000000002', 30);

CREATE TEMP TABLE test_cbt_transfer AS
SELECT public.resa_transfer_cbt_attempt('91000000-0000-0000-0000-000000000001') AS payload;

DO $$
DECLARE
  payload jsonb;
BEGIN
  SELECT payload INTO payload FROM test_cbt_transfer;
  IF payload->>'success' <> 'true'
    OR payload->>'already_transferred' <> 'false'
    OR payload->>'exam_score' <> '35.00'
    OR payload->>'exam_max' <> '50.00' THEN
    RAISE EXCEPTION 'CBT transfer did not scale 70/100 to 35/50: %', payload;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.student_subject_results
    WHERE student_id = '30000000-0000-0000-0000-000000000002'
      AND subject_id = '50000000-0000-0000-0000-000000000001'
      AND exam_score = 35 AND grading_configuration_id IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'CBT transfer did not write the expected examination mark';
  END IF;
END;
$$;

-- Repeating a successful transfer is idempotent.
CREATE TEMP TABLE test_cbt_replay AS
SELECT public.resa_transfer_cbt_attempt('91000000-0000-0000-0000-000000000001') AS payload;

DO $$
DECLARE
  payload jsonb;
BEGIN
  SELECT payload INTO payload FROM test_cbt_replay;
  IF payload->>'already_transferred' <> 'true' THEN
    RAISE EXCEPTION 'Repeated CBT transfer was not treated as idempotent: %', payload;
  END IF;
END;
$$;

-- A different attempt must not overwrite an existing subject examination mark.
INSERT INTO public.online_exam_attempts (
  id, school_id, exam_id, student_id, status, submitted_at
) VALUES (
  '91000000-0000-0000-0000-000000000002',
  '10000000-0000-0000-0000-000000000001',
  '90000000-0000-0000-0000-000000000001',
  '30000000-0000-0000-0000-000000000002',
  'submitted', now()
);

INSERT INTO public.online_exam_answers (school_id, attempt_id, question_id, marks_awarded)
VALUES
  ('10000000-0000-0000-0000-000000000001', '91000000-0000-0000-0000-000000000002', '92000000-0000-0000-0000-000000000001', 45),
  ('10000000-0000-0000-0000-000000000001', '91000000-0000-0000-0000-000000000002', '92000000-0000-0000-0000-000000000002', 45);

DO $$
BEGIN
  BEGIN
    PERFORM public.resa_transfer_cbt_attempt('91000000-0000-0000-0000-000000000002');
    RAISE EXCEPTION 'Expected CBT overwrite to be rejected';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM = 'Expected CBT overwrite to be rejected' THEN
      RAISE;
    END IF;
  END;
END;
$$;

-- Published term results cannot be changed by CBT transfer.
INSERT INTO public.student_term_results (
  id, school_id, student_id, academic_session_id, term_id, class_id,
  total_score, average_score, workflow_status
) VALUES (
  '80000000-0000-0000-0000-000000000003',
  '10000000-0000-0000-0000-000000000001',
  '30000000-0000-0000-0000-000000000003',
  '60000000-0000-0000-0000-000000000001',
  '70000000-0000-0000-0000-000000000002',
  '40000000-0000-0000-0000-000000000001',
  0, 0, 'published'
);

INSERT INTO public.online_exam_attempts (
  id, school_id, exam_id, student_id, status, submitted_at
) VALUES (
  '91000000-0000-0000-0000-000000000003',
  '10000000-0000-0000-0000-000000000001',
  '90000000-0000-0000-0000-000000000001',
  '30000000-0000-0000-0000-000000000003',
  'submitted', now()
);

INSERT INTO public.online_exam_answers (school_id, attempt_id, question_id, marks_awarded)
VALUES
  ('10000000-0000-0000-0000-000000000001', '91000000-0000-0000-0000-000000000003', '92000000-0000-0000-0000-000000000001', 40),
  ('10000000-0000-0000-0000-000000000001', '91000000-0000-0000-0000-000000000003', '92000000-0000-0000-0000-000000000002', 40);

DO $$
BEGIN
  BEGIN
    PERFORM public.resa_transfer_cbt_attempt('91000000-0000-0000-0000-000000000003');
    RAISE EXCEPTION 'Expected published result transfer to be rejected';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM = 'Expected published result transfer to be rejected' THEN
      RAISE;
    END IF;
  END;
END;
$$;

-- Unauthenticated callers cannot invoke CBT transfer.
SET request.jwt.claim.sub = '';
DO $$
BEGIN
  BEGIN
    PERFORM public.resa_transfer_cbt_attempt('91000000-0000-0000-0000-000000000001');
    RAISE EXCEPTION 'Expected unauthenticated CBT transfer to be rejected';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM = 'Expected unauthenticated CBT transfer to be rejected' THEN
      RAISE;
    END IF;
  END;
END;
$$;

RESET request.jwt.claim.sub;
RESET request.jwt.claim.role;

SELECT 'RESA grading and CBT migration tests passed' AS result;
