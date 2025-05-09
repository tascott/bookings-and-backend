'use client';

import { useState } from 'react'; // Import useState
import { useSearchParams } from 'next/navigation'; // Import hook
import styles from "@/app/page.module.css"; // Adjust path as needed
import Link from 'next/link';

// Define props for the component
interface AuthFormProps {
    // Pass server actions as props
    login: (formData: FormData) => Promise<void>;
    signup: (formData: FormData) => Promise<void>;
    // Add error display prop if needed
    // authError: string | null;
}

export default function AuthForm({ login, signup }: AuthFormProps) {
    // Get search params
    const searchParams = useSearchParams();
    const message = searchParams.get('message');
    // State to control the mode: 'login' or 'signup'
    const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');

    // Toggle function
    const toggleMode = () => {
        setAuthMode(prevMode => prevMode === 'login' ? 'signup' : 'login');
    };

    return (
        <div style={{ maxWidth: '400px', margin: '50px auto', border: '1px solid #ccc', padding: '2rem', borderRadius: '8px' }}>
            {/* Update the form action based on the mode */}
            <form className={styles.authForm} action={authMode === 'login' ? login : signup}>
                <h2>{authMode === 'login' ? 'Log In' : 'Sign Up'}</h2>

                {/* Display message if present in URL */}
                {message && (
                    <p style={{ color: 'red', border: '1px solid red', padding: '0.5rem', borderRadius: '4px', marginBottom: '1rem' }}>
                        {message}
                    </p>
                )}

                {/* Conditionally render Sign Up fields */}
                {authMode === 'signup' && (
                    <>
                        <div style={{ display: 'flex', gap: '1rem' }}>
                            <div style={{ flex: 1 }}>
                                <label htmlFor="firstName">First Name:</label>
                                {/* Add required attribute only for signup */}
                                <input id="firstName" name="firstName" type="text" required placeholder="First Name" />
                            </div>
                            <div style={{ flex: 1 }}>
                                <label htmlFor="lastName">Last Name:</label>
                                {/* Add required attribute only for signup */}
                                <input id="lastName" name="lastName" type="text" required placeholder="Last Name" />
                            </div>
                        </div>

                        <div style={{ marginTop: '1rem' }}> {/* Added margin for spacing */}
                            <label htmlFor="phone">Phone Number:</label>
                            {/* Add required attribute only for signup */}
                            <input id="phone" name="phone" type="tel" required placeholder="(xxx) xxx-xxxx" />
                        </div>

                        <div style={{ marginTop: '1rem' }}>
                            <label htmlFor="businessType">Business Type: (will auto populate in future)</label>
                            <select id="businessType" name="businessType" required style={{ width: '100%', padding: '0.5rem', marginTop: '0.25rem', boxSizing: 'border-box' }}>
                                <option value="" disabled>Select type...</option>
                                <option value="Pet Services">Pet Services</option>
                                <option value="Field Hire">Field Hire</option>
                                {/* Add other business types as needed */}
                            </select>
                        </div>
                    </>
                )}

                {/* Email and Password are always required */}
                <div style={{ marginTop: '1rem' }}> {/* Added margin for spacing */}
                    <label htmlFor="email">Email:</label>
                    <input id="email" name="email" type="email" required placeholder="your@email.com" />
                </div>

                <div style={{ marginTop: '1rem' }}> {/* Added margin for spacing */}
                    <label htmlFor="password">Password:</label>
                    <input id="password" name="password" type="password" required placeholder="••••••••" />
                    {/* Add Forgot Password Link - only show in login mode */}
                    {authMode === 'login' && (
                        <div style={{ textAlign: 'right', marginTop: '0.5rem', fontSize: '0.8em' }}>
                            <Link href="/forgot-password" style={{ color: 'blue', textDecoration: 'underline' }}>
                                Forgot Password?
                            </Link>
                        </div>
                    )}
                </div>

                {/* Buttons Section */}
                <div style={{ marginTop: '1.5rem' }}> {/* Adjusted margin */}
                    {/* Display the correct submit button based on mode */}
                    <button type="submit" style={{ width: '100%', padding: '0.75rem' }}>
                        {authMode === 'login' ? 'Log In' : 'Sign Up'}
                    </button>

                    {/* Link to toggle mode */}
                    <p style={{ textAlign: 'center', marginTop: '1rem', fontSize: '0.9em' }}>
                        {authMode === 'login' ? "Don't have an account? " : "Already have an account? "}
                        <button type="button" onClick={toggleMode} style={{ background: 'none', border: 'none', color: 'blue', textDecoration: 'underline', cursor: 'pointer', padding: 0 }}>
                            {authMode === 'login' ? 'Sign Up' : 'Log In'}
                        </button>
                    </p>
                </div>
                {/* Optionally display authentication errors passed via props */}
                {/* {authError && <p style={{ color: 'red', marginTop: '1rem' }}>{authError}</p>} */}
            </form>
        </div>
    );
}