-- RESA CAT 1 / CAT 2 breakdown
-- Additive only: legacy CA totals are deliberately not split or rewritten.
alter table public.student_subject_results
  add column if not exists cat1_score numeric,
  add column if not exists cat2_score numeric;

alter table public.student_subject_results
  drop constraint if exists student_subject_results_cat1_score_range,
  drop constraint if exists student_subject_results_cat2_score_range,
  drop constraint if exists student_subject_results_cat_total_consistency;

alter table public.student_subject_results
  add constraint student_subject_results_cat1_score_range
    check (cat1_score is null or cat1_score >= 0),
  add constraint student_subject_results_cat2_score_range
    check (cat2_score is null or cat2_score >= 0),
  add constraint student_subject_results_cat_total_consistency
    check (
      (cat1_score is null and cat2_score is null)
      or (
        cat1_score is not null
        and cat2_score is not null
        and abs(coalesce(ca_score, 0) - (cat1_score + cat2_score)) < 0.001
      )
    );

comment on column public.student_subject_results.cat1_score is
  'Continuous Assessment Test 1 score; the maximum is determined by the versioned term grading configuration. NULL denotes a legacy combined CA record.';
comment on column public.student_subject_results.cat2_score is
  'Continuous Assessment Test 2 score; the maximum is determined by the versioned term grading configuration. NULL denotes a legacy combined CA record.';
