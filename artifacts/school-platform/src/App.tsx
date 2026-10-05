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
import NotFound from '@/pages/not-found';
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

function FoundationPage() {
  const [location, setLocation] = useLocation();
  const [session, setSession] = useState<Session | null>(null);
  const [authState, setAuthState] = useState<FoundationAuthState>(
    hasSupabaseConfig ? 'loading' : 'needs-config',
  );
  const [memberships, setMemberships] = useState<FoundationMembership[]>([]);
  const [membershipsLoading, setMembershipsLoading] = useState(false);
  const [accessCheckState, setAccessCheckState] =
    useState<FoundationAccessCheckState>('idle');
  const [errorText, setErrorText] = useState<string | null>(null);
  const [statusText, setStatusText] = useState<string | null>(null);

  useEffect(() => {
    if (!hasSupabaseConfig) {
      setAuthState('needs-config');
      return;
    }

    let active = true;
    const client = getSupabaseClient();
    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((_event, nextSession) => {
      if (!active) return;
      setSession(nextSession);
      setAuthState(nextSession ? 'signed-in' : 'signed-out');
      setErrorText(null);
      setStatusText(null);
      setAccessCheckState('idle');
      if (!nextSession) setMemberships([]);
    });

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
        setAuthState(data.session ? 'signed-in' : 'signed-out');
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

  useEffect(() => {
    if (authState === 'signed-in' && location !== '/dashboard') {
      setLocation('/dashboard');
    } else if (
      (authState === 'signed-out' || authState === 'needs-config') &&
      location !== '/'
    ) {
      setLocation('/');
    }
  }, [authState, location, setLocation]);

  useEffect(() => {
    if (!session || authState !== 'signed-in') {
      setMemberships([]);
      setMembershipsLoading(false);
      return;
    }

    let active = true;
    setMembershipsLoading(true);
    setErrorText(null);
    void runMembershipAccessCheck(getSupabaseClient(), session.user.id)
      .then(({ memberships: nextMemberships, result }) => {
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
            nextMemberships.length === 1 ? 'membership is' : 'memberships are'
          } visible to this account. Run the access check to test the role helper.`,
        );
      })
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
        if (active) setMembershipsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [authState, session]);

  const signIn = useCallback(async (email: string, password: string) => {
    if (!hasSupabaseConfig) {
      setAuthState('needs-config');
      return;
    }

    setAuthState('loading');
    setErrorText(null);
    setStatusText(null);
    try {
      const { error } = await getSupabaseClient().auth.signInWithPassword({
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
  }, []);

  const signOut = useCallback(async () => {
    if (!hasSupabaseConfig) return;
    setErrorText(null);
    try {
      const { error } = await getSupabaseClient().auth.signOut();
      if (error) setErrorText(error.message);
    } catch (error) {
      setErrorText(
        error instanceof Error ? error.message : 'Could not sign out safely.',
      );
    }
  }, []);

  const runAccessCheck = useCallback(async () => {
    if (!session) {
      setAccessCheckState('error');
      setErrorText('Sign in again before checking account access.');
      return;
    }

    setAccessCheckState('loading');
    setErrorText(null);
    setStatusText(null);

    try {
      const client = getSupabaseClient();
      const { memberships: checkedMemberships, result } =
        await runMembershipAccessCheck(client, session.user.id);

      if (!result.passed) {
        setMemberships([]);
        setAccessCheckState('error');
        setErrorText(result.message);
        return;
      }

      const unknownSchoolDenied = await confirmUnknownSchoolIsDenied(client);
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
  }, [session]);

  return (
    <FoundationAppView
      authState={authState}
      signedInEmail={session?.user.email}
      memberships={memberships}
      errorText={errorText}
      statusText={statusText}
      membershipsLoading={membershipsLoading}
      accessCheckState={accessCheckState}
      onSignIn={(email, password) => void signIn(email, password)}
      onSignOut={() => void signOut()}
      onRunAccessCheck={() => void runAccessCheck()}
    />
  );
}

function Router() {
  return (
    <RoutedErrorBoundary>
      <Switch>
        <Route path="/" component={FoundationPage} />
        <Route path="/dashboard" component={FoundationPage} />
        <Route component={NotFound} />
      </Switch>
    </RoutedErrorBoundary>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
        <Router />
      </WouterRouter>
    </QueryClientProvider>
  );
}

export default App;
