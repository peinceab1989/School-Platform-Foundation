# RESA Release Readiness Evidence — 21 November 2026

## Release decision

**NO-GO for production release at this checkpoint.** The development branch builds and passes the current automated checks, and the read-only review found no reason to reset or alter production records. Authenticated school acceptance, isolated migration validation, backup/restore rehearsal, and final Cloudflare deployment verification remain outstanding.

No production deployment, database migration, school-record update, authentication change, or test-record creation was performed during this review.

## Source and CI

- Repository: `peinceab1989/School-Platform-Foundation`
- Release candidate branch: `improvement/editable-existing-classes`
- Current reviewed branch head: `6d63fcee7a5c4d9874b94cad03f119b1ac4f95fd`
- Main baseline: `209cbb5e96f3650d57cbc0b81e2214e5aac1203c`
- Pull request: [#120 — Add safe editing for existing school classes](https://github.com/peinceab1989/School-Platform-Foundation/pull/120)
- Latest RESA workflow: [Run 44898373289](https://github.com/peinceab1989/School-Platform-Foundation/actions/runs/44898373289) — **passed** (workspace typecheck, production build, Edge Function typecheck, push-audience tests, notification-preference routing tests).
- The branch is still marked one commit behind `main` in Git history. The admissions-contact/fee-guidance change from the latest main commit is already present in the branch: `public-pages.tsx` has the same blob SHA on both refs. The PR remains draft/open.
- Legacy Netlify preview statuses are failing and are not evidence of a Cloudflare Pages build. Netlify build minutes were previously exhausted.

## Settings Centre

- Development code now loads the six Settings data sources concurrently and applies a 15-second timeout so the page cannot remain indefinitely on “Loading settings…”.
- The code returns a visible recovery error when a request fails or the timeout is reached.
- Production schema inspection found one school settings row, one academic session and one academic term for RESA. Read policies exist for school members; administrator policies allow school settings and school-name updates. The Customer Care settings table has admin management and member-read policies.
- This is a code-level fix, not a confirmed authenticated repair. No signed-in browser profile was available during this review, so the exact request failure has not yet been reproduced under the administrator account.

## Ask RESA and Customer Care

- The production Customer Care setting row exists and is currently enabled.
- The public status RPC returns only a boolean for the RESA school ID; it does not expose student or private school records.
- The release-candidate widget polls status every 60 seconds, shows an availability invitation when the team is marked available, and offers a WhatsApp handoff to the published school number.
- The virtual assistant uses a reviewed local help library and does not call a paid AI API. It does not access private records or act as a native live-agent inbox.
- Human response time, WhatsApp delivery and staff availability have not been verified by a live support conversation.

## Public website smoke checks

Read-only public pages rendered at the Cloudflare Pages URL:
- Homepage
- Admissions information
- Admissions application route `/admissions-apply`
- External CBT registration
- Maps
- Portal sign-in
- About
- Contact

No forms were submitted. The route `/admissions-application` returns 404 because it is not the linked route; the correct public route is `/admissions-apply`. The live deployment's exact source SHA was not independently confirmed from the Cloudflare dashboard.

## Admissions, CBT and grading

- Production migration history currently ends at `20261120100440`.
- These release-candidate migrations are pending and were not applied:
  - `20261120140000_add_cat1_cat2_scores.sql`
  - `20261120150000_versioned_grading_configuration.sql`
  - `20261120160000_cbt_transfer_uses_configured_exam_max.sql`
- Read-only aggregate checks found zero admission applications, zero external-candidate form purchases and zero external-candidate registrations. The public forms render, and the admissions and external-candidate registration Edge Functions are active. A verified form purchase is required before a real application/registration can be submitted; no form was fabricated for testing.
- Four exams are currently marked published and 21 CBT attempts are submitted. No attempt was created, edited or transferred during this review.
- The grading migration preserves historical combined CA results rather than splitting them into invented CAT 1/CAT 2 values. It introduces term-versioned maxima and server-side score validation.
- Migration review identified a need to protect the configuration-version and audit tables from direct client inserts. The release-candidate migration now routes configuration creation through an explicitly authorised, fixed-search-path SECURITY DEFINER RPC and makes the audit insert trigger owner-executed; authenticated users retain read access but cannot fabricate audit rows directly.
- Results Management no longer creates a grading configuration silently when an administrator opens the page. The administrator must explicitly initialise the proposed default. The RPC also blocks initialisation or version changes once any subject scores exist for the term; migration seeding must therefore preserve legacy terms before the application is released.
- The SQL migrations still require isolated-database execution tests, including legacy-result preservation, score-boundary cases, role denial, audit immutability, and CBT transfer/replay/overwrite tests. CI does not execute these migrations.

## Fees and payments

- Read-only counts show one fee assignment, one payment and one receipt.
- Integrity checks found no payment missing a receipt number, no receipt without a payment, no payment without a receipt record, and no receipt/payment amount mismatch.
- Paystack is not confirmed live or enabled. The Paystack implementation and administrator switch are in separate draft PRs; parent Payment Clearance ID enforcement and isolated test-mode checkout remain release gates. No charge or payment was initiated.

## Messaging and role permissions

- Read-only counts show one chat message and zero group-member rows. This is insufficient to prove a two-device direct/group messaging journey.
- RLS inspection shows group messages are scoped to active group membership; direct messages are scoped to conversation participants; administrators manage group membership. Push subscriptions are self-managed by the signed-in user with active school membership.
- Result policies restrict students to their own published results, parents to published results for linked children, and teachers to assigned subjects/classes while active. Administrator management is school-scoped.
- These are structural policy checks, not successful sign-in tests using separate parent, teacher, student and administrator accounts.

## Notifications

- Read-only counts show three parent attendance preference rows, one push subscription, 27 biometric-parent notification records, zero parent notification-log rows and zero smart-access notification-outbox rows.
- The production `resa-push-dispatch` Edge Function is version 4. Its deployed source does not yet use the dedicated parent attendance notification-preference resolver included in the release-candidate branch. The branch implementation is source-only until the Edge Function is redeployed.
- The latest branch CI passes push-audience authorization and notification-preference routing tests.
- Real Android permission, subscription, background delivery, event timing, duplicate suppression and parent receipt/acknowledgement still require device testing.

## Edge Function deployment delta

Read-only comparison of deployed Edge Function source with the release-candidate branch found:
- `resa-invite-staff`: production version 5 still lacks the Cloudflare redirect origin that the branch adds.
- `resa-create-student-login`: production version 4 still lacks the Cloudflare redirect origin that the branch adds.
- `resa-link-staff-login`: production version 3 still lacks the Cloudflare redirect origin that the branch adds.
- `resa-push-dispatch`: production version 4 lacks the branch's dedicated parent-attendance preference routing.
- `resa-admission-application-submit`: production version 1 already contains the Cloudflare origin, although the branch source has a small additional change.

After merge approval, redeploy the reviewed function versions in a controlled sequence, then verify invitation/recovery links and push delivery. Before doing so, confirm the Supabase Auth Site URL and redirect allow-list include the Cloudflare production URL and the exact preview URL patterns. No Edge Function was deployed during this review.

## Supabase advisory review

Current advisory categories include:
- Two RLS-enabled rate-limit/event tables with no client policies (service-role-only access by design; verify this remains intentional).
- One public-schema `pg_net` extension warning.
- Three publicly executable SECURITY DEFINER RPCs; the Customer Care RPC was inspected and returns only a boolean for the fixed RESA school. The public announcement/content RPCs need the same data-minimisation review.
- Thirty authenticated SECURITY DEFINER RPC warnings requiring function-by-function review, not blanket revocation.
- One Auth leaked-password protection warning; confirm availability on the current Free plan before attempting to enable.
- Performance notices: 12 RLS init-plan patterns, 132 multiple-permissive-policy findings, 58 unindexed foreign keys and 415 unused indexes. These need prioritised review; unused indexes should not be dropped without workload evidence.

## Required school acceptance before release

1. Use a signed-in administrator browser session to reproduce Settings loading, inspect the actual failing request (if any), and verify refresh/save/Customer Care toggle.
2. Test Ask RESA known/unknown questions, availability transition, WhatsApp handoff and a real human response.
3. Test admissions with a school-approved test form; verify duplicate-use prevention and pending review.
4. Test enrolled-student CBT separately from external-candidate CBT, including published exam visibility, submission, marking and transfer.
5. Validate CAT 1/CAT 2 and grading migrations in an isolated database before production migration.
6. Test Finance pending/verified payment and receipt behaviour; complete Paystack test-mode/clearance review before any activation.
7. Test direct/group messaging across two devices with admin, teacher, parent and student accounts.
8. Test parent attendance notification preferences and real Android push delivery at the correct attendance event.
9. Complete Drive and assignment upload/submission journeys.
10. Verify Auth redirect URLs, backup file hashes, and a restore rehearsal in an isolated environment.
11. Confirm the exact Cloudflare production deployment SHA and preview build for the release candidate.
12. Obtain explicit school-owner release confirmation before merge, production migrations or deployment.

## Protected actions

Do not reset production data, delete test records, rotate credentials, change Auth settings, apply migrations, merge the PR or deploy Cloudflare without the appropriate explicit release approval.
