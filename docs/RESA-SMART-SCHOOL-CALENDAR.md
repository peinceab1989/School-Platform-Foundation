# RESA Smart School Calendar & Operating Schedule

## Purpose
Make the school calendar the authoritative source for whether normal school operations are scheduled, while keeping the public website and authorised administration available at all times.

## School time zone
Use the IANA time zone `Africa/Lagos` for all school-day calculations, date boundaries, opening hours, holidays, events, reminders, and attendance windows. Store timestamps consistently (UTC where appropriate) and convert for display and policy evaluation.

## Operating policy
- The administrator configures the normal instructional days of the week and normal opening/closing times. Do not hard-code Monday-Friday as an assumption.
- A date is a normal school day only when its weekday is enabled and no higher-priority closure applies.
- Weekends and other disabled weekdays are closed by default.
- An administrator may create a dated special-opening event on an otherwise closed day. The event must include a title, date, start/end time, intended audience or activity scope, and creator/audit metadata.
- An administrator may create full-day or time-bounded closures for public holidays, term breaks, mid-term breaks, emergencies, maintenance, or other reasons. Closures take precedence over normal weekly opening.
- A special opening may override the normal weekly closed-day rule, but must not silently override an explicit closure. If an exception is needed, require a distinct, explicit administrator override and record it in the audit log.
- When a closure and special event overlap, show the conflict to the administrator and require an explicit resolution rather than guessing.

## Priority order
1. Authorised emergency/explicit administrative override.
2. Explicit dated closure.
3. Approved dated special opening/activity.
4. Configured weekly timetable.
5. Closed by default when no rule opens the date.

An override must be scoped (whole school or named services/audience), time-bounded where possible, attributable to an administrator, and auditable.

## Behaviour by service
- Attendance: prevent ordinary student check-in/out sessions on closed dates; permit attendance for approved special events only when the event explicitly enables it. Never delete or rewrite historical attendance.
- Timetable and lessons: do not generate or present ordinary lessons as scheduled during closures; retain special-event schedules.
- Examinations and assignments: do not automatically cancel or delete published work. Show the calendar conflict and let authorised staff reschedule or explicitly retain it.
- Notifications: send closure, reopening, and special-opening notices to the affected audience; avoid duplicate or contradictory alerts.
- Parent/student/teacher views: clearly show OPEN, CLOSED, or SPECIAL ACTIVITY, the reason, applicable hours, and next scheduled opening where known.
- Public website: remains accessible during every closure for information, notices, maps, and contact details.
- Administration and emergency communication: remain accessible to authorised administrators during closures. Do not lock out administrators or disable emergency announcements.
- Other modules: only suspend date-dependent school operations that are explicitly integrated with this policy. Do not globally disable authentication, records access, messaging, or unrelated portal functionality.

## Administrator controls
Provide a dedicated School Calendar & Operating Hours area to:
- Configure weekly operating days and hours.
- Add/edit/cancel holidays and closures.
- Create special openings and activity-specific schedules.
- Preview the effective status for a selected date and explain which rule produced it.
- Resolve overlapping rules with an explicit override.
- View an audit trail of who changed what and when.
- Publish notices to the affected users.

All controls must be protected by existing administrator permissions and server-side authorisation. Do not trust client-only role checks.

## Technical and safety requirements
- Implement one shared, tested operating-status policy used by attendance, timetables, event scheduling, and relevant notifications; avoid separate inconsistent weekday logic in each page.
- Enforce critical attendance restrictions server-side (database/RPC/Edge Function as appropriate), not only by hiding buttons in the UI.
- Apply row-level security and least-privilege access to calendar settings and events. Preserve existing auth, RLS, permissions, and data.
- Do not assume a particular weekly schedule until the school administrator configures it.
- Do not infer Nigerian public holidays from a static hard-coded list; allow authorised calendar entries and a maintained holiday source with review before activation.
- Handle daylight-saving/time-zone conversion through `Africa/Lagos` rather than device-local time.
- Include tests for every weekday, disabled days, holidays, term breaks, special openings, partial-day closures, conflicting events, administrator overrides, time-zone boundaries, and unauthorised users.
- Keep all schema changes additive and provide safe migrations with rollback notes. Never reset existing school data.

## Acceptance criteria
1. Admin can configure normal school days and hours without code changes.
2. Disabled weekdays are closed by default.
3. Approved special activities can open a selected closed date for the specified scope and hours.
4. Closures supersede normal weekly operation and are reflected consistently across relevant modules.
5. Explicit overrides require confirmation, reason, scope, expiry/end time where applicable, and audit logging.
6. Attendance cannot be recorded as ordinary school attendance on a closed day through either UI or direct API calls.
7. Public information and authorised admin/emergency functions remain available while school operations are closed.
8. Students, parents, and staff see the correct effective status and relevant notices.
9. Existing attendance, student records, exams, fees, authentication, and permissions remain intact.
10. Automated tests and production build pass before the change is eligible for release.

## Delivery safeguards
Implement on the existing RESA feature branch first. Keep the pull request in draft until code review, migration review, automated tests, and role-based functional tests pass. Do not merge to `main`, alter production data, or deploy to the live portal without explicit approval.
