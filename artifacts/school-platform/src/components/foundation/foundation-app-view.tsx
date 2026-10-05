import { useState, type FormEvent } from 'react';
import {
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  ClipboardCheck,
  GraduationCap,
  KeyRound,
  LockKeyhole,
  LogOut,
  RefreshCw,
  School,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
} from 'lucide-react';

export type FoundationRole = 'admin' | 'teacher' | 'student' | 'parent';
export type FoundationMembershipStatus = 'active' | 'invited' | 'suspended';
export type FoundationMembership = {
  id: string;
  schoolId: string;
  schoolName: string;
  role: FoundationRole;
  status: FoundationMembershipStatus;
};
export type FoundationAuthState =
  | 'needs-config'
  | 'loading'
  | 'signed-out'
  | 'signed-in';
export type FoundationAccessCheckState =
  | 'idle'
  | 'loading'
  | 'success'
  | 'error';

export type FoundationAppViewProps = {
  authState: FoundationAuthState;
  signedInEmail?: string | null;
  memberships: FoundationMembership[];
  errorText?: string | null;
  statusText?: string | null;
  membershipsLoading?: boolean;
  accessCheckState?: FoundationAccessCheckState;
  onSignIn: (email: string, password: string) => void;
  onSignOut: () => void;
  onRunAccessCheck: () => void;
};

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className="foundation-brand" aria-label="Fieldnote school platform">
      <span className="foundation-mark" aria-hidden="true">
        <GraduationCap size={22} strokeWidth={1.8} />
      </span>
      <span>
        <span className="foundation-brand-name">Fieldnote</span>
        <span className="foundation-brand-caption">
          {compact ? 'School platform' : 'A steadier school day'}
        </span>
      </span>
    </div>
  );
}

