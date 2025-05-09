import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import type { StaffMemberListItem } from '@booking-and-accounts-monorepo/shared-types'; // Import the shared type

// Removed local StaffMemberListItem type definition

export async function GET() {
  const supabase = await createClient()
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

  // 2. Fetch staff data with profile names, user_id, and role
  try {
    const { data: staffList, error: fetchError } = await supabaseAdmin
      .from('staff')
      .select(`
        id,
        user_id,
        role,
        profiles ( first_name, last_name )
      `)
      // .eq('role', 'staff') // Consider if we want ALL staff (admin, staff) or just 'staff' role here.
      // For a general staff list, fetching all might be better and letting frontend filter if needed.
      // For now, let's stick to the original logic of fetching only 'staff' role if that was intended for this specific dropdown.
      .eq('role', 'staff')

    if (fetchError) {
        console.error("Error fetching staff list:", fetchError);
        throw new Error(`Failed to fetch staff list: ${fetchError.message}`);
    }

    // 3. Process data into the shared StaffMemberListItem format
    const results: StaffMemberListItem[] = (staffList || []).map(staff => {
      // Handle profiles potentially being an array (common if table relationship allows it) or an object, or null
      const profilesArrayOrObject = staff.profiles as { first_name: string | null, last_name: string | null }[] | { first_name: string | null, last_name: string | null } | null;
      const profileData = Array.isArray(profilesArrayOrObject) ? profilesArrayOrObject[0] : profilesArrayOrObject;

      return {
        id: staff.id,
        user_id: staff.user_id,
        role: staff.role,
        profile: profileData ? {
          first_name: profileData.first_name ?? null,
          last_name: profileData.last_name ?? null,
        } : null,
        // default_vehicle_id is not fetched here, but it's optional in StaffMemberListItem
      }
    });

    return NextResponse.json(results);

  } catch (error: unknown) {
      console.error('Error processing staff list request:', error);
      const message = error instanceof Error ? error.message : 'An internal error occurred';
      return NextResponse.json({ error: message }, { status: 500 });
  }
}