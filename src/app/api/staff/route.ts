import { NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'

// Define the expected structure for the response items
type StaffMemberListItem = {
  id: number;
  first_name: string | null;
  last_name: string | null;
}

export async function GET() {
  const supabase = await createServerClient()
  const supabaseAdmin = await createAdminClient()

  // 1. Check auth & role (Admin/Staff)
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { data: requesterStaffData, error: staffError } = await supabase
    .from('staff')
    .select('role')
    .eq('user_id', user.id)
    .single()

  if (staffError || !requesterStaffData || !['admin', 'staff'].includes(requesterStaffData.role || '')) {
    // Allow staff to see other staff members for assignment purposes
    return NextResponse.json({ error: 'Forbidden: Requires admin or staff role' }, { status: 403 })
  }

  // 2. Fetch staff data with profile names
  try {
    const { data: staffList, error: fetchError } = await supabaseAdmin
      .from('staff')
      .select(`
        id,
        profiles ( first_name, last_name )
      `)
      .eq('role', 'staff')

    if (fetchError) {
        console.error("Error fetching staff list:", fetchError);
        throw new Error(`Failed to fetch staff list: ${fetchError.message}`);
    }

    // 3. Process data into the desired format
    const results: StaffMemberListItem[] = (staffList || []).map(staff => {
      // Handle profiles potentially being an array or null
      const profilesData = staff.profiles as { first_name: string | null, last_name: string | null }[] | { first_name: string | null, last_name: string | null } | null;
      const profile = Array.isArray(profilesData) ? profilesData[0] : profilesData;

      return {
        id: staff.id,
        first_name: profile?.first_name ?? null,
        last_name: profile?.last_name ?? null,
      }
    });

    return NextResponse.json(results);

  } catch (error: unknown) {
      console.error('Error processing staff list request:', error);
      const message = error instanceof Error ? error.message : 'An internal error occurred';
      return NextResponse.json({ error: message }, { status: 500 });
  }
}