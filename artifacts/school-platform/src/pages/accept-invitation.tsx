
import { useEffect, useState, type FormEvent } from 'react';
import { getSupabaseClient } from '@/lib/supabase/client';

type PageStatus = 'checking' | 'ready' | 'saving' | 'success' | 'error';

export default function AcceptInvitationPage() {
  const [status, setStatus] = useState<PageStatus>('checking');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    let active = true;

    async function checkInvitation() {
      try {
        const client = getSupabaseClient();
        const url = new URL(window.location.href);
        const tokenHash = url.searchParams.get('token_hash');
        const tokenType = url.searchParams.get('type');

        if (tokenHash && tokenType === 'invite') {
          const { error } = await client.auth.verifyOtp({
            token_hash: tokenHash,
            type: 'invite',
          });

          if (error) throw error;

          url.searchParams.delete('token_hash');
          url.searchParams.delete('type');
          window.history.replaceState({}, document.title, url.toString());
        }

        // Supabase may also deliver the invitation session in the URL hash
        // or through its PKCE callback flow.
        const { data, error } = await client.auth.getSession();

        if (error) throw error;

        if (!data.session) {
          throw new Error(
            'This invitation link is invalid, expired, or already used. Ask your school administrator to send a new invitation.',
          );
        }

        if (active) {
          setStatus('ready');
          setMessage('');
        }
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

    if (password.length < 8) {
      setMessage('Your password must contain at least 8 characters.');
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

      if (!session) {
        throw new Error(
          'Your invitation session has expired. Ask the administrator for a new invitation.',
        );
      }

      const { error: updateError } = await client.auth.updateUser({
        password,
      });

      if (updateError) throw updateError;

      // Creating a password must not bypass the administrator's
      // school-membership approval process.
      const { error: signOutError } = await client.auth.signOut();

      if (signOutError) {
        throw new Error(
          'Your password was created, but we could not safely end the invitation session. Please close this page and contact the administrator.',
        );
      }

      setPassword('');
      setConfirmPassword('');
      setStatus('success');
      setMessage(
        'Your password has been created. Your school administrator must approve your teacher account before you can access the school portal. After approval, return to the portal and sign in with your email and new password.',
      );
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
          Activate your teacher account
        </h1>

        <p style={{ color: '#58645b', lineHeight: 1.6 }}>
          Create a password to complete your invitation. Your teacher access
          remains subject to school administrator approval.
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
              htmlFor="teacher-password"
              style={{ display: 'block', marginTop: 22, fontWeight: 700 }}
            >
              Create password
            </label>
            <input
              id="teacher-password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="At least 8 characters"
              style={inputStyle}
            />

            <label
              htmlFor="teacher-confirm-password"
              style={{ display: 'block', marginTop: 18, fontWeight: 700 }}
            >
              Confirm password
            </label>
            <input
              id="teacher-confirm-password"
              type="password"
              autoComplete="new-password"
              minLength={8}
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
