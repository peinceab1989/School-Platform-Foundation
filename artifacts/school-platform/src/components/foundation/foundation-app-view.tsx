import { useState, type FormEvent } from 'react';
import { Link } from 'wouter';
import {
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  ClipboardCheck,
  KeyRound,
  LockKeyhole,
  LogOut,
  RefreshCw,
  School,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
  ExternalLink,
  Globe,
} from 'lucide-react';
import { SchoolLogo } from '@/components/school-logo';
import { getSupabaseClient } from '@/lib/supabase/client';

export type FoundationRole = 'admin' | 'teacher' | 'student' | 'parent';

export type FoundationMembershipStatus =
  | 'active'
  | 'invited'
  | 'suspended';

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
    <Link
      href="/"
      className="foundation-brand"
      aria-label="Visit RESA International school website"
      title="Visit the school website"
    >
      <SchoolLogo
        alt="RESA school crest"
        className="foundation-resa-logo"
        testId="img-resa-logo"
      />

      <span className="foundation-brand-copy">
        <span className="foundation-brand-name">
          RESA INTERNATIONAL
        </span>

        <span className="foundation-brand-caption">
          {compact
            ? 'School Portal'
            : 'Passion • Skills • Excellent Spirit'}
        </span>
      </span>
    </Link>
  );
}

