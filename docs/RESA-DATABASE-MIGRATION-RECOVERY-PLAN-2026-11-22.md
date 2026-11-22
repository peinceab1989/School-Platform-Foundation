# RESA database migration recovery plan — 22 November 2026

## Findings

A fresh local Supabase replay was attempted in GitHub Actions using a disposable local stack. It stopped at the first repository migration:

- Migration: `20261031000100_cbt_results_integration.sql`
- Error: `relation "public.online_exams" does not exist`
- The migration expects an existing RESA schema, but the repository does not contain the baseline that creates it.

A read-only comparison of the live Supabase migration history and the current feature-branch repository found:

- Live Supabase migration history: **126** recorded versions.
- SQL migration files tracked in the repository: **59**.
- Exact version IDs present in both: **36**.
- Live version IDs without an exact matching repository file: **90**.
- Repository migration-file versions not present in the live history: **23**.

These are exact version-ID comparisons. Some SQL operations may have been captured under different filenames or versions, so this is evidence of migration-history drift, not proof that every unmatched operation is absent from the live schema.

The live database was also checked read-only: core RESA tables such as `online_exams`, `academic_terms`, `student_subject_results`, `student_term_results`, `schools`, `subjects`, and the CBT attempt/question/answer tables exist in production.

## What this means

The current `supabase/migrations` directory is not a complete, reproducible history from an empty database. A normal `supabase start` / `supabase db reset` cannot be used as a full migration test until the baseline and history are reconciled.

This is separate from whether the three new CAT/grading/CBT migrations are valid. Those three migrations need their own isolated test against a synthetic schema fixture matching the relevant production table contracts. The fixture contains no production data and is explicitly not a production schema dump.

## Safe recovery plan

1. Keep the live Supabase database untouched.
2. Export a **schema-only** snapshot from the live project through an authorised local Supabase CLI session. Do not export production rows, Auth users, Storage objects, or secrets.
3. Review the dump for extensions, custom Auth/Storage policies, functions, grants, triggers, and any environment-specific statements before it is committed or used.
4. Build a new clean local baseline from the reviewed schema snapshot. Preserve the old SQL files outside the active migrations directory as historical reference until each is reconciled.
5. Test a fresh local reset from that baseline, then apply the three pending migrations and run regression tests.
6. Reconcile the live migration-history metadata only after the baseline is reviewed and the exact production effect is understood. Do not run `supabase db pull`, `supabase migration repair`, `supabase db push`, or any linked reset against production as part of this recovery without a separately reviewed release plan.

## Important CLI distinction

Supabase's documented `db dump` exports schema without recording a new migration-history row. `db pull` creates a baseline migration and records it as applied in the remote migration history. Therefore, use a reviewed schema-only dump first; do not use `db pull` as a casual troubleshooting step against production.

## Current safeguards

- No production migration was applied.
- No production schema, row, Auth setting, Storage object, Edge Function, or Cloudflare deployment was changed.
- The full-replay CI experiment used only a disposable GitHub Actions environment and was stopped after its expected baseline failure.
- A separate PostgreSQL CI test now applies only the three pending grading/CBT migrations to a synthetic baseline and exercises legacy-mark preservation, admin-only configuration, score boundaries, result identity validation, CBT scaling, idempotency, overwrite protection, and published-result protection.
- The three pending migrations remain unreleased until the targeted tests pass and the complete baseline/history recovery is reviewed.
