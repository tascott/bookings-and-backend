import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { getUserAuthInfo } from '@/utils/auth-helpers'

// This is a test endpoint to verify our auth utility functions are working
export async function GET() {
  const supabase = await createClient()

  // Use our auth helper to get authentication info
  const authInfo = await getUserAuthInfo(supabase);

  // If there's an error, return it
  if (authInfo.error) {
    return NextResponse.json({ error: authInfo.error }, { status: authInfo.status || 401 });
  }

  // Remove sensitive info like tokens and return the auth info
  if (authInfo.user) {
    // Remove sensitive info from user object
    const { email, id, app_metadata, aud } = authInfo.user;
    const safeUser = { email, id, aud, app_metadata };

    return NextResponse.json({
      authenticated: true,
      user: safeUser,
      isAdmin: authInfo.isAdmin,
      clientId: authInfo.clientId,
      message: 'Auth utils working correctly'
    });
  }

  // This should not happen with our current implementation, but handle just in case
  return NextResponse.json({
    authenticated: false,
    message: 'No auth error but also no user - this is unexpected'
  }, { status: 500 });
}