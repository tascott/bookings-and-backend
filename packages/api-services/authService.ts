/**
 * Sends a request to the backend to initiate the password reset process.
 */
export async function requestPasswordReset(email: string): Promise<{ message: string }> {
    const response = await fetch('/api/auth/request-password-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
    });

    const data = await response.json();

    if (!response.ok) {
        // Throw an error with the message from the API response if available
        throw new Error(data.error || 'An unexpected error occurred while requesting password reset.');
    }

    // Return the success message from the API response
    return data; // Expects { message: string }
}

// Placeholder for the function to handle the actual password update
/**
 * Sends the reset token and new password to the backend.
 * Define UpdatePasswordPayload based on your API requirements (token, newPassword).
 */
// export async function updateUserPassword(payload: UpdatePasswordPayload): Promise<{ message: string }> { ... }