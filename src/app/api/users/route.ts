import { NextResponse } from 'next/server'
// Use the server client utility for checking auth
import { createClient as createServerClient } from '@/utils/supabase/server' // Alias import
// Import admin client CREATOR function from the new location
import { createAdminClient } from '@/utils/supabase/admin'
// Import User type for explicit typing
import type { User } from '@supabase/supabase-js'

// Define types for database results for clarity
type StaffRole = {
  user_id: string;
  role: string | null;
}

type ClientRecord = {
  user_id: string;
}

export async function GET() {
  // Await server client creation
  const supabase = await createServerClient()

  // 1. Check if the current user is authenticated
  const { data: { user }, error: userError } = await supabase.auth.getUser()

  if (userError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  // 2. Check if the current user is an admin (using the same server client)
  const { data: staffData, error: staffError } = await supabase
    .from('staff')
    .select('role')
    .eq('user_id', user.id)
    .single()

  if (staffError || !staffData || staffData.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden: Requires admin role' }, { status: 403 })
  }

  // Await admin client creation
  const supabaseAdmin = await createAdminClient()

  // 3. Fetch all users from auth.users using the ADMIN client (requires service_role)
  const { data: authUsers, error: usersError } = await supabaseAdmin.auth.admin.listUsers()

  if (usersError) {
    console.error('Error fetching users:', usersError)
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 })
  }

  // 4. Fetch associated staff and client records using the ADMIN client
  // Explicitly type the parameter 'u'
  const userIds = authUsers.users.map((u: User) => u.id)
  // Type the expected data shape for staffRoles
  const { data: staffRoles, error: staffRolesError } = await supabaseAdmin
    .from('staff')
    .select('user_id, role')
    .in('user_id', userIds)
    .returns<StaffRole[]>() // Specify return type

  // Type the expected data shape for clientRecords
  const { data: clientRecords, error: clientRecordsError } = await supabaseAdmin
    .from('clients')
    .select('user_id')
    .in('user_id', userIds)
    .returns<ClientRecord[]>() // Specify return type

  if (staffRolesError || clientRecordsError) {
    console.error('Error fetching role data:', staffRolesError, clientRecordsError)
    // Proceeding with potentially incomplete role data, but log the error
  }

  // 5. Combine auth user data with role information
  // Explicitly type parameters 'user', 's', and 'c'
  const usersWithRoles = authUsers.users.map((user: User) => {
    const staffInfo = staffRoles?.find((s: StaffRole) => s.user_id === user.id)
    const clientInfo = clientRecords?.find((c: ClientRecord) => c.user_id === user.id)
    let role = 'unknown' // Default if not in staff or clients

    if (staffInfo) {
      role = staffInfo.role || 'staff' // Use specific role or default to 'staff'
    } else if (clientInfo) {
      role = 'client'
    }

    return {
      id: user.id,
      email: user.email,
      role: role,
      created_at: user.created_at,
      last_sign_in_at: user.last_sign_in_at
    }
  })

  return NextResponse.json(usersWithRoles)
}

// POST Handler for Role Assignment
export async function POST(request: Request) {
  // 1. Create clients (server for auth check, admin for modification)
  const supabase = await createServerClient()
  const supabaseAdminClient = await createAdminClient()

  // 2. Check requester authentication
  const { data: { user: requester }, error: requesterError } = await supabase.auth.getUser()
  if (requesterError || !requester) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  // 3. Check requester authorization (must be admin)
  const { data: staffData, error: staffError } = await supabase
    .from('staff')
    .select('role')
    .eq('user_id', requester.id)
    .single()

  if (staffError || !staffData || staffData.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden: Requires admin role' }, { status: 403 })
  }

  // 4. Parse request body
  let userIdToModify: string;
  let targetRole: string;
  try {
    const body = await request.json();
    userIdToModify = body.userId;
    targetRole = body.targetRole;
    if (!userIdToModify || !targetRole || !['client', 'staff', 'admin'].includes(targetRole)) {
       throw new Error('Invalid input: userId and targetRole (client, staff, admin) are required.')
    }
     if (userIdToModify === requester.id) {
       throw new Error('Admins cannot change their own role via this endpoint.');
    }
  } catch (e) {
     const errorMessage = e instanceof Error ? e.message : 'An unknown error occurred.';
    return NextResponse.json({ error: errorMessage }, { status: 400 })
  }

  // 5. Perform Role Update Logic
  try {
    if (targetRole === 'client') {
      // Ensure user is removed from staff
      const { error: deleteStaffError } = await supabaseAdminClient
        .from('staff')
        .delete()
        .eq('user_id', userIdToModify);
      if (deleteStaffError) throw deleteStaffError;

      // Ensure user exists in clients (Upsert: insert if not exists, do nothing if exists)
      // Fetch email from auth.users to populate client record if inserting
       const { data: { user: targetUser }, error: getUserError } = await supabaseAdminClient.auth.admin.getUserById(userIdToModify);
       if (getUserError) throw new Error(`Failed to get user details for profile creation: ${getUserError.message}`);

      const { error: upsertClientError } = await supabaseAdminClient
        .from('clients')
        .upsert({ user_id: userIdToModify, email: targetUser?.email }, { onConflict: 'user_id' });
      if (upsertClientError) throw upsertClientError;

    } else if (targetRole === 'staff' || targetRole === 'admin') {
      // Ensure user is removed from clients
      const { error: deleteClientError } = await supabaseAdminClient
        .from('clients')
        .delete()
        .eq('user_id', userIdToModify);
      // Ignore error if user wasn't in clients (e.g., error code PGRST116 for no rows)
      if (deleteClientError && deleteClientError.code !== 'PGRST116') throw deleteClientError;

      // Ensure user exists in staff (Upsert: insert if not exists, update role if exists)
       const { data: { user: targetUser }, error: getUserError } = await supabaseAdminClient.auth.admin.getUserById(userIdToModify);
       if (getUserError) throw new Error(`Failed to get user details for profile creation: ${getUserError.message}`);

      const { error: upsertStaffError } = await supabaseAdminClient
        .from('staff')
        .upsert({ user_id: userIdToModify, role: targetRole, name: targetUser?.user_metadata?.full_name || targetUser?.email }, { onConflict: 'user_id' }); // Populate name if available
      if (upsertStaffError) throw upsertStaffError;
    }

    return NextResponse.json({ success: true, message: `User ${userIdToModify} assigned role ${targetRole}` });

  } catch (error) {
    console.error('Role assignment error:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

// Placeholder for POST/PUT methods to update roles - to be added later