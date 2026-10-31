
import { useEffect, useState, type FormEvent } from 'react';
import { getSupabaseClient } from '@/lib/supabase/client';

type PageStatus = 'checking' | 'ready' | 'saving' | 'success' | 'error';
type AccountRole = 'student' | 'teacher' | 'parent' | 'unknown';

export default function AcceptInvitationPage() {
  const [status, setStatus] = useState<PageStatus>('checking');
  const [role, setRole] = useState<AccountRole>('unknown');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');

  const isStudent = role === 'student';
  const isTeacher = role === 'teacher';
  const isParent = role === 'parent';

  const accountLabel = isStudent
    ? 'student'
    : isTeacher
      ? 'teacher'
      : 'school';

  useEffect(() => {
    let active = true;

    async function checkInvitation() {
      try {
        const client = getSupabaseClient();
        const url = new URL(window.location.href);
        const hashParams = new URLSearchParams(
          url.hash.startsWith('#') ? url.hash.slice(1) : url.hash,
        );

        const tokenHash = url.searchParams.get('token_hash');
        const tokenType = url.searchParams.get('type');
        const authCode = url.searchParams.get('code');
        const hashError =
          hashParams.get('error_description') ||
          hashParams.get('error');

        if (hashError) {
          throw new Error(
            hashParams.get('error_description') ||
              'Your invitation link could not be verified. Ask the school administrator to send a new invitation.',
          );
        }

        let verifiedInvitation = false;

        if (tokenHash && tokenType === 'invite') {
          const { error } = await client.auth.verifyOtp({
            token_hash: tokenHash,
            type: 'invite',
          });

          if (error) throw error;

          verifiedInvitation = true;
          url.searchParams.delete('token_hash');
          url.searchParams.delete('type');
          window.history.replaceState(
            {},
            document.title,
            `${url.pathname}${url.search}${url.hash}`,
          );
        } else if (authCode) {
          const { error } =
            await client.auth.exchangeCodeForSession(authCode);

          if (error) throw error;

          verifiedInvitation = true;
          url.searchParams.delete('code');
          window.history.replaceState(
            {},
            document.title,
            `${url.pathname}${url.search}${url.hash}`,
          );
        } else if (
          hashParams.get('access_token') &&
          hashParams.get('refresh_token')
        ) {
          // Supabase normally processes implicit-flow tokens automatically.
          // Give the client a chance to finish processing the URL.
          const { data, error } = await client.auth.getSession();

          if (error) throw error;

          if (data.session) {
            verifiedInvitation =
              hashParams.get('type') === 'invite' ||
              hashParams.get('type') === 'recovery' ||
              hashParams.get('type') === 'signup';
          }

          if (verifiedInvitation) {
            window.history.replaceState(
              {},
              document.title,
              `${url.pathname}${url.search}`,
            );
          }
        }

        const {
          data: { session },
          error: sessionError,
        } = await client.auth.getSession();

        if (sessionError) throw sessionError;

        if (!session) {
          throw new Error(
            'This invitation link is invalid, expired, or already used. Ask your school administrator to send a new invitation.',
          );
        }

        // Do not accept an unrelated existing login as proof of an invitation.
        // A valid invitation URL must have been processed, unless the current
        // authenticated account has a supported school role.
        const metadataRole =
          session.user.app_metadata?.role ??
          session.user.user_metadata?.role;

        let detectedRole: AccountRole =
          metadataRole === 'student' || metadataRole === 'teacher' || metadataRole === 'parent'
            ? metadataRole
            : 'unknown';

        const { data: membership, error: membershipError } = await client
          .from('school_memberships')
          .select('role,status')
          .eq('user_id', session.user.id)
          .in('role', ['student', 'teacher', 'parent'])
          .limit(1)
          .maybeSingle();

        if (!membershipError && membership) {
          if (
            membership.role === 'student' ||
            membership.role === 'teacher' ||
            membership.role === 'parent'
          ) {
            detectedRole = membership.role;
          }
        }

        // Student invitations may identify the account in user metadata even
        // when the membership query is not yet available.
        const accountType = session.user.user_metadata?.account_type;

        if (
          detectedRole === 'unknown' &&
          (accountType === 'student' || accountType === 'parent')
        ) {
          detectedRole = accountType; 
        }

        if (!active) return;

        if (!verifiedInvitation && detectedRole === 'unknown') {
          throw new Error(
            'We could not confirm that this is a valid school invitation. Open the original invitation link or ask the school administrator to send a new one.',
          );
        }

        setRole(detectedRole);
        setStatus('ready');
        setMessage('');
      } catch (error) {
        if (!active) return;

        setStatus('error');
        setMessage(
          error instanceof Error
            ? error.message
            : 'We could not verify your invitation. Please request a new invitation.',
        );
      }
    }

    void checkInvitation();

    return () => {
      active = false;
    };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');

    if (password.length < 8 || password.length > 128) {
      setMessage('Your password must contain between 8 and 128 characters.');
      return;
    }

    if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
      setMessage('Use at least one letter and one number in your password.');
      return;
    }

    if (password !== confirmPassword) {
      setMessage('The passwords do not match.');
      return;
    }

    setStatus('saving');

    try {
      const client = getSupabaseClient();

      const {
        data: { session },
        error: sessionError,
      } = await client.auth.getSession();

      if (sessionError) throw sessionError;

      if (!session?.access_token) {
        throw new Error(
          'Your invitation session has expired. Ask the administrator to send a new invitation.',
        );
      }

      // Use the deployed server-side activation function. Do not use
      // client.auth.updateUser({ password }), which may require the current
      // password when that Supabase Auth security option is enabled.
      const { data: activationData, error: activationError } =
        await client.functions.invoke('resa-activate-account', {
          body: { password },
        });

      if (activationError) {
        throw new Error(
          activationError.message ||
            'The activation service could not create your password. Please try again.',
        );
      }

      if (
        !activationData ||
        activationData.success !== true
      ) {
        throw new Error(
          typeof activationData?.message === 'string'
            ? activationData.message
            : 'Your password could not be created. Ask the school administrator for assistance.',
        );
      }

      // End the invitation session after the server confirms success.
      const { error: signOutError } = await client.auth.signOut();

      if (signOutError) {
        setPassword('');
        setConfirmPassword('');
        setStatus('success');
        setMessage(
          'Your password was created successfully. Close this page, return to the school portal, and sign in with your email address and new password. If the previous session remains open on this device, sign out before signing in again.',
        );
        return;
      }

      setPassword('');
      setConfirmPassword('');
      setStatus('success');

      if (isStudent) {
        setMessage(
          'Your student account password has been created. Return to the school portal and sign in with your email address and new password. If access is not yet available, contact your school administrator.',
        );
      } else if (isTeacher) {
        setMessage(
          'Your password has been created. Your teacher access remains subject to school administrator approval. After approval, return to the portal and sign in with your email address and new password.',
        );
      } else if (isParent) {
        setMessage(
          'Your parent account has been activated. Return to the school portal and sign in with your email address and new password to view your linked child or children.',
        );
      } else {
        setMessage(
          'Your password has been created. Return to the school portal and sign in with your email address and new password. If you cannot access your account, contact your school administrator.',
        );
      }
    } catch (error) {
      setStatus('ready');
      setMessage(
        error instanceof Error
          ? error.message
          : 'We could not create your password. Please try again.',
      );
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    boxSizing: 'border-box',
    marginTop: 6,
    padding: '12px',
    border: '1px solid #cbd5cc',
    borderRadius: 8,
    fontSize: 16,
  };

  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        padding: 20,
        boxSizing: 'border-box',
        background: '#f4f7f4',
        color: '#17251b',
        fontFamily: 'Arial, sans-serif',
      }}
    >
      <section
        style={{
          width: '100%',
          maxWidth: 440,
          padding: 24,
          boxSizing: 'border-box',
          border: '1px solid #e0e7e0',
          borderRadius: 16,
          background: '#fff',
          boxShadow: '0 8px 30px rgba(18,61,43,0.08)',
        }}
      >
        <p
          style={{
            margin: 0,
            color: '#17683b',
            fontSize: 12,
            fontWeight: 800,
            letterSpacing: 1.5,
          }}
        >
          RESA SCHOOL PORTAL
        </p>

        <h1 style={{ margin: '12px 0', fontSize: 26 }}>
          {`Activate your ${accountLabel} account`}
        </h1>

        <p style={{ color: '#58645b', lineHeight: 1.6 }}>
          {isTeacher
            ? 'Create a password to complete your invitation. Your teacher access remains subject to school administrator approval.'
            : isStudent
              ? 'Create a password to complete your student invitation and access the school portal.'
              : 'Create a password to complete your invitation and set up your school portal account.'}
        </p>

        {status === 'checking' && (
          <p role="status">Verifying your invitation link…</p>
        )}

        {status === 'error' && (
          <div
            role="alert"
            style={{
              padding: 12,
              borderRadius: 8,
              background: '#fbe6e6',
              color: '#8b1e1e',
              overflowWrap: 'anywhere',
            }}
          >
            {message}
          </div>
        )}

        {status === 'success' && (
          <div
            role="status"
            style={{
              padding: 14,
              borderRadius: 8,
              background: '#e3f4e7',
              color: '#155b30',
              lineHeight: 1.6,
              overflowWrap: 'anywhere',
            }}
          >
            <strong>Password created successfully.</strong>
            <p>{message}</p>
            <a
              href="/portal"
              style={{ color: '#155b30', fontWeight: 700 }}
            >
              Go to the school portal
            </a>
          </div>
        )}

        {(status === 'ready' || status === 'saving') && (
          <form onSubmit={(event) => void handleSubmit(event)}>
            <label
              htmlFor="account-password"
              style={{ display: 'block', marginTop: 22, fontWeight: 700 }}
            >
              Create password
            </label>
            <input
              id="account-password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              maxLength={128}
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="At least 8 characters"
              style={inputStyle}
            />

            <label
              htmlFor="account-confirm-password"
              style={{ display: 'block', marginTop: 18, fontWeight: 700 }}
            >
              Confirm password
            </label>
            <input
              id="account-confirm-password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              maxLength={128}
              required
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              placeholder="Enter the same password again"
              style={inputStyle}
            />

            {message && (
              <p
                role="alert"
                style={{
                  color: '#9b2424',
                  fontSize: 14,
                  overflowWrap: 'anywhere',
                }}
              >
                {message}
              </p>
            )}

            <button
              type="submit"
              disabled={status === 'saving'}
              style={{
                width: '100%',
                marginTop: 22,
                padding: 13,
                border: 0,
                borderRadius: 8,
                background: '#123d2b',
                color: '#fff',
                fontSize: 15,
                fontWeight: 700,
                cursor: status === 'saving' ? 'wait' : 'pointer',
                opacity: status === 'saving' ? 0.7 : 1,
              }}
            >
              {status === 'saving' ? 'Creating password…' : 'Create password'}
            </button>
          </form>
        )}

        {status === 'error' && (
          <a
            href="/portal"
            style={{
              display: 'inline-block',
              marginTop: 18,
              color: '#17683b',
              fontWeight: 700,
            }}
          >
            Return to the school portal
          </a>
        )}
      </section>
    </main>
  );
}
