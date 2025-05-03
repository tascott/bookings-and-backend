import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function POST() {
  const supabase = await createClient();

  // 1. Get User Session
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError || !user) {
    console.error('Mark Welcome Sent API: Auth Error', userError);
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Although the request is authenticated, we receive the target userId
  // from the client to ensure we update the correct profile,
  // especially if this were ever triggered by an admin.
  // For security, we primarily rely on the authenticated user ID.
  // const body = await request.json();
  // const targetUserId = body.userId;
  // Let's use the authenticated user's ID directly for simplicity and security.
  const targetUserId = user.id;

  console.log(`Attempting to mark welcome email sent for user: ${targetUserId}`);

  try {
    // 2. Update Profile
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ welcome_email_sent: true })
      .eq('user_id', targetUserId);

    if (updateError) {
      console.error(`Error updating welcome_email_sent for ${targetUserId}:`, updateError);
      throw new Error(updateError.message);
    }

    console.log(`Successfully marked welcome email sent for user: ${targetUserId}`);
    return NextResponse.json({ message: 'Welcome email status updated.' });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown database error';
    console.error('Error in mark-welcome-sent API:', errorMessage);
    return NextResponse.json({ error: `Failed to update profile: ${errorMessage}` }, { status: 500 });
  }
}