# RESA Release Readiness Evidence — 21 November 2026

## Release decision

**NO-GO for production release at this checkpoint.** The development branch builds and passes the current automated checks, and the read-only review found no reason to reset or alter production records. Authenticated school acceptance, isolated migration validation, backup/restore rehearsal, and final Cloudflare deployment verification remain outstanding.

No production deployment, database migration, school-record update, authentication change, or test-record creation was performed during this review.

## Source and CI

- Repository: `peinceab1989/School-Platform-Foundation`
- Release candidate branch: `improvement/editable-existing-classes`
- Latest reviewed application-code head: `23b98d96f4489ac3572ddd3bf1624034888e8ae4`
- Main baseline: `209cbb5e96f3650d57cbc0b81e2214e5aac1203c`
- Pull request: [#120 — Add safe editing for existing school classes](https://github.com/peinceab1989/School-Platform-Foundation/pull/120)
- Application-code workflow: [Run 44899030602](https://github.com/peinceab1989/School-Platform-Foundation/actions/runs/44899030602) — **passed** on the latest code commit (workspace typecheck, production build, Edge Function typecheck, push-audience tests, notification-preference routing tests).
- Documentation follow-up workflow: [Run 44899231180](https://github.com/peinceab1989/School-Platform-Foundation/actions/runs/44899231180) — **passed** with the readiness evidence update.
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

The route `/admissions-application` returns 404 because it is not the linked route; the correct public route is `/admissions-apply`. The live deployment's exact source SHA was not independently confirmed from the Cloudflare dashboard.

A live, read-only browser test of Ask RESA confirmed that a known question about checking results returns a curated answer and a Results Management link; an unrelated question receives a safe fallback instead of an invented answer. The live widget has a WhatsApp Customer Care handoff in its footer, but it does not show a live Customer Care availability indicator. The release-candidate branch adds availability polling/status, but that code is not live yet.

A negative-path admissions test entered only a fictitious, unissued form number and clicked `Verify form`. The server rejected it and no application was created. The live page displayed a generic `Edge Function returned a non-2xx status code` alert instead of the specific server explanation. The branch contains improved parsing of the Edge Function error response; verify the friendlier message on a branch preview before release. No applicant details were entered and no application submission or payment was attempted.

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
- Three publicly executable SECURITY DEFINER RPCs. All three were inspected: Customer Care returns only a boolean for the fixed RESA school; the announcement RPC returns only published, currently active announcements for RESA; the website-content RPC returns only published, currently active public content for RESA. All use an empty search_path and schema-qualified object references.
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

## Controlled Cloudflare release sequence

1. Complete the isolated database migration test and verify the backup/restore rehearsal.
2. Confirm the Supabase Auth Site URL and redirect allow-list for the Cloudflare production and approved preview URLs.
3. Under separate final release approval, apply the three reviewed migrations in timestamp order: CAT 1/CAT 2 columns, versioned grading configuration, then configured-exam-maximum CBT transfer. Run the post-migration catalog, policy, legacy-score and configuration checks before application deployment.
4. Merge the reviewed release candidate to `main`; Cloudflare Pages is configured to build from `main` using Node 22, `pnpm run build`, and `artifacts/school-platform/dist/public`.
5. Deploy the reviewed Supabase Edge Function updates: parent push dispatcher, staff invitation, student-login creation, staff-login linking, and the admissions application function if its final diff remains required. Keep the current production functions in service until the reviewed replacements are ready.
6. Verify the Cloudflare deployment SHA, public routes, admin Settings, Customer Care status/handoff, role permissions, parent Android push, admissions, CBT, grading, finance and messaging.
7. Keep the previous Cloudflare deployment available for application rollback. Do not roll back schema destructively; use a forward migration if a database correction is required.

## Protected actions

Do not reset production data, delete test records, rotate credentials, change Auth settings, apply migrations, merge the PR or deploy Cloudflare without the appropriate explicit release approval.


## Authenticated acceptance evidence — 21 November 2026 (administrator session)

A signed-in RESA administrator browser session was available for read-only checks.

### Settings Centre
All six Settings areas loaded without a spinner, visible error or permission denial: School profile/academic defaults, Staff & other users, Admin profile, Account & passwords, and Password & security. The school profile displayed the correct school name, motto and address, 2026/2027 session, Customer Care enabled, and First Term marked **DEMO ONLY**. The configured website URL still points to the legacy Netlify URL, and the logo URL is blank. No settings were changed. This live check did not reproduce the original infinite-loading issue; the branch timeout remains a defensive recovery improvement rather than a proven root-cause fix.

The administrator settings page displays a Customer Care WhatsApp number different from the number embedded in the public Ask RESA widget. The settings page showed 07010945774; the live public widget's handoff URL is `https://wa.me/2348058422691`. Confirm which number is the intended Customer Care destination before changing either value.

### Ask RESA and Customer Care
The currently deployed widget is still the older curated-help version. It does not display Customer Care availability. The known question “What is the full name of RESA?” failed to match the current help library; the unknown private-account question safely returned a refusal/fallback and did not reveal private data. The WhatsApp handoff link is correctly formatted and points to +234 805 842 2691. No message was sent.

The release-candidate branch adds school-name/location and other reviewed help topics, a Customer Care availability indicator/poll, and the 60-second status refresh. These improvements are source-only until release.

### Administrator route checks
The following pages loaded in the authenticated administrator session:
- `/results-management`: displays legacy CA 40 + Examination 60. The new CAT 1/CAT 2 versioned grading UI is not yet live.
- `/examinations`: published/demo exam cards and CBT transfer statuses displayed.
- `/fees`: finance dashboard displayed; its single fee type is explicitly labelled DEMO ONLY / NOT PAYABLE.
- `/school-communication`: inbox and direct/group/announcement controls displayed.
- `/notifications`: inbox and device registration controls displayed, but the browser session reported notification permission not granted.
- `/admissions-management`: working administrator dashboard, currently 0 applications, 0 awaiting review, 0 unused verified forms.
- `/external-cbt-management`: working administrator dashboard, currently 0 awaiting candidates, 0 approved candidates, 0 unused verified forms.
- `/external-cbt-registration`: public external-candidate form rendered.
- `/admissions-apply`: public application form rendered. A fictitious unissued form number was rejected, but the live UI showed the generic message `Edge Function returned a non-2xx status code`, rather than a useful validation explanation. No application or form record was created.

### Live test-data and notification findings
Read-only production checks show:
- 7 active admin memberships, 3 parent memberships, 7 student memberships and 7 teacher memberships (membership counts are role-specific: 2 admins, 3 parents, 7 students, 7 teachers).
- 7 active student portal accounts and 3 active parent portal accounts; 7 student records and 7 staff records have linked auth user IDs.
- `school_messages` contains 7,200 rows, of which 7,198 are unread. 7,192 are attendance checkpoint alerts, 7,191 of those unread. The current-day attendance checkpoint set contains 8 staff and 12 student alerts, with up to 11 reminders already sent to each pending alert. This matches the configured repeated-reminder behaviour until acknowledgement, but the very large unread backlog must be reviewed during the agreed test-data cleanup and school acceptance; do not bulk-delete or mass-mark read without owner approval.
- Existing notification inbox displayed 3,576 unread items for the signed-in administrator session. This is a user-visible backlog, not proof that 3,576 notifications were delivered to parent devices.
- The public widget and Settings page disagree on the Customer Care WhatsApp number; see above.

### Scope of role testing
The live browser session authenticated only as a school administrator. Parent, teacher and student dashboards were not signed into with their own accounts during this pass. Database membership counts and RLS policy definitions were inspected read-only, but this does not substitute for separate role-specific sign-in acceptance and cross-account data-isolation tests.

## Updated release decision

**NO-GO for production release / school handover.** The administrator Settings pages and main management routes render, and admissions/CBT admin dashboards are present. Remaining blockers include:
1. Verify parent, teacher and student journeys using their own approved accounts.
2. Confirm the correct Customer Care WhatsApp number and make the public widget availability indicator and improved help library live only after release approval.
3. Resolve the generic admission form validation error shown on the live page.
4. Complete notification permission and real parent Android push acceptance.
5. Review the large attendance-alert unread backlog and agree the test-data cleanup plan; do not delete or mark messages read without explicit approval.
6. Decide when to replace DEMO ONLY session/term, fee and result data with school-approved operational records.
7. Verify the configured website URL and logo asset in Settings; no settings were changed during this pass.
8. Run isolated migration tests and then the approved release sequence.

No production data, settings, Auth accounts, migrations, Edge Functions, Cloudflare deployment, or PR merge were changed during these acceptance checks.
