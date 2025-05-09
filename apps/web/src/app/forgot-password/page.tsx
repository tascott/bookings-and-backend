'use client';

import { useState, FormEvent } from 'react';
import Link from 'next/link';
// You might want to reuse some styles, adjust path as needed
import styles from "@/app/page.module.css";
import { requestPasswordReset } from '@booking-and-accounts-monorepo/api-services'; // Import auth service

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setMessage('');
    setError('');

    try {
      // Use the service function
      const data = await requestPasswordReset(email);
      setMessage(data.message);
      setEmail(''); // Clear email field on success
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to request password reset.';
      setError(errorMessage);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '400px', margin: '50px auto', border: '1px solid #ccc', padding: '2rem', borderRadius: '8px' }}>
      <h2>Reset Password</h2>
      <p>Enter the email address associated with your account, and we&apos;ll send you a link to reset your password.</p>
      <form onSubmit={handleSubmit} className={styles.authForm}>
        <div style={{ marginTop: '1rem' }}>
          <label htmlFor="email">Email:</label>
          <input
            id="email"
            name="email"
            type="email"
            required
            placeholder="your@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={loading}
            style={{ width: '100%' }} // Ensure input takes full width
          />
        </div>

        {message && <p style={{ color: 'green', marginTop: '1rem' }}>{message}</p>}
        {error && <p style={{ color: 'red', marginTop: '1rem' }}>{error}</p>}

        <div style={{ marginTop: '1.5rem' }}>
          <button type="submit" disabled={loading} style={{ width: '100%', padding: '0.75rem' }}>
            {loading ? 'Sending...' : 'Send Reset Link'}
          </button>
        </div>

        <p style={{ textAlign: 'center', marginTop: '1rem', fontSize: '0.9em' }}>
          Remember your password? <Link href="/login" style={{ color: 'blue', textDecoration: 'underline' }}>Log In</Link>
        </p>
      </form>
    </div>
  );
}