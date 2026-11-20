# RESA final handover conclusion — 20 November 2026

## Executive decision

**NO-GO for final production handover at this time.**

The current development branches have passed their latest automated CI checks and the public Cloudflare website has passed read-only browser smoke tests. However, production migrations, payment activation, real Android delivery, complete role-based school acceptance and a verified disaster-recovery rehearsal remain outstanding. A responsible handover cannot be signed off solely because the application compiles or public pages render.

This is a release-control decision, not a rejection of the completed engineering work.

## Verified repository and CI

- Repository: `peinceab1989/School-Platform-Foundation`.
- PR #120: [Class, grading, notification, admissions UX and handover improvements](https://github.com/peinceab1989/School-Platform-Foundation/pull/120).
- PR #120 branch: `improvement/editable-existing-classes`.
- PR #120 latest head: `7fd391696eae03cc276c21b9e462819775b5bb1b`.
- PR #120 GitHub Actions run [44793280064](https://github.com/peinceab1989/School-Platform-Foundation/actions/runs/44793280064) passed: workspace TypeScript, production application build, RESA Edge Function typecheck, parent push-audience tests and notification-preference routing tests.
- PR #123: [Secure Paystack checkout for RESA parent fees](https://github.com/peinceab1989/School-Platform-Foundation/pull/123).
- PR #123 latest head: `0da811a9d63cbca124e467f6e024602cb81a3f8f`.
- PR #123 GitHub Actions run [44791987759](https://github.com/peinceab1989/School-Platform-Foundation/actions/runs/44791987759) passed: workspace TypeScript, production build, Edge Function typecheck, push-audience tests and Paystack webhook signature tests.

Both PRs remain draft, unmerged and undeployed. The CI results validate source/build/tests only; they do not validate production database migrations, live payment processing or real school-user workflows.

## Engineering work represented in PR #120

- Safe in-place editing of existing classes with duplicate-name validation; linked class IDs, enrolments and historical results are preserved.
- Versioned grading configuration using the school-approved editable initial 20/20/50/10 standard, optional coursework split and historical CA 40 / Exam 60 preservation.
- CBT-to-results transfer uses the configured examination maximum and protects saved/published results.
- Parent attendance Web Push now checks the dedicated `parent_attendance_notification_preferences` table and exact guardian/user scope instead of the unrelated general preference table.
- Added tests for parent-specific attendance preference routing and isolation; prevents duplicate foreground native notifications when Web Push is registered.
- Corrected account invitation and recovery redirect targets to the active Cloudflare Pages portal.
- Added a branded RESA 404 page with safe navigation.
- Admissions and external CBT forms now visibly mark required fields, label optional fields and show official Admissions contact details and safe payment guidance without inventing an unapproved form fee.
- RESA Drive and practical-evidence upload controls are aligned to Supabase Free's 50 MB per-file ceiling.
- Updated the navigation guide, final handover report and school acceptance checklist.

## Paystack implementation — PR #123

- Parent-facing full and partial checkout for authorised student fee assignments.
- Server-side initialization and independent transaction verification; no secret key in browser code.
- Modern timestamped `Paystack-Signature` validation over the raw body using HMAC-SHA512, a 300-second replay window, constant-time comparison and all `v1` signatures during secret rotation; legacy signature support remains during migration.
- Private RLS-enabled payment-intent ledger with 30-minute balance reservations, concurrent checkout protection and provider transaction deduplication.
- Atomic, replay-safe fee-payment and official receipt creation after verified settlement.
- Offline bank transfer, POS and cash-at-school-office paths remain available, with Finance verification required before balances/receipts change.

**Production Paystack remains inactive.** The live Supabase project has no `paystack_payment_intents` table, no Paystack settlement RPCs and no deployed `resa-paystack` Edge Function. No merchant credentials, production migration, webhook, charge, refund or live activation has been configured. The migration still requires independent review, isolated-database validation and test-mode end-to-end acceptance.

This PR covers parent school-fee assignments only. Admissions and external CBT form purchases are excluded until the school confirms the exact form fee and whether it covers the admission application, CBT registration or both. No amount has been invented.

## Public website smoke tests

Read-only browser runs completed on 20 November 2026:

