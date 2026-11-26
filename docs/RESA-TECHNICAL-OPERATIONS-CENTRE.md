# RESA Technical Operations Centre

## Purpose
The Technical Operations Centre is the administrator workspace for handling technical incidents, portal faults, maintenance work, equipment inventory and response accountability.

## Incident response targets
First-response targets are measured from ticket creation until the first non-internal support reply:
- Urgent: 15 minutes
- High: 60 minutes
- Normal: 8 hours
- Low: 24 hours

A scheduled database task checks every five minutes for active tickets that have missed the first-response target. It marks the ticket as escalated and writes a durable event. The job does not change ticket priority, close tickets or delete reports.

## Maintenance
Administrators can schedule preventive maintenance, inspections, repairs, upgrades and safety checks. Each work order may be linked to a registered asset, assigned to an active school administrator or teacher, and completed with a service note.

## Asset register
Asset tags are unique within a school. The register records asset category, location, operational condition and warranty expiry. Condition changes are retained in the operations event history.

## Access and privacy
- The operations console is administrator-only.
- Technical officers can be assigned to maintenance work orders and can view the work assigned to them.
- Asset records and operational events are school-scoped.
- Existing support-ticket reporter visibility and school-scoped administrator controls remain in place.
- The feature is additive; it does not reset, delete or overwrite existing school data.

## Acceptance checklist
1. Sign in as a school administrator and open **Administration → Technical Operations**.
2. Confirm incident counts and first-response targets load.
3. Assign an active administrator or teacher to a support ticket.
4. Create a maintenance schedule and link an asset.
5. Register an asset and change its condition.
6. Confirm events appear in Activity History.
7. Sign in as a teacher assigned to a work order and confirm only assigned work is visible.
8. Confirm a student or parent cannot open the administrator console.
9. Confirm SLA escalation after a ticket has exceeded its target without a support reply.
10. Repeat the checks on a phone-sized viewport.

Real account-based acceptance is still required after production rollout.
