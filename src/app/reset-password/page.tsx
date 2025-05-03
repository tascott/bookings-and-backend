'use client';

import { useState, FormEvent, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client'; // Import client-side Supabase client
import { useRouter } from 'next/navigation';
// Reuse styles if desired
import styles from "@/app/page.module.css";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isClient, setIsClient] = useState(false);

  // Ensure component only runs client-side for Supabase interaction
  useEffect(() => {
    setIsClient(true);
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (password.length < 6) { // Example: Enforce minimum password length
        setError('Password must be at least 6 characters long.');
        return;
    }

    setLoading(true);
    setMessage('');
    setError('');

    // Client-side Supabase client
    const supabase = createClient();

    try {
        // Supabase client handles the session from the URL hash automatically.
        // We call updateUser with the new password.
        const { error: updateError } = await supabase.auth.updateUser({
            password: password,
        });

        if (updateError) {
            throw new Error(updateError.message || 'Failed to update password.');
        }

        setMessage('Password updated successfully! You can now log in with your new password.');
        setPassword('');
        setConfirmPassword('');
        // Optionally redirect to login after a short delay
        setTimeout(() => router.push('/login'), 3000);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update password.';
      setError(errorMessage);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Render null server-side or until client hydration is complete
  if (!isClient) {
    return null;
  }

  return (
    <div style={{ maxWidth: '400px', margin: '50px auto', border: '1px solid #ccc', padding: '2rem', borderRadius: '8px' }}>
      <h2>Set New Password</h2>
      <p>Please enter your new password below.</p>
      <form onSubmit={handleSubmit} className={styles.authForm}>
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
            disabled={loading}
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
            disabled={loading}
            style={{ width: '100%' }}
          />
        </div>

        {message && <p style={{ color: 'green', marginTop: '1rem' }}>{message}</p>}
        {error && <p style={{ color: 'red', marginTop: '1rem' }}>{error}</p>}

        <div style={{ marginTop: '1.5rem' }}>
          <button type="submit" disabled={loading} style={{ width: '100%', padding: '0.75rem' }}>
            {loading ? 'Updating...' : 'Update Password'}
          </button>
        </div>
      </form>
    </div>
  );
}