function WebsiteLink({ compact = false }: { compact?: boolean }) {
  return (
    <Link
      href="/"
      className={
        compact
          ? 'foundation-website-link foundation-website-link-compact'
          : 'foundation-website-link'
      }
      aria-label="Visit the RESA public school website"
    >
      <Globe size={16} aria-hidden="true" />
      <span>Visit School Website</span>
      <ExternalLink size={13} aria-hidden="true" />
    </Link>
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
  const [resetBusy, setResetBusy] = useState(false);
  const [resetMessage, setResetMessage] = useState('');

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSignIn(email, password);
  }

  async function handlePasswordReset() {
    setResetMessage('');
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      setResetMessage('Enter your registered email address above, then tap Forgot password. Username accounts must ask the school administrator to reset their password.');
      return;
    }
    setResetBusy(true);
    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      setResetMessage('If this email is registered, a password-reset link has been sent. Check your inbox and spam folder.');
    } catch (error) {
      const details = error instanceof Error ? error.message : 'Password reset could not be started.';
      const rateLimited = /rate limit|too many requests|email.*limit/i.test(details);
      setResetMessage(rateLimited
        ? 'The RESA email service has temporarily limited reset emails. Please wait before requesting another link, or contact your school administrator for help.'
        : details);
    } finally {
      setResetBusy(false);
    }
  }

  return (
    <main className="foundation-auth-layout">
      <aside className="foundation-auth-aside">
        <Brand />

        <div className="foundation-auth-story">
          <div className="foundation-eyebrow">
            <span className="foundation-eyebrow-mark" />
            YOUR SCHOOL, YOUR FUTURE
          </div>

          <h1>
            Passion for learning.
            <br />
            Skills for life.
          </h1>

          <p>
            Welcome to RHEMA EXPLOITS SCIENCE ACADEMY
            INTERNATIONAL. Our school portal connects authorised
            members of our school community to their school workspace.
          </p>

          <div className="foundation-auth-feature">
            <ShieldCheck size={18} aria-hidden="true" />
            Secure sign-in with school access verification
          </div>

          <div className="foundation-auth-feature">
            <School size={18} aria-hidden="true" />
            Passion • Skills • Excellent Spirit
          </div>
        </div>

        <div className="foundation-auth-aside-bottom">
          <WebsiteLink />

          <div className="foundation-auth-aside-foot">
            RHEMA EXPLOITS SCIENCE ACADEMY INTERNATIONAL
          </div>
        </div>
      </aside>

      <section
        className="foundation-auth-main"
        aria-labelledby="signin-title"
      >
        <div className="foundation-auth-card">
          <div className="foundation-auth-mobile-brand">
            <Brand compact />
          </div>

          <div className="foundation-auth-mobile-website">
            <WebsiteLink compact />
          </div>

          <div className="foundation-eyebrow">
            <span className="foundation-eyebrow-mark" />
            {needsConfig ? 'SETUP REQUIRED' : 'WELCOME BACK'}
          </div>

          <h2 id="signin-title">
            {needsConfig
              ? 'Connect your sign-in'
              : 'Welcome to your school portal'}
          </h2>

          <p className="foundation-auth-subtitle">
            {needsConfig
              ? 'The secure sign-in connection needs to be configured before anyone can enter.'
              : 'Sign in with your registered school account to continue to your workspace.'}
          </p>

          {needsConfig ? (
            <div
              className="foundation-config-card"
              role="status"
              data-testid="status-setup-required"
            >
              <strong>
                <KeyRound size={15} aria-hidden="true" />
                Sign-in is not configured yet
              </strong>

              <p>
                Add the project’s Supabase URL and public key to the
                app environment, then refresh this page. No account
                details are needed here.
              </p>

              <span className="foundation-config-code">
                VITE_SUPABASE_URL · VITE_SUPABASE_ANON_KEY
              </span>
            </div>
          ) : (
            <>
              <form
                onSubmit={handleSubmit}
                className="flex flex-col gap-4"
              >
                <div className="foundation-signin-note">
                  <LockKeyhole size={18} aria-hidden="true" />

                  <div>
                    <strong>Secure school sign-in</strong>
                    <p>
                      Use your school username or registered email address and password.
                    </p>
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="foundation-email"
                    className="text-[12px] font-semibold text-[#43594e]"
                  >
                    Username or email address
                  </label>

                  <input
                    id="foundation-email"
                    name="email"
                    type="text"
                    autoComplete="username"
                    required
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="Enter your username or email"
                    className="w-full rounded-lg border border-[#e8e5da] bg-[#fffefa] px-3 py-3 text-[14px] text-[#30473d] placeholder:text-[#9ba39b] focus:border-[#789888] focus:outline-none focus:ring-2 focus:ring-[#789888]/20"
                    data-testid="input-sign-in-email"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="foundation-password"
                    className="text-[12px] font-semibold text-[#43594e]"
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
                    className="w-full rounded-lg border border-[#e8e5da] bg-[#fffefa] px-3 py-3 text-[14px] text-[#30473d] placeholder:text-[#9ba39b] focus:border-[#789888] focus:outline-none focus:ring-2 focus:ring-[#789888]/20"
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
                      <RefreshCw
                        size={16}
                        className="animate-spin"
                        aria-hidden="true"
                      />
                      Checking sign-in…
                    </>
                  ) : (
                    <>
                      Sign In to Portal
                      <ArrowRight size={16} aria-hidden="true" />
                    </>
                  )}
                </button>
              </form>

              <div className="mt-3">
                <button
                  type="button"
                  onClick={() => void handlePasswordReset()}
                  disabled={resetBusy || isLoading || needsConfig}
                  className="text-sm font-semibold text-emerald-800 underline underline-offset-4 disabled:opacity-50"
                  data-testid="button-forgot-password"
                >
                  {resetBusy ? 'Sending reset link…' : 'Forgot password?'}
                </button>
                {resetMessage && (
                  <p className="mt-2 text-sm text-[#536456]" role="status" aria-live="polite">
                    {resetMessage}
                  </p>
                )}
              </div>

              {statusText && (
                <p
                  className="foundation-auth-status"
                  role="status"
                  data-testid="status-auth"
                >
                  {statusText}
                </p>
              )}
            </>
          )}

          {errorText && (
            <div
              className="foundation-alert"
              role="alert"
              data-testid="status-auth-error"
            >
              <TriangleAlert size={16} aria-hidden="true" />
              <span>{errorText}</span>
            </div>
          )}

          <p className="foundation-auth-status">
            Need access? Contact your school administrator to confirm
            that your account has been invited.
          </p>

          <div className="foundation-auth-bottom-link">
            <WebsiteLink compact />
          </div>
        </div>
      </section>
    </main>
  );
}

