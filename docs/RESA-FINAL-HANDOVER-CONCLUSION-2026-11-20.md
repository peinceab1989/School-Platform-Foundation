# RESA final handover conclusion — 20 November 2026

## Executive decision

**NO-GO for final production handover at this time.**

The engineering source in draft PR #120 passes the latest automated checks, but critical school acceptance and disaster-recovery evidence is still missing. A responsible handover cannot be signed off solely because the application compiles or CI passes.

This is a technical release decision, not a rejection of the completed engineering work. RESA can proceed to a controlled school acceptance session once the release branch has completed review.

## Verified source and CI

- Repository: `peinceab1989/School-Platform-Foundation`.
- Draft PR: [#120 — Add safe editing for existing school classes](https://github.com/peinceab1989/School-Platform-Foundation/pull/120).
- Branch: `improvement/editable-existing-classes`.
- Latest verified head at the time of this report: `6701c47ee39f28ba64396e2e419c4bb5c261e9e7`.
- GitHub Actions run `44754694957` completed successfully.
- Passed checks: locked dependency installation, workspace TypeScript, production application build, RESA Edge Function typecheck and push-audience authorization tests.
- Earlier run `44754270844` also passed for the preceding checklist commit.

CI success verifies those automated checks only. It does not replace role-based browser testing, real Android push delivery, Storage journeys, school-user acceptance or a disaster-recovery rehearsal.

## Work represented in PR #120

- Existing class editing and safe subject catalogue editing while preserving linked identifiers.
- Admissions enquiry routing and dedicated contact route.
- Zero-cost, locally bundled RESA help-centre assistant; no paid AI invocation or paid AI secret.
- CAT 1 / CAT 2 / examination / coursework grading configuration, versioning and configured CBT exam-mark scaling.
- Acceptance checklist and implementation documentation.
- Corrected PostgreSQL dollar-quoting delimiter in the grading audit trigger.

All grading migrations in PR #120 remain unapplied to production. The PR remains draft and unmerged.

## Live operational evidence and outstanding risks

The latest read-only inventory recorded:

- One push subscription total and no parent notification-log rows. Parent Android delivery remains unproven.
- One direct conversation, one message and no group membership data. Real cross-device and group acceptance remain.
- Zero RESA Drive file records and no Storage objects in the Drive/practical-evidence buckets. Real upload, listing, preview and download remain unproven.
- Zero admission applications and zero external candidate registrations. Full admissions/external CBT journeys remain unproven.
- Existing assignment records exist, but the complete school-user workflow still needs acceptance.
- Dropbox `/RESA MASTER BACKUP/` contains the seven agreed folders and a manifest, but is not a complete verified backup. A current complete source archive, full database/Auth recovery material, Storage object bytes, required website/school assets, checksums and an isolated restore rehearsal remain outstanding.
- Supabase Free plan limitations, including native leaked-password protection availability, remain documented; no paid upgrade is recommended or authorised.
- Paystack implementation is now represented by separate draft PR [#123 — Secure Paystack checkout](https://github.com/peinceab1989/School-Platform-Foundation/pull/123), whose latest head `fa1f702d1f1ac1ba53428d95dfc27f27afe5b45b` passed GitHub Actions run `44789757830` (workspace typecheck, production build, Edge Function typecheck, push authorization tests and Paystack webhook signature tests). Paystack remains inactive: no merchant credentials, production migration, Edge Function deployment, test/live charge or webhook delivery has been configured or accepted. The payment migration still requires isolated-database review and test-mode end-to-end acceptance.

## Release blockers

1. Independent review and approval of PR #120.
2. Controlled admin/teacher/student/parent acceptance of class and subject edits, grading, result approval and publication.
3. Parent Android push registration and verified check-in/check-out delivery.
4. Direct/group messaging and unread/read behaviour on real role accounts and devices.
5. Drive upload/list/preview/download and assignment submission/marking on real accounts.
6. Public admissions and external CBT end-to-end tests using approved test identities and no unauthorised charges.
7. Complete copy-only backup of current source, database/Auth recovery material, Storage bytes, website assets and approved school records.
8. Encrypted handling of sensitive database/Auth dumps, SHA-256 inventory and successful restore rehearsal in an isolated non-production environment.
9. Paystack PR #123 independent code/migration review, isolated migration validation, test-secret configuration, Edge Function deployment to a non-production/test setup and end-to-end payment acceptance; live merchant onboarding and activation remain a later school-authorised step.
10. Written school acceptance and explicit release approval.

## Required operating safeguards

- Preserve existing production data, Auth identities, schema and Storage objects.
- Do not reset or clean up demo/test records until the school separately authorises a documented cleanup.
- Do not apply PR grading migrations to production until they have been independently reviewed, tested against a non-production copy, backed up and separately approved.
- Do not merge or deploy the draft PR as a substitute for the acceptance gates.
- Keep the solution within the approved zero-additional-cost requirement. Paystack transaction fees, if later activated, must be disclosed and approved before use.
- Keep original school assets and backup source files intact; backup is copy-only.
- Do not export secrets or unencrypted sensitive dumps to Dropbox.

## Handover recommendation

Proceed with a scheduled, evidence-recorded school acceptance session and a separate isolated disaster-recovery rehearsal. Update the production completion tracker only when each gate has a named tester, timestamp, expected result, actual result and evidence reference.

**Final conclusion: engineering CI for PR #120 and the latest Paystack PR #123 revision is green; production handover is not yet accepted. Maintain NO-GO until all release blockers pass.**



## Final source verification addendum

The final documentation commit `5e560944a76d430de8b165393145a31a5295e8af` subsequently passed GitHub Actions run `44755275827`. All workflow steps completed successfully: locked dependency installation, workspace TypeScript, production application build, RESA Edge Function typecheck and push-audience authorization tests. This confirms the latest PR branch source is CI-green; it does not close the real-device, school acceptance or disaster-recovery release blockers above.
