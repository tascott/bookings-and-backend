import { NextResponse } from 'next/server';
import { render } from '@react-email/render';
import { sendEmail } from '@/utils/sendEmail';
import WelcomeEmail from '@/emails/WelcomeEmail';
import React from 'react';
// Use admin client to fetch profile safely if needed, or rely on data passed from client
// import { createAdminClient } from '@/utils/supabase/admin';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, firstName } = body;

    if (!email) {
      return NextResponse.json({ error: 'Email is required.' }, { status: 400 });
    }

    // Get site URL from environment variable
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
    if (!siteUrl) {
      console.error('Welcome Email API: NEXT_PUBLIC_SITE_URL not set.');
      // Don't fail the request, just send email without the site link
    }

    console.log(`Sending welcome email to: ${email}`);

    // Use React.createElement for rendering in .ts file
    const emailElement = React.createElement(WelcomeEmail, {
      userName: firstName || 'there',
      siteUrl: siteUrl
    });
    // Await the render function as it returns a Promise
    const emailHtml = await render(emailElement);

    await sendEmail({
      to: email,
      subject: "Welcome to Bonnie's Dog Daycare!",
      html: emailHtml,
    });

    console.log(`Welcome email successfully sent to ${email}.`);
    return NextResponse.json({ message: 'Welcome email sent successfully.' });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error sending welcome email:', errorMessage);
    return NextResponse.json({ error: `Failed to send welcome email: ${errorMessage}` }, { status: 500 });
  }
}