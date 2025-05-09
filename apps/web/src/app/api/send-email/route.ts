import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';

// Initialize Resend with API Key from environment variables
const resend = new Resend(process.env.RESEND_API_KEY);

// Define expected payload structure (adjust as needed)
interface EmailPayload {
  to: string | string[]; // Recipient(s)
  subject: string;        // Email subject
  html: string;           // Email body (HTML content)
  from?: string;          // Optional: Defaults to your Resend domain setting
  reply_to?: string;      // Optional: Custom reply-to address
}

export async function POST(request: NextRequest) {
  // Check for API Key existence
  if (!process.env.RESEND_API_KEY) {
    console.error('Resend API Key is not set in environment variables.');
    return NextResponse.json({ error: 'Email configuration error.' }, { status: 500 });
  }

  try {
    const payload = await request.json() as EmailPayload;

    // Basic validation (add more as needed)
    if (!payload.to || !payload.subject || !payload.html) {
      return NextResponse.json({ error: 'Missing required email parameters: to, subject, html' }, { status: 400 });
    }

    // Define the default sender from environment or hardcode
    // IMPORTANT: This email MUST be associated with a verified domain in Resend.
    // Use RESEND_EMAIL variable set by user
    const defaultFrom = process.env.RESEND_EMAIL || 'onboarding@resend.dev'; // Fallback if not set

    console.log(`Attempting to send email via Resend: From=${defaultFrom}, To=${payload.to}, Subject=${payload.subject}`);

    const { data, error } = await resend.emails.send({
      from: payload.from || defaultFrom, // Use the determined defaultFrom
      to: payload.to,
      subject: payload.subject,
      html: payload.html,
      replyTo: payload.reply_to,
      // Add other options like cc, bcc, attachments if needed later
    });

    if (error) {
      console.error('Resend API Error:', error);
      return NextResponse.json({ error: 'Failed to send email', details: error.message }, { status: 500 });
    }

    console.log('Email sent successfully via Resend:', data);
    // Return the ID of the sent email for reference
    return NextResponse.json({ message: 'Email sent successfully', id: data?.id }, { status: 200 });

  } catch (err: unknown) {
    console.error('Error processing send-email request:', err);
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: 'Failed to process email request', details: message }, { status: 500 });
  }
}