import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// This route handles the callback from Supabase auth actions
// like password reset or email verification.
export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const next = requestUrl.searchParams.get('next') || '/'; // Default redirect

  console.log("Auth Callback Hit. Code:", code, "Next:", next);

  // If the callback includes a code (used for email verification/magic link exchange),
  // exchange it for a session.
  if (code) {
    const supabase = await createClient();
    try {
      await supabase.auth.exchangeCodeForSession(code);
      console.log("Code exchanged for session successfully.");
    } catch (error) {
      console.error("Error exchanging code for session:", error);
      // Redirect to an error page or show an error message
      // For now, redirecting back to origin with an error indicator
      return NextResponse.redirect(`${requestUrl.origin}/login?error=auth_callback_failed`);
    }
  }

  // Password recovery flow doesn't use a 'code' in the search params.
  // It relies on the client-side picking up the token from the URL hash.
  // Therefore, for password recovery, we simply redirect to the intended page.
  // The `generateLink` function included the original target path in the link it generated,
  // which Supabase *should* append to the callback URL. However, since the fragment
  // handling seems unreliable, we will explicitly redirect to /reset-password
  // assuming this callback is primarily for that purpose when no code is present.

  // If the original link pointed to /reset-password (which we set in generateLink),
  // redirect there explicitly.
  // We might need a more robust way to determine the target if this callback handles more flows.
  if (requestUrl.pathname.includes('callback')) { // Simple check
     console.log("Redirecting from auth callback to /reset-password");
     // Ensure we preserve the hash fragment if it exists, as the client page needs it!
     const redirectUrl = new URL('/reset-password', requestUrl.origin);
     redirectUrl.hash = requestUrl.hash; // Preserve the hash!
     return NextResponse.redirect(redirectUrl.toString());
  }

  // Default redirect for other cases (e.g., if 'next' param was used)
  console.log(`Default redirecting from auth callback to: ${next}`);
  return NextResponse.redirect(`${requestUrl.origin}${next}`);
}