function SignInView({
  authState,
  errorText,
  statusText,
  onSignIn,
}: Pick<
  FoundationAppViewProps,
  'authState' | 'errorText' | 'statusText' | 'onSignIn'
>) {
  const needsConfig = authState === 'needs-config';
  const isLoading = authState === 'loading';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSignIn(email, password);
  }

  return (
    <main className="foundation-auth-layout">
      <aside className="foundation-auth-aside">
        <Brand />
        <div className="foundation-auth-story">
          <div className="foundation-eyebrow">
            <span className="foundation-eyebrow-mark" />
            Your school, in good hands
          </div>
          <h1>A thoughtful start to the school day.</h1>
          <p>
            One dependable place for the people who make learning happen.
            Sign in to see the school spaces connected to your account.
          </p>
          <div className="foundation-auth-feature">
            <ShieldCheck size={17} aria-hidden="true" />
            School access is checked against your account
          </div>
        </div>
        <div className="foundation-auth-aside-foot">
          A considered foundation for school communities
        </div>
      </aside>

      <section className="foundation-auth-main" aria-labelledby="signin-title">
        <div className="foundation-auth-card">
          <div className="foundation-auth-mobile-brand">
            <Brand compact />
          </div>
          <div className="foundation-eyebrow">
            <span className="foundation-eyebrow-mark" />
            {needsConfig ? 'A quick setup step' : 'Welcome back'}
          </div>
          <h2 id="signin-title">
            {needsConfig ? 'Connect your sign-in' : 'Sign in to continue'}
          </h2>
          <p className="foundation-auth-subtitle">
            {needsConfig
              ? 'This workspace needs its secure sign-in connection before anyone can enter.'
              : 'Use your school account to check your memberships and access.'}
          </p>

          {needsConfig ? (
            <div className="foundation-config-card" role="status" data-testid="status-setup-required">
              <strong>
                <KeyRound size={15} aria-hidden="true" />
                Sign-in is not configured yet
              </strong>
              <p>
                Add the project’s Supabase URL and public key to the app
                environment, then refresh this page. No account details are
                needed here.
              </p>
              <span className="foundation-config-code">
                VITE_SUPABASE_URL · VITE_SUPABASE_ANON_KEY
              </span>
            </div>
          ) : (
            <>
              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <div className="foundation-signin-note">
                  <LockKeyhole size={17} aria-hidden="true" />
                  <div>
                    <strong>School sign-in</strong>
                    <p>
                      Sign in with the account provided for your school. Your
                      access is never assumed.
                    </p>
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="foundation-email"
                    className="text-[11px] font-semibold text-[#43594e]"
                  >
                    Email address
                  </label>
                  <input
                    id="foundation-email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="you@school.org"
                    className="w-full rounded-lg border border-[#e8e5da] bg-[#fffefa] px-3 py-3 text-[13px] text-[#30473d] placeholder:text-[#9ba39b] focus:border-[#789888] focus:outline-none focus:ring-2 focus:ring-[#789888]/20"
                    data-testid="input-sign-in-email"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="foundation-password"
                    className="text-[11px] font-semibold text-[#43594e]"
                  >
                    Password
                  </label>
                  <input
                    id="foundation-password"
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Enter your password"
                    className="w-full rounded-lg border border-[#e8e5da] bg-[#fffefa] px-3 py-3 text-[13px] text-[#30473d] placeholder:text-[#9ba39b] focus:border-[#789888] focus:outline-none focus:ring-2 focus:ring-[#789888]/20"
                    data-testid="input-sign-in-password"
                  />
                </div>
                <button
                  type="submit"
                  className="foundation-primary-button w-full"
                  disabled={isLoading}
                  data-testid="button-sign-in"
                >
                  {isLoading ? (
                    <>
                      <RefreshCw size={15} className="animate-spin" aria-hidden="true" />
                      Checking sign-in…
                    </>
                  ) : (
                    <>
                      Continue to sign in
                      <ArrowRight size={15} aria-hidden="true" />
                    </>
                  )}
                </button>
              </form>
              {statusText && (
                <p className="foundation-auth-status" role="status" data-testid="status-auth">
                  {statusText}
                </p>
              )}
            </>
          )}
          {errorText && (
            <div className="foundation-alert" role="alert" data-testid="status-auth-error">
              <TriangleAlert size={16} aria-hidden="true" />
              <span>{errorText}</span>
            </div>
          )}
          <p className="foundation-auth-status">
            Need access? Contact your school administrator to confirm your
            account has been invited.
          </p>
        </div>
      </section>
    </main>
  );
}

function MembershipCard({ membership }: { membership: FoundationMembership }) {
  return (
    <article
      className="foundation-membership"
      data-testid={`card-membership-${membership.id}`}
    >
      <span className="foundation-school-icon" aria-hidden="true">
        <School size={19} strokeWidth={1.7} />
      </span>
      <div className="foundation-membership-info">
        <div className="foundation-membership-name">{membership.schoolName}</div>
        <div className="foundation-membership-meta">
          <span>{membership.role}</span>
          <span className="foundation-role-separator" aria-hidden="true" />
          <span>School membership</span>
        </div>
      </div>
      <span className={`foundation-badge ${membership.status}`}>
        {membership.status}
      </span>
    </article>
  );
}

function DashboardView({
  signedInEmail,
  memberships,
  errorText,
  statusText,
  membershipsLoading = false,
  accessCheckState = 'idle',
  onSignOut,
  onRunAccessCheck,
}: Omit<FoundationAppViewProps, 'authState' | 'onSignIn'>) {
  const initials = signedInEmail
    ? signedInEmail.slice(0, 1).toLocaleUpperCase()
    : 'U';
  const checkResultText =
    statusText ??
    (accessCheckState === 'success'
      ? 'Your account can read its school memberships. The access check completed successfully.'
      : accessCheckState === 'error'
        ? errorText ?? 'The access check could not be completed. Please try again.'
        : '');

  return (
    <div className="foundation-shell">
      <div className="foundation-frame">
        <aside className="foundation-rail">
          <Brand />
          <nav className="foundation-nav" aria-label="Main navigation">
            <div className="foundation-nav-label">Your workspace</div>
            <div className="foundation-nav-item" aria-current="page">
              <ClipboardCheck size={17} aria-hidden="true" />
              <span>Access overview</span>
            </div>
          </nav>
          <div className="foundation-rail-note">
            <strong>Built around your school</strong>
            <p>
              Your role and school connections determine what you can see here.
            </p>
          </div>
        </aside>

        <main className="foundation-main">
          <header className="foundation-topbar">
            <div className="foundation-breadcrumb" aria-label="Breadcrumb">
              <span>Workspace</span>
              <ChevronRight size={13} aria-hidden="true" />
              <strong>Access overview</strong>
            </div>
            <div className="foundation-top-actions">
              <span className="foundation-secure">
                <LockKeyhole size={13} aria-hidden="true" />
                Secure session
              </span>
              <div className="foundation-user-chip">
                <span className="foundation-avatar" aria-hidden="true">{initials}</span>
                {signedInEmail && (
                  <span className="foundation-email" data-testid="text-signed-in-email">
                    {signedInEmail}
                  </span>
                )}
              </div>
              <button
                type="button"
                className="foundation-signout"
                onClick={onSignOut}
                data-testid="button-sign-out"
                aria-label="Sign out"
              >
                <LogOut size={15} aria-hidden="true" />
                <span className="hidden sm:inline">Sign out</span>
              </button>
            </div>
          </header>

          <div className="foundation-content">
            <div className="foundation-eyebrow">
              <span className="foundation-eyebrow-mark" />
              Foundation · Phase 1
            </div>
            <h1 className="foundation-heading">Your school access, at a glance.</h1>
            <p className="foundation-lede">
              Confirm the schools connected to your account and make sure
              membership access is working as expected.
            </p>

            {errorText && accessCheckState !== 'error' && (
              <div className="foundation-alert" role="alert" data-testid="status-dashboard-error">
                <TriangleAlert size={16} aria-hidden="true" />
                <span>{errorText}</span>
              </div>
            )}

            <div className="foundation-content-grid">
              <section className="foundation-panel" aria-labelledby="memberships-title">
                <div className="foundation-panel-header">
                  <div>
                    <h2 className="foundation-panel-title" id="memberships-title">
                      School memberships
                    </h2>
                    <p className="foundation-panel-description">
                      Schools and roles associated with this account.
                    </p>
                  </div>
                  <span className="foundation-panel-tag">
                    <span className={`foundation-status-dot ${memberships.length ? 'success' : ''}`} />
                    {membershipsLoading ? 'Loading' : `${memberships.length} ${memberships.length === 1 ? 'membership' : 'memberships'}`}
                  </span>
                </div>
                <div className="foundation-panel-body">
                  {membershipsLoading ? (
                    <div className="foundation-membership-list" aria-label="Loading memberships" aria-busy="true" data-testid="loading-memberships">
                      <div className="foundation-skeleton" />
                      <div className="foundation-skeleton" />
                    </div>
                  ) : memberships.length > 0 ? (
                    <div className="foundation-membership-list" data-testid="list-memberships">
                      {memberships.map((membership) => (
                        <MembershipCard key={membership.id} membership={membership} />
                      ))}
                    </div>
                  ) : (
                    <div className="foundation-empty" data-testid="empty-memberships">
                      <span className="foundation-empty-icon" aria-hidden="true">
                        <School size={22} strokeWidth={1.6} />
                      </span>
                      <h3>No school memberships yet</h3>
                      <p>
                        When a school connects your account, its membership and
                        role will appear here.
                      </p>
                    </div>
                  )}
                </div>
              </section>

              <section className="foundation-panel" aria-labelledby="access-check-title">
                <div className="foundation-panel-header">
                  <div>
                    <h2 className="foundation-panel-title" id="access-check-title">
                      Access check
                    </h2>
                    <p className="foundation-panel-description">
                      Confirm that your account can read its own membership details.
                    </p>
                  </div>
                  <span className="foundation-panel-tag">
                    <span
                      className={`foundation-status-dot ${
                        accessCheckState === 'success'
                          ? 'success'
                          : accessCheckState === 'error'
                            ? 'error'
                            : ''
                      }`}
                    />
                    {accessCheckState === 'success'
                      ? 'Verified'
                      : accessCheckState === 'error'
                        ? 'Needs attention'
                        : accessCheckState === 'loading'
                          ? 'Checking'
                          : 'Not checked'}
                  </span>
                </div>
                <div className="foundation-panel-body foundation-access">
                  <div className="foundation-access-intro">
                    <span className="foundation-access-icon" aria-hidden="true">
                      <ShieldCheck size={20} strokeWidth={1.7} />
                    </span>
                    <div className="foundation-access-copy">
                      <strong>Private by design</strong>
                      <p>
                        Memberships are scoped to your signed-in account. Run a
                        check to confirm the connection.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="foundation-check-button"
                    onClick={onRunAccessCheck}
                    disabled={accessCheckState === 'loading'}
                    data-testid="button-run-access-check"
                  >
                    {accessCheckState === 'loading' ? (
                      <>
                        <RefreshCw size={15} className="animate-spin" aria-hidden="true" />
                        Checking access…
                      </>
                    ) : accessCheckState === 'success' ? (
                      <>
                        <Check size={16} aria-hidden="true" />
                        Run check again
                      </>
                    ) : (
                      <>
                        <ClipboardCheck size={16} aria-hidden="true" />
                        Check my access
                      </>
                    )}
                  </button>

                  {accessCheckState === 'success' && (
                    <div className="foundation-check-result" role="status" data-testid="status-access-check-success">
                      <CheckCircle2 size={16} aria-hidden="true" />
                      <span>{checkResultText || 'Access confirmed.'}</span>
                    </div>
                  )}
                  {accessCheckState === 'error' && (
                    <div className="foundation-check-result error" role="alert" data-testid="status-access-check-error">
                      <CircleAlert size={16} aria-hidden="true" />
                      <span>{checkResultText}</span>
                    </div>
                  )}
                  {accessCheckState === 'loading' && (
                    <div className="foundation-check-result loading" role="status" data-testid="status-access-check-loading">
                      <RefreshCw size={15} aria-hidden="true" />
                      <span>Checking your account’s membership access…</span>
                    </div>
                  )}
                  {accessCheckState === 'idle' && statusText && (
                    <div className="foundation-check-result" role="status" data-testid="status-access-check">
                      <Sparkles size={15} aria-hidden="true" />
                      <span>{statusText}</span>
                    </div>
                  )}
                  <div className="foundation-rule" />
                  <div className="foundation-security-row">
                    <LockKeyhole size={14} aria-hidden="true" />
                    <span>Your access check uses your active sign-in and school permissions.</span>
                  </div>
                </div>
              </section>
            </div>

            <footer className="foundation-footer">
              <span>Fieldnote · School workspace</span>
              <span>Only your account’s access is shown</span>
            </footer>
          </div>
        </main>
      </div>
    </div>
  );
}

export function FoundationAppView(props: FoundationAppViewProps) {
  if (props.authState !== 'signed-in') {
    return (
      <SignInView
        authState={props.authState}
        errorText={props.errorText}
        statusText={props.statusText}
        onSignIn={props.onSignIn}
      />
    );
  }

  return (
    <DashboardView
      signedInEmail={props.signedInEmail}
      memberships={props.memberships}
      errorText={props.errorText}
      statusText={props.statusText}
      membershipsLoading={props.membershipsLoading}
      accessCheckState={props.accessCheckState}
      onSignOut={props.onSignOut}
      onRunAccessCheck={props.onRunAccessCheck}
    />
  );
}

export default FoundationAppView;