function MembershipCard({
  membership,
}: {
  membership: FoundationMembership;
}) {
  return (
    <article
      className="foundation-membership"
      data-testid={`card-membership-${membership.id}`}
    >
      <span className="foundation-school-icon" aria-hidden="true">
        <School size={20} strokeWidth={1.7} />
      </span>

      <div className="foundation-membership-info">
        <div className="foundation-membership-name">
          {membership.schoolName}
        </div>

        <div className="foundation-membership-meta">
          <span>{membership.role}</span>
          <span
            className="foundation-role-separator"
            aria-hidden="true"
          />
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
        ? errorText ??
          'The access check could not be completed. Please try again.'
        : '');

  return (
    <div className="foundation-shell">
      <div className="foundation-frame">
        <aside className="foundation-rail">
          <Brand />

          <div className="foundation-dashboard-website">
            <WebsiteLink compact />
          </div>

          <nav
            className="foundation-nav"
            aria-label="Main navigation"
          >
            <div className="foundation-nav-label">
              YOUR WORKSPACE
            </div>

            <div
              className="foundation-nav-item"
              aria-current="page"
            >
              <ClipboardCheck size={17} aria-hidden="true" />
              <span>Access overview</span>
            </div>
          </nav>

          <div className="foundation-rail-note">
            <strong>Built around your school</strong>
            <p>
              Your role and school connections determine what you
              can see here.
            </p>
          </div>
        </aside>

        <main className="foundation-main">
          <header className="foundation-topbar">
            <div className="foundation-breadcrumb" aria-label="Breadcrumb">
              <span>RESA Portal</span>
              <ChevronRight size={13} aria-hidden="true" />
              <strong>Access overview</strong>
            </div>

            <div className="foundation-top-actions">
              <span className="foundation-secure">
                <LockKeyhole size={13} aria-hidden="true" />
                Secure session
              </span>

              <div className="foundation-user-chip">
                <span
                  className="foundation-avatar"
                  aria-hidden="true"
                >
                  {initials}
                </span>

                {signedInEmail && (
                  <span
                    className="foundation-email"
                    data-testid="text-signed-in-email"
                  >
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
              RESA SCHOOL PORTAL
            </div>

            <h1 className="foundation-heading">
              Your school access, at a glance.
            </h1>

            <p className="foundation-lede">
              Welcome to RESA International. Review the schools
              connected to your account and check that your
              membership access is working as expected.
            </p>

            {errorText && accessCheckState !== 'error' && (
              <div
                className="foundation-alert"
                role="alert"
                data-testid="status-dashboard-error"
              >
                <TriangleAlert size={16} aria-hidden="true" />
                <span>{errorText}</span>
              </div>
            )}

            <div className="foundation-content-grid">
              <section
                className="foundation-panel"
                aria-labelledby="memberships-title"
              >
                <div className="foundation-panel-header">
                  <div>
                    <h2
                      className="foundation-panel-title"
                      id="memberships-title"
                    >
                      School memberships
                    </h2>

                    <p className="foundation-panel-description">
                      Schools and roles associated with this account.
                    </p>
                  </div>

                  <span className="foundation-panel-tag">
                    <span
                      className={`foundation-status-dot ${
                        memberships.length ? 'success' : ''
                      }`}
                    />

                    {membershipsLoading
                      ? 'Loading'
                      : `${memberships.length} ${
                          memberships.length === 1
                            ? 'membership'
                            : 'memberships'
                        }`}
                  </span>
                </div>

                <div className="foundation-panel-body">
                  {membershipsLoading ? (
                    <div
                      className="foundation-membership-list"
                      aria-label="Loading memberships"
                      aria-busy="true"
                      data-testid="loading-memberships"
                    >
                      <div className="foundation-skeleton" />
                      <div className="foundation-skeleton" />
                    </div>
                  ) : memberships.length > 0 ? (
                    <div
                      className="foundation-membership-list"
                      data-testid="list-memberships"
                    >
                      {memberships.map((membership) => (
                        <MembershipCard
                          key={membership.id}
                          membership={membership}
                        />
                      ))}
                    </div>
                  ) : (
                    <div
                      className="foundation-empty"
                      data-testid="empty-memberships"
                    >
                      <span
                        className="foundation-empty-icon"
                        aria-hidden="true"
                      >
                        <School size={23} strokeWidth={1.6} />
                      </span>

                      <h3>No school memberships yet</h3>

                      <p>
                        When a school connects your account, its
                        membership and role will appear here.
                      </p>
                    </div>
                  )}
                </div>
              </section>

              <section
                className="foundation-panel"
                aria-labelledby="access-check-title"
              >
                <div className="foundation-panel-header">
                  <div>
                    <h2
                      className="foundation-panel-title"
                      id="access-check-title"
                    >
                      Access check
                    </h2>

                    <p className="foundation-panel-description">
                      Confirm that your account can read its own
                      membership details.
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
                    <span
                      className="foundation-access-icon"
                      aria-hidden="true"
                    >
                      <ShieldCheck size={21} strokeWidth={1.7} />
                    </span>

                    <div className="foundation-access-copy">
                      <strong>Private by design</strong>

                      <p>
                        Memberships are scoped to your signed-in
                        account. Run a check to confirm the connection.
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
                        <RefreshCw
                          size={15}
                          className="animate-spin"
                          aria-hidden="true"
                        />
                        Checking access…
                      </>
                    ) : accessCheckState === 'success' ? (
                      <>
                        <Check size={16} aria-hidden="true" />
                        Run check again
                      </>
                    ) : (
                      <>
                        <ClipboardCheck
                          size={16}
                          aria-hidden="true"
                        />
                        Check my access
                      </>
                    )}
                  </button>

                  {accessCheckState === 'success' && (
                    <div
                      className="foundation-check-result"
                      role="status"
                      data-testid="status-access-check-success"
                    >
                      <CheckCircle2 size={16} aria-hidden="true" />
                      <span>
                        {checkResultText || 'Access confirmed.'}
                      </span>
                    </div>
                  )}

                  {accessCheckState === 'error' && (
                    <div
                      className="foundation-check-result error"
                      role="alert"
                      data-testid="status-access-check-error"
                    >
                      <CircleAlert size={16} aria-hidden="true" />
                      <span>{checkResultText}</span>
                    </div>
                  )}

                  {accessCheckState === 'loading' && (
                    <div
                      className="foundation-check-result loading"
                      role="status"
                      data-testid="status-access-check-loading"
                    >
                      <RefreshCw size={15} aria-hidden="true" />
                      <span>
                        Checking your account’s membership access…
                      </span>
                    </div>
                  )}

                  {accessCheckState === 'idle' && statusText && (
                    <div
                      className="foundation-check-result"
                      role="status"
                      data-testid="status-access-check"
                    >
                      <Sparkles size={15} aria-hidden="true" />
                      <span>{statusText}</span>
                    </div>
                  )}

                  <div className="foundation-rule" />

                  <div className="foundation-security-row">
                    <LockKeyhole size={14} aria-hidden="true" />
                    <span>
                      Your access check uses your active sign-in and
                      school permissions.
                    </span>
                  </div>
                </div>
              </section>
            </div>

            <footer className="foundation-footer">
              <span>RESA International · School Portal</span>
              <span>Only your account’s access is shown</span>
            </footer>

            <div className="foundation-content-website">
              <WebsiteLink compact />
            </div>
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