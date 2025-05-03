'use client';

import { useState, FormEvent, useEffect } from 'react';
// Use createBrowserClient directly from @supabase/ssr
import { createBrowserClient } from '@supabase/ssr';
import { useRouter } from 'next/navigation';
// import type { Session, AuthError } from '@supabase/supabase-js'; // Types not strictly needed here
import styles from "@/app/page.module.css";

export default function ResetPasswordPage() {
  const router = useRouter();
  // Initialize client using createBrowserClient and store in state to ensure stable instance
  const [supabase] = useState(() =>
    createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
  );
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState<string | null>(null); // Use string|null for error state
  const [loading, setLoading] = useState(false);
  const [isSessionReady, setIsSessionReady] = useState(false); // Track manual session readiness

  // Effect to manually handle hash fragment and set session
  useEffect(() => {
    const hash = window.location.hash;
    if (hash) {
      const params = new URLSearchParams(hash.substring(1)); // remove #
      const access_token = params.get('access_token');
      const refresh_token = params.get('refresh_token');
      const type = params.get('type');

      // Check if it looks like a password recovery fragment
      if (access_token && refresh_token && type === 'recovery') {
        setLoading(true);
        setError(null);
        setMessage('Processing recovery link...');

        supabase.auth
          .setSession({ access_token, refresh_token })
          .then(({ error: sessionError }) => {
            if (sessionError) {
              setError(`Failed to process recovery link: ${sessionError.message}`);
              setMessage('');
              setIsSessionReady(false);
            } else {
              setMessage('Ready to set new password.');
              setError(null);
              setIsSessionReady(true); // Session is ready!
            }
          })
          .finally(() => {
            setLoading(false);
          });
      } else if (params.get('error')) {
        const errorDesc = params.get('error_description') || 'An error occurred.';
        setError(`Failed to process link: ${decodeURIComponent(errorDesc)}`);
        setIsSessionReady(false);
      }
    } else {
      // Consider adding a user-facing message if needed, but don't block rendering
    }
    // No dependency array needed if supabase client is stable via useState
  }, [supabase]); // Depend on the stable supabase client instance

  // Remove the onAuthStateChange listener useEffect completely

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!isSessionReady) {
      setError('Session not established. Please ensure you used a valid link or wait.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    setLoading(true);
    setMessage('');
    setError(null);

    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });

      if (updateError) {
        throw new Error(updateError.message || 'Failed to update password.');
      }

      setMessage('Password updated successfully! Redirecting to login...');
      setPassword('');
      setConfirmPassword('');
      setError(null);
      setTimeout(() => router.push('/'), 3000);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update password.';
      console.error('Error during password update:', err);
      setError(errorMessage);
      setMessage('');
    } finally {
      setLoading(false);
    }
  };

  // --- JSX ---
  return (
    <div style={{ maxWidth: '400px', margin: '50px auto', border: '1px solid #ccc', padding: '2rem', borderRadius: '8px' }}>
      <h2>Set New Password</h2>
      <p>Please enter your new password below.</p>
      <form onSubmit={handleSubmit} className={styles.authForm}>
        {/* Inputs disabled based on loading state and isSessionReady */}
        <div style={{ marginTop: '1rem' }}>
          <label htmlFor="password">New Password:</label>
          <input
            id="password"
            name="password"
            type="password"
            required
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading || !isSessionReady}
            style={{ width: '100%' }}
          />
        </div>
        <div style={{ marginTop: '1rem' }}>
          <label htmlFor="confirmPassword">Confirm New Password:</label>
          <input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            required
            placeholder="••••••••"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            disabled={loading || !isSessionReady}
            style={{ width: '100%' }}
          />
        </div>

        {message && <p style={{ color: 'green', marginTop: '1rem' }}>{message}</p>}
        {error && <p style={{ color: 'red', marginTop: '1rem' }}>{error}</p>}

        <div style={{ marginTop: '1.5rem' }}>
          {/* Button disabled based on loading state and isSessionReady */}
          <button
             type="submit"
             disabled={loading || !isSessionReady}
             style={{ width: '100%', padding: '0.75rem' }}
           >
            {loading ? 'Processing...' : 'Update Password'}
          </button>
        </div>
      </form>
    </div>
  );
}