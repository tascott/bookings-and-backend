import { NextResponse } from 'next/server';
// import { createClient } from '@/utils/supabase/server'; // Removed unused import
import { createAdminClient } from '@/utils/supabase/admin'; // Use admin for profile fetch and generateLink
import { render } from '@react-email/render';
import { sendEmail } from '@/utils/sendEmail';
import PasswordReset from '@/emails/PasswordReset';

export async function POST(request: Request) {
  // Await client creation
  // const supabase = await createClient(); // Removed unused client
  const supabaseAdmin = await createAdminClient();

  let email: string;
  try {
    const body = await request.json();
    email = body.email;
    if (!email) {
      throw new Error('Email is required.');
    }
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : 'Invalid request body';
    return NextResponse.json({ error: errorMessage }, { status: 400 });
  }

  // --- Get site URL from environment variables ---
  // Ensure NEXT_PUBLIC_SITE_URL is set in your .env.local or environment
  // It should point to your deployment URL (e.g., http://localhost:3000 or https://yourdomain.com)
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (!siteUrl) {
    console.error('NEXT_PUBLIC_SITE_URL environment variable is not set.');
    return NextResponse.json({ error: 'Server configuration error.' }, { status: 500 });
  }
  // --- Update redirectTo to use the new callback route ---
  const callbackPath = '/api/auth/callback'; // New callback path
  const redirectTo = `${siteUrl}${callbackPath}`;

  console.log(`Requesting password reset for ${email}, using callback redirect: ${redirectTo}`);

  // --- Use generateLink via Admin client to get the link server-side ---
  // Note: Ensure the user email exists before calling this or handle potential errors.
  const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
    type: 'recovery', // Specify recovery link type
    email: email,
    options: {
      redirectTo: redirectTo,
    }
  });

  if (linkError) {
    console.error('Supabase generateLink error:', linkError);
    // Still return generic message for security
    return NextResponse.json({ message: 'If an account exists for this email, a password reset link has been sent.' });
  }

  // Extract the full action link from the properties
  const resetLink = linkData?.properties?.action_link;

  if (!resetLink) {
    console.error('Failed to generate password reset link (action_link missing).');
    // Still return generic message
    return NextResponse.json({ message: 'If an account exists for this email, a password reset link has been sent.' });
  }

  console.log(`Generated password reset link: ${resetLink}`); // Log link for debugging (consider removing in prod)

  // --- Send Custom Email via Resend ---
  try {
    // Fetch user's first name for personalization (best effort)
    // --- Removed profile fetch by email as 'profiles.email' column doesn't exist ---
    // let userName = 'there';
    // const { data: profile, error: profileError } = await supabaseAdmin
    //   .from('profiles')
    //   .select('first_name')
    //   .eq('email', email) // Match profile by email - This caused the error
    //   .single();

    // if (profileError) {
    //   console.warn(`Could not fetch profile for ${email} during password reset: ${profileError.message}`);
    //   // Proceed without name if fetch fails
    // } else if (profile?.first_name) {
    //   userName = profile.first_name;
    // }
    // --- End of removed section ---

    // Use a generic greeting
    const userName = 'there';

    // Await the render call, passing the generated link
    const emailHtml = await render(
      <PasswordReset
        userName={userName}
        resetLink={resetLink} // Pass the full link
      />
    );

    await sendEmail({
      to: email,
      subject: "Password Reset Request for Bonnie's Dog Daycare", // Ensure quotes are consistent
      html: emailHtml,
    });

    console.log(`Custom password reset email instruction sent to ${email} via Resend.`);

  } catch (emailError) {
    console.error('Error sending custom password reset email:', emailError);
    // Log the error, but still return the generic success message to the user.
  }

  // Always return the same message regardless of whether the email exists or sending succeeded
  return NextResponse.json({ message: 'If an account exists for this email, a password reset link has been sent.' });
}