- Run [49b0fd8f-5942-407f-ae82-88358d7a3026](https://agent.tinyfish.ai/runs/49b0fd8f-5942-407f-ae82-88358d7a3026): homepage, admissions, portal sign-in, portal-options, About, Academics and Contact rendered; no visible loading errors, broken images or unexpected redirects.
- Run [e4e0e562-6545-4099-b892-d8c551c0c037](https://agent.tinyfish.ai/runs/e4e0e562-6545-4099-b892-d8c551c0c037): `/admissions-apply` and `/external-cbt-registration` rendered. The test found missing visual required-field indicators, missing direct contact details and no fee information. PR #120 now addresses the field labels and contact guidance; fee amounts remain intentionally absent pending school approval.
- The public site is currently hosted at `https://school-platform-foundation.pages.dev/`. The old Netlify URL is a legacy address; new invitation/recovery source redirects now target Cloudflare. Supabase Auth Site URL and redirect allow-list still need a dashboard check before those email flows are accepted.
- The public smoke test found that invalid routes lacked a clear branded 404 experience. PR #120 now includes a branded 404 page; this source change still needs deployment and a post-deploy browser check.

No login, form submission, application creation or production write action was performed during these smoke tests.

## Live operational evidence and outstanding risks

The latest read-only inventory recorded:

- One push subscription total and no parent notification-log rows. Parent Android delivery remains unproven.
- Three parent attendance preference rows were enabled with phone alerts enabled, while 19 general RESA notification preference rows had only one phone-enabled row. The deployed push dispatcher v4 was using the general preference table for attendance; PR #120 corrects the source routing. The fix is not deployed. Real Android check-in/check-out delivery, opt-out and duplicate-alert tests remain mandatory.
- One direct conversation, one message and no group membership data. Real cross-device and group acceptance remain.
- Zero RESA Drive file records and no Drive/practical-evidence Storage objects. Real upload, listing, preview and download remain unproven.
- Zero admission applications and zero external candidate registrations. Full admissions/external CBT journeys remain unproven.
- Existing assignment records exist, but the complete school-user workflow still needs acceptance.
- Dropbox `/RESA MASTER BACKUP/` contains the seven agreed folders and a manifest, but is not a complete verified backup. A current complete source archive, database/Auth recovery material, actual Storage object bytes, required website/school assets, checksums and an isolated restore rehearsal remain outstanding.
- Supabase Free supports a maximum 50 MB individual file upload, even though the RESA bucket-level setting is 100 MB. The application cap is now 50 MB. The requested 100 MB upload capability needs a different storage provider or a higher plan limit; no paid upgrade has been made.
- Supabase Security Advisor still reports two RLS-enabled event tables with no policies, `pg_net` installed in `public`, three anon-executable SECURITY DEFINER public-content functions, 30 authenticated-executable SECURITY DEFINER functions, and leaked-password protection disabled. Public-content RPCs and closed event tables appear intentional; privileged functions require a function-by-function review. Do not blindly revoke grants or move extensions.
- No production data, Auth identities, Storage objects, schema or live payment records were modified during this work.

## Release blockers

1. Independent review of PR #120 and PR #123; keep both unmerged until release evidence is complete.
2. Verify Supabase Auth Site URL and redirect allow-list for Cloudflare invitation and password-recovery routes.
3. Review and validate grading and Paystack migrations in an isolated database; do not apply them directly to production.
4. Complete controlled admin/teacher/student/parent acceptance of class/subject edits, grading, result approval and publication.
5. Test parent Android push registration, check-in/check-out alerts, opt-out and duplicate suppression on a real parent device.
6. Test direct/group messaging, read receipts and unread counts on real role accounts/devices.
7. Test Drive upload/list/preview/download and assignment submission/marking on real accounts.
8. Complete admissions and external CBT registration using approved test identities. Obtain the approved form fee and payment scope before implementing candidate checkout.
9. Complete Paystack test-mode checkout, webhook delivery, retries, concurrency, wrong-parent/fee rejection, receipt issuance and Finance reconciliation before any live activation.
10. Complete a copy-only backup of source, database/Auth recovery material, Storage bytes, website assets and approved school records; encrypt sensitive exports, verify hashes and rehearse restore in an isolated environment.
11. Complete the remaining security-advisor review without blanket permission changes.
12. Obtain written school acceptance and explicit production release approval.

## Required operating safeguards

- Preserve existing production data, Auth identities, schema and Storage objects.
- Do not reset or clean up demo/test records until the school separately authorises a documented cleanup.
- Do not apply PR grading or Paystack migrations to production until independently reviewed, tested against a non-production copy, backed up and separately approved.
- Do not merge or deploy draft PRs as a substitute for acceptance gates.
- Keep the solution within the approved zero-additional-cost requirement. Paystack transaction fees must be disclosed and approved before live use.
- Keep original school assets and backup source files intact; backup is copy-only.
- Do not export secrets or unencrypted sensitive dumps to Dropbox.

## Handover recommendation

Proceed to a scheduled, evidence-recorded school acceptance session and a separate isolated disaster-recovery rehearsal. Update the production completion tracker only when each gate has a named tester, timestamp, expected result, actual result and evidence reference.

**Final conclusion: engineering source and CI are substantially improved, and the public site routes are operational. RESA is not yet ready for final production handover. Maintain NO-GO until the release blockers pass and school management signs off.**
