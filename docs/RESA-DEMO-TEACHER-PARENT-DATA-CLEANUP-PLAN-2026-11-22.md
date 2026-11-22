# RESA demo teacher and parent data clean-up plan

**Status:** Preparation only — no records have been deleted or changed.  
**Scope confirmed by the school owner:** Teacher and parent accounts/records currently present in RESA are test data, not genuine school users. This statement does not automatically classify student, administrator, school, class, examination, result, finance, or other records as disposable.

## Objectives

- Deliver a clean handover without demo teacher or parent identities being mistaken for real users.
- Preserve the live RESA application, administrator access, school configuration, student/exam/result records, audit history, and security controls.
- Keep the current production database untouched until a separately approved clean-up window.

## Mandatory safeguards before any deletion

1. **Inventory first:** identify every teacher and parent test identity using stable user IDs and linked profile IDs. Map foreign-key relationships and references across Auth users, profiles, staff/guardian records, class assignments, parent-student links, attendance, messaging, notifications, push subscriptions, invitations, audit logs, and other dependent tables.
2. **Classify dependencies:** distinguish disposable demo activity from records that should remain for audit, security, or operational continuity. Never assume deleting an Auth user safely deletes its application records.
3. **Backup and recovery:** create and verify a schema-and-data backup using an authorised method before cleanup. Confirm a restore path is available. A schema-only export is not a substitute for a data backup.
4. **Dry run:** produce an exact candidate list (counts and IDs, not passwords or tokens), expected affected-row counts, and a transaction plan. Review for shared accounts, admin privileges, real school ownership, and any user ID referenced by protected records.
5. **Controlled execution:** use an explicit allowlist of confirmed demo IDs, not broad role-based deletion. Prefer reversible deactivation/archival where appropriate. If hard deletion is approved, handle dependent rows in a documented order and preserve required audit/security history.
6. **Verification:** confirm admin login, RLS, student-parent relationship integrity, class/teacher assignments, attendance and notification flows, messaging, and application health after the approved operation. Record before/after counts and the recovery reference.

## Protected from this clean-up by default

- School-owner and administrator accounts, including privileged JETAB/Nexus ownership.
- Student accounts and student academic records.
- Classes, subjects, terms, examinations, CBT attempts, published results, fees, payments, receipts, and admissions records.
- School settings, storage files, Edge Functions, RLS policies, database migrations, and audit/security evidence.
- Any account or record not explicitly identified in the approved demo teacher/parent allowlist.

## Release gate

No production deletion, bulk update, Auth-user removal, cascade operation, migration, or reset is authorised by this plan. Before execution, the owner must review the exact candidate list, backup verification, dependency report, and proposed SQL/actions and explicitly approve that specific clean-up. Until then, demo teacher and parent accounts remain in place and must be labelled/treated as test accounts in all testing and handover materials.

## Current known limitation

The repository's migration history does not yet reproduce the full live database from an empty baseline. Resolve the separately documented schema-baseline/history issue before relying on a full local database replay as the recovery test. Do not use production reset/push/repair commands as a shortcut.
