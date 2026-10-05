# School Management Platform — Phase 1

This first phase provides the application shell, Supabase sign-in, school-role
membership checks, and a small permission-check path. It does not create student,
staff, attendance, results, or exam records yet.

## Connect a Supabase project

1. Create a Supabase project for the school.
2. In its SQL Editor, run `supabase/migrations/20261005000000_foundation_access.sql`.
3. Create the first administrator account in Supabase Auth.
4. Copy the new user's Auth UUID and run the two statements described in
   `supabase/bootstrap/first-admin.sql.example` to create the school and assign
   the administrator role.
5. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in the app's environment.
   The anon/publishable key is intended for browser use; Row Level Security is
   the protection boundary. Never use a `service_role` key in the app.
6. Restart the app after changing environment values, then sign in with the
   administrator account.

The app intentionally has no public sign-up form. The first administrator is
created in Supabase, and future accounts should be invited by an administrator.
This prevents people from granting themselves school roles.

## What the access check verifies

The signed-in dashboard requests memberships without filtering by user ID and
relies on Supabase Row Level Security to restrict the result. It fails if any
returned membership belongs to a different user. It also checks that an
unrecognized school UUID does not pass the `has_school_role` function.

The check is a smoke test, not a replacement for a full security review. Keep
RLS enabled on every school data table as future phases add them.

## Local checks

- `pnpm --filter @workspace/school-platform run typecheck`
- `pnpm --filter @workspace/school-platform run build`

## Netlify

The Vite app is a static build and includes an SPA rewrite at `public/_redirects`.
Set the two `VITE_SUPABASE_*` values in the Netlify site's environment as well as
in Replit. Only publishable Supabase values belong in those client-side variables.
