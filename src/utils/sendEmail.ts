import { Resend } from 'resend';
// Import specific success type from Resend SDK
import type { CreateEmailResponseSuccess } from 'resend';

// Initialize Resend client only once
let resend: Resend | null = null;
if (process.env.RESEND_API_KEY) {
    resend = new Resend(process.env.RESEND_API_KEY);
} else {
    console.error('RESEND_API_KEY environment variable is not set. Email functionality will be disabled.');
}

// Get the default sender email address from environment variables
const defaultFrom = process.env.RESEND_EMAIL || 'noreply@yourdomain.com'; // Fallback needed if env var not set
if (defaultFrom === 'noreply@yourdomain.com' && process.env.NODE_ENV !== 'test') {
    console.warn('RESEND_EMAIL environment variable not set. Using fallback sender address. Ensure this domain is verified in Resend.');
}

interface SendEmailParams {
    to: string | string[];
    subject: string;
    html: string;
    from?: string;
    replyTo?: string;
}

/**
 * Sends an email using the configured Resend client.
 *
 * @param params - Email parameters (to, subject, html, optional from/replyTo)
 * @returns Promise resolving with the sent email success data (id) or rejecting with an error.
 */
export const sendEmail = async (params: SendEmailParams): Promise<CreateEmailResponseSuccess> => {
    if (!resend) {
        console.error('Resend client not initialized. Cannot send email.');
        return Promise.reject(new Error('Resend client not initialized due to missing API key.'));
    }

    const { to, subject, html, from, replyTo } = params;
    const sender = from || defaultFrom;

    try {

        const response = await resend.emails.send({
            from: sender,
            to: to,
            subject: subject,
            html: html,
            replyTo: replyTo,
        });

        if (response.error) {
            console.error('Resend API Error:', response.error);
            throw new Error(`Failed to send email via Resend: ${response.error.message}`);
        }

        if (!response.data) {
            throw new Error('Resend API returned success but no data object.');
        }
        return response.data;

    } catch (err) {
        console.error('Error in sendEmail utility:', err);
        throw err;
    }
};