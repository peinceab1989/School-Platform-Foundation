import { type ReactNode, useCallback, useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Session } from '@supabase/supabase-js';
import { ErrorBoundary } from '@/components/error-boundary';

import {
  FoundationAppView,
  type FoundationAccessCheckState,
  type FoundationAuthState,
  type FoundationMembership,
} from '@/components/foundation/foundation-app-view';

import AdminDashboard from '@/pages/admin-dashboard';
import StudentsPage from '@/pages/students';
import Home from '@/pages/home';
import NotFound from '@/pages/not-found';
import {
  ActivitiesGalleryPage,
  AdmissionsPage,
  ContactPage,
  InnovationTechnologyPage,
  PracticalSkillsPage,
  WisdomInspirationPage,
} from '@/pages/public-pages';

import {
  Route,
  Switch,
  useLocation,
  Router as WouterRouter,
} from 'wouter';

import {
  confirmUnknownSchoolIsDenied,
  runMembershipAccessCheck,
} from '@/features/access/access-check';

import {
  getSupabaseClient,
  hasSupabaseConfig,
} from '@/lib/supabase/client';

const queryClient = new QueryClient();

/*
 * PUBLIC WEBSITE
 *
 * This page is available to everyone.
 * It does not require Supabase login.
 */
function PublicHome() {
  return <Home />;
}

/*
 * PROTECTED SCHOOL PORTAL
 *
 * This contains the existing Supabase authentication,
 * membership checking and administrator access control.
 */
function FoundationPage() {
  const [location, setLocation] = useLocation();
  const [session, setSession] = useState<Session | null>(null);

  const [authState, setAuthState] = useState<FoundationAuthState>(
    hasSupabaseConfig ? 'loading' : 'needs-config',
  );

  const [memberships, setMemberships] = useState<
    FoundationMembership[]
  >([]);

  const [membershipsLoading, setMembershipsLoading] =
    useState(false);

  const [accessCheckState, setAccessCheckState] =
    useState<FoundationAccessCheckState>('idle');

  const [errorText, setErrorText] =
    useState<string | null>(null);

  const [statusText, setStatusText] =
    useState<string | null>(null);

  /*
   * Restore the Supabase session and listen for
   * future sign-in/sign-out changes.
   */
  useEffect(() => {
    if (!hasSupabaseConfig) {
      setAuthState('needs-config');
      return;
    }

    let active = true;

    const client = getSupabaseClient();

    const {
      data: { subscription },
    } = client.auth.onAuthStateChange(
      (_event, nextSession) => {
        if (!active) return;

        setSession(nextSession);

        setAuthState(
          nextSession ? 'signed-in' : 'signed-out',
        );

        setErrorText(null);
        setStatusText(null);
        setAccessCheckState('idle');

        if (!nextSession) {
          setMemberships([]);
        }
      },
    );

    void client.auth
      .getSession()
      .then(({ data, error }) => {
        if (!active) return;

        if (error) {
          setErrorText(error.message);
          setSession(null);
          setAuthState('signed-out');
          return;
        }

        setSession(data.session);

        setAuthState(
          data.session ? 'signed-in' : 'signed-out',
        );
      })
      .catch((error: unknown) => {
        if (!active) return;

        setErrorText(
          error instanceof Error
            ? error.message
            : 'Could not restore the saved sign-in session.',
        );

        setSession(null);
        setAuthState('signed-out');
      });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  /*
   * Protect the management portal.
   *
   * If someone is not signed in and tries to access
   * /dashboard or /students, send them back to
   * the public RESA website.
   */
  useEffect(() => {
    if (
      authState === 'signed-out' ||
      authState === 'needs-config'
    ) {
      if (location !== '/') {
        setLocation('/');
      }
    }
  }, [authState, location, setLocation]);

  /*
   * Load schools/memberships connected to the
   * currently signed-in account.
   */
  useEffect(() => {
    if (
      !session ||
      authState !== 'signed-in'
    ) {
      setMemberships([]);
      setMembershipsLoading(false);
      return;
    }

    let active = true;

    setMembershipsLoading(true);
    setErrorText(null);

    void runMembershipAccessCheck(
      getSupabaseClient(),
      session.user.id,
    )
      .then(
        ({
          memberships: nextMemberships,
          result,
        }) => {
          if (!active) return;

          if (!result.passed) {
            setMemberships([]);
            setAccessCheckState('error');
            setErrorText(result.message);
            return;
          }

          setMemberships(nextMemberships);

          setStatusText(
            `${nextMemberships.length} school ${
              nextMemberships.length === 1
                ? 'membership is'
                : 'memberships are'
            } visible to this account.`,
          );
        },
      )
      .catch((error: unknown) => {
        if (!active) return;

        setMemberships([]);

        setErrorText(
          error instanceof Error
            ? error.message
            : 'Could not load this account’s school memberships.',
        );
      })
      .finally(() => {
        if (active) {
          setMembershipsLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [authState, session]);

  /*
   * Sign in with Supabase.
   */
  const signIn = useCallback(
    async (
      email: string,
      password: string,
    ) => {
      if (!hasSupabaseConfig) {
        setAuthState('needs-config');
        return;
      }

      setAuthState('loading');
      setErrorText(null);
      setStatusText(null);

      try {
        const { error } =
          await getSupabaseClient().auth.signInWithPassword({
            email: email.trim(),
            password,
          });

        if (error) {
          setAuthState('signed-out');
          setErrorText(error.message);
        }
      } catch (error) {
        setAuthState('signed-out');

        setErrorText(
          error instanceof Error
            ? error.message
            : 'Could not reach the school sign-in service.',
        );
      }
    },
    [],
  );

  /*
   * Sign out.
   */
  const signOut = useCallback(
    async () => {
      if (!hasSupabaseConfig) return;

      setErrorText(null);

      try {
        const { error } =
          await getSupabaseClient().auth.signOut();

        if (error) {
          setErrorText(error.message);
        }
      } catch (error) {
        setErrorText(
          error instanceof Error
            ? error.message
            : 'Could not sign out safely.',
        );
      }
    },
    [],
  );

  /*
   * Full Phase 1 security/access verification.
   */
  const runAccessCheck = useCallback(
    async () => {
      if (!session) {
        setAccessCheckState('error');
        setErrorText(
          'Sign in again before checking account access.',
        );
        return;
      }

      setAccessCheckState('loading');
      setErrorText(null);
      setStatusText(null);

      try {
        const client = getSupabaseClient();

        const {
          memberships: checkedMemberships,
          result,
        } =
          await runMembershipAccessCheck(
            client,
            session.user.id,
          );

        if (!result.passed) {
          setMemberships([]);
          setAccessCheckState('error');
          setErrorText(result.message);
          return;
        }

        const unknownSchoolDenied =
          await confirmUnknownSchoolIsDenied(client);

        if (!unknownSchoolDenied) {
          setAccessCheckState('error');

          setErrorText(
            'The role helper did not deny access to an unrecognized school. Review the Phase 1 database policies before adding school records.',
          );

          return;
        }

        setMemberships(checkedMemberships);
        setAccessCheckState('success');

        setStatusText(
          `${result.message} The role helper also denied access to an unrecognized school.`,
        );
      } catch (error) {
        setAccessCheckState('error');

        setErrorText(
          error instanceof Error
            ? error.message
            : 'The account access check could not be completed.',
        );
      }
    },
    [session],
  );

  /*
   * Find an active administrator membership.
   */
  const adminMembership =
    memberships.find(
      (membership) =>
        membership.role === 'admin' &&
        membership.status === 'active',
    );

  /*
   * Only an authenticated administrator can
   * access the management pages.
   */
  if (
    authState === 'signed-in' &&
    adminMembership &&
    !membershipsLoading
  ) {
    if (location === '/students') {
      return <StudentsPage />;
    }

    return (
      <AdminDashboard
        schoolName={adminMembership.schoolName}
        email={session?.user.email}
        onSignOut={() => void signOut()}
      />
    );
  }

  /*
   * Anyone who has not passed administrator access
   * remains in the protected foundation interface.
   */
  return (
    <FoundationAppView
      authState={authState}
      signedInEmail={session?.user.email}
      memberships={memberships}
      errorText={errorText}
      statusText={statusText}
      membershipsLoading={membershipsLoading}
      accessCheckState={accessCheckState}
      onSignIn={(email, password) =>
        void signIn(email, password)
      }
      onSignOut={() => void signOut()}
      onRunAccessCheck={() =>
        void runAccessCheck()
      }
    />
  );
}

function Router() {
  return (
    <RoutedErrorBoundary>
      <Switch>

        {/* PUBLIC RESA WEBSITE */}
        <Route
          path="/"
          component={PublicHome}
        />

        {/* PUBLIC RESA INFORMATION PAGES */}
        <Route
          path="/innovation-technology"
          component={InnovationTechnologyPage}
        />
        <Route
          path="/practical-skills"
          component={PracticalSkillsPage}
        />
        <Route
          path="/wisdom-inspiration"
          component={WisdomInspirationPage}
        />
        <Route
          path="/activities-gallery"
          component={ActivitiesGalleryPage}
        />
        <Route
          path="/admissions"
          component={AdmissionsPage}
        />
        <Route
          path="/contact"
          component={ContactPage}
        />

        {/* PROTECTED SCHOOL MANAGEMENT PORTAL */}
        <Route
          path="/dashboard"
          component={FoundationPage}
        />

        {/* PROTECTED STUDENT MANAGEMENT */}
        <Route
          path="/students"
          component={FoundationPage}
        />

        {/* UNKNOWN PAGE */}
        <Route component={NotFound} />

      </Switch>
    </RoutedErrorBoundary>
  );
}

function RoutedErrorBoundary({
  children,
}: {
  children: ReactNode;
}) {
  const [location] = useLocation();

  return (
    <ErrorBoundary resetKey={location}>
      {children}
    </ErrorBoundary>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <WouterRouter
        base={import.meta.env.BASE_URL.replace(
          /\/$/,
          '',
        )}
      >
        <Router />
      </WouterRouter>
    </QueryClientProvider>
  );
}

export default App;