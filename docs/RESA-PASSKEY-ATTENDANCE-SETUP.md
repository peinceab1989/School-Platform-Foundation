# RESA Passkeys and Unified Attendance

## Security model

RESA uses Supabase Auth's native WebAuthn passkey implementation. The phone, browser or password manager keeps the private credential and performs local user verification. Depending on the device, the prompt may use a fingerprint, face recognition, device PIN or another supported screen-lock method.

RESA does not collect or store fingerprint images, face images or biometric templates. Supabase Auth stores the WebAuthn credential material required to verify passkeys.

Passkey support in the Supabase JavaScript SDK is currently marked experimental. The application explicitly opts in and keeps password sign-in available as a recovery path.

## Required Supabase project setting

The hosted Supabase Auth setting is managed in the Supabase Dashboard; it is not activated merely by committing application code.
The same relying-party values are also declared in the repository's `supabase/config.toml` for a controlled Supabase CLI configuration push. A normal Cloudflare Pages build does not apply Supabase Auth configuration.

1. Open the RESA Supabase project.
2. Go to **Authentication → Passkeys**.
3. Turn on **Enable Passkey authentication**.
4. Set **Relying Party Display Name** to `RESA School Portal`.
5. Set **Relying Party ID** to `school-platform-foundation.pages.dev`.
6. Set **Relying Party Origins** to `https://school-platform-foundation.pages.dev`.
7. Save the settings.

The relying-party ID must be the bare domain (no scheme, port or path). The origin must include `https://` and must match the domain serving the portal. Do not change the RP ID after users have enrolled passkeys unless there is a planned credential migration; passkeys are cryptographically bound to the RP ID.

If RESA later adopts another production hostname, add that exact HTTPS origin to the allowed origins. Keep the current RP ID unless a coordinated migration is planned.

## User setup

1. Sign in once using the existing RESA password.
2. Open **Passkeys & Identity Attendance** from the dashboard.
3. Choose a clear device name and register a passkey.
4. Complete the device prompt with fingerprint, face recognition or secure device PIN.
5. Sign out and test **Sign in with fingerprint / passkey** from the RESA login page.
6. Keep the password and a second recovery method available until the passkey has been tested successfully.

## Attendance behaviour

Every attendance action starts a fresh passkey sign-in. The database function accepts the action only when the signed-in Supabase JWT contains a recent `amr.method = passkey` authentication record, and each verified passkey assertion can be used for only one attendance action. A normal portal login does not automatically create an attendance event.

The role mapping is:

- Students: school arrival and departure. A current active class enrolment is required; successful events also update the existing student attendance register and send in-app attendance alerts to linked active parent accounts.
- Teachers: work arrival and departure, linked to the existing staff attendance register.
- Non-teaching staff: work arrival and departure, linked to the existing staff attendance register.
- Parents / guardians: school-visit check-in and visit exit.
- Administrators: optional work arrival and departure.
- Proprietor: optional work arrival and departure.

The database validates the user-to-school relationship, person record, role category, action pairing, current date, duplicate action and check-out prerequisites. Student passkey events flow through the existing biometric attendance processor so the established student register and parent alert triggers continue to work. Attendance events are retained in the unified RESA identity-attendance register; each user can read their own records, while authorised administrators and proprietors can review school-wide records under RLS.

The system-managed `RESA Passkey (WebAuthn)` logical device is created for each school so student passkey events can pass through the existing biometric attendance processor. It is not a physical reader and should not be deactivated or deleted while passkey student attendance is in use.

## Shared school devices

A learner or staff member without a personal smartphone should use the school's existing biometric reader or a supervised attendance station with an individual student/staff ID or QR. A shared tablet's single device screen lock cannot distinguish different people. Use a passkey on a shared device only when each person has an isolated operating-system profile and authenticator. Never share one account or one person's passkey with another person.

## Physical-presence limitation

A passkey verifies the account holder's identity. It does not, by itself, prove GPS location or physical presence at the school. Where physical presence must be enforced, pair the passkey step with an approved on-site attendance terminal, rotating station code or supervised school procedure. RESA does not silently collect location data as part of this feature.

## Release acceptance checks

- Enable the Supabase Dashboard setting above before testing.
- Test passkey registration, rename, revocation, sign-out and passkey sign-in on supported Android Chrome.
- Test a password-only account and confirm password recovery remains available.
- Test one student, one teacher, one non-teaching staff member, one parent, one administrator and the proprietor identity where each account is configured.
- Confirm students without a current class enrolment cannot write a student attendance record.
- Confirm a check-out cannot be recorded without the matching same-day check-in.
- Confirm duplicate daily actions are rejected.
- Confirm parent attendance alerts arrive only for linked active parent accounts.
- Confirm users cannot read another person's attendance events and that unauthorised users cannot execute attendance writes.
