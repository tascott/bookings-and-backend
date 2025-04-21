'use client';

import styles from "@/app/page.module.css"; // Adjust path as needed

// Define props for the component
interface AuthFormProps {
    // Pass server actions as props
    login: (formData: FormData) => Promise<void>;
    signup: (formData: FormData) => Promise<void>;
    // Add error display prop if needed
    // authError: string | null;
}

export default function AuthForm({ login, signup }: AuthFormProps) {

    return (
        <div style={{ maxWidth: '400px', margin: '50px auto', border: '1px solid #ccc', padding: '2rem', borderRadius: '8px' }}>
            <form className={styles.authForm}>
                <h2>Login or Sign Up</h2>

                <div>
                    <label htmlFor="name">Name:</label>
                    <input id="name" name="name" type="text" placeholder="Your Name (for signup)" />
                </div>

                <div>
                    <label htmlFor="email">Email:</label>
                    <input id="email" name="email" type="email" required placeholder="your@email.com" />
                </div>

                <div>
                    <label htmlFor="password">Password:</label>
                    <input id="password" name="password" type="password" required placeholder="••••••••" />
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1rem' }}>
                    {/* Use the passed server actions */}
                    <button type="submit" formAction={login}>Log in</button>
                    <button type="submit" formAction={signup}>Sign up</button>
                </div>
                {/* Optionally display authentication errors passed via props */}
                {/* {authError && <p style={{ color: 'red', marginTop: '1rem' }}>{authError}</p>} */}
            </form>
        </div>
    );
}