import { NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { getUserAuthInfo } from '@/utils/auth-helpers'

// GET all clients (admin only)
export async function GET(request: Request) {
  const supabase = await createServerClient()
  const supabaseAdmin = await createAdminClient()

  // Get user auth info from our helper
  const { isAdmin, error, status } = await getUserAuthInfo(supabase);

  // Return early if there was an auth error
  if (error) {
    return NextResponse.json({ error }, { status: status || 401 });
  }

  // Only admins can list all clients
  if (!isAdmin) {
    return NextResponse.json({ error: 'Forbidden: Requires admin role' }, { status: 403 });
  }

  // --- Minimal search & pagination ---
  const { searchParams } = new URL(request.url);
  const search = searchParams.get('search')?.trim() || '';
  const limit = parseInt(searchParams.get('limit') || '0', 10);
  const offset = parseInt(searchParams.get('offset') || '0', 10);

  try {
    // Fetch all user IDs from the staff table first
    const { data: staffUsers, error: staffFetchError } = await supabaseAdmin
      .from('staff')
      .select('user_id');

    if (staffFetchError) {
        console.error('Error fetching staff user IDs:', staffFetchError);
        throw new Error(`Failed to fetch staff data: ${staffFetchError.message}`);
    }
    const staffUserIds = staffUsers?.map(s => s.user_id).filter(id => id) || []; // Filter out nulls just in case

    // Now build the client query
    let query = supabaseAdmin
      .from('clients')
      .select(`
        id,
        user_id,
        email,
        default_staff_id,
        profiles ( first_name, last_name, phone ),
        pets ( id, name, breed, size, is_confirmed ),
        staff ( profiles ( first_name, last_name ) )
      `, { count: 'exact' })
      .order('id');

    // <<< Filter out users who are also in the staff table >>>
    if (staffUserIds.length > 0) {
      query = query.not('user_id', 'in', `(${staffUserIds.join(',')})`);
    }

    if (search) {
      // Filter by email only (joined fields not supported in .or())
      // Note: This search might still include staff if their email matches, before the user_id filter is applied by the DB.
      // Consider searching profiles.first_name, profiles.last_name if possible and needed.
      query = query.ilike('email', `%${search}%`);
    }
    if (limit > 0) {
      query = query.range(offset, offset + limit - 1);
    }

    const { data: clients, error: clientsError, count } = await query;
    if (clientsError) {
      console.error('Error fetching clients:', clientsError);
      throw clientsError;
    }
    // Flatten the joined profile and staff profile fields
    const clientsWithDetails = (clients || []).map(c => {
      const clientProfile = Array.isArray(c.profiles) ? c.profiles[0] : c.profiles;

      // --- Safely extract nested staff profile ---
      type StaffProfile = { first_name: string | null, last_name: string | null };
      type StaffWithProfile = { profiles: StaffProfile | StaffProfile[] | null };

      let staffProfile: StaffProfile | null = null;
      // Check if c.staff exists and is not null
      if (c.staff) {
          // Type assertion for staff (could be object or array)
          const staffData = c.staff as StaffWithProfile | StaffWithProfile[];
          // Get the first staff member if it's an array
          const singleStaff = Array.isArray(staffData) ? staffData[0] : staffData;

          // Check if staff member and their profiles exist
          if (singleStaff?.profiles) {
              // Type assertion for profiles (could be object or array)
              const profilesData = singleStaff.profiles;
              // Get the first profile if it's an array
              staffProfile = Array.isArray(profilesData) ? profilesData[0] : profilesData;
          }
      }
      // --- End safe extraction ---

      const defaultStaffName = staffProfile ? `${staffProfile.first_name || ''} ${staffProfile.last_name || ''}`.trim() : null;

      return {
        // Omit the nested staff/profiles objects from the final client object if desired
        id: c.id,
        user_id: c.user_id,
        email: c.email,
        default_staff_id: c.default_staff_id,
        // Include flattened client profile fields
        first_name: clientProfile?.first_name ?? null,
        last_name: clientProfile?.last_name ?? null,
        phone: clientProfile?.phone ?? null,
        // Include pets
        pets: c.pets || [],
        // Include the derived staff name
        default_staff_name: defaultStaffName || null
      };
    });
    return NextResponse.json({ clients: clientsWithDetails, total: count ?? clientsWithDetails.length });
  } catch (error) {
    console.error('Error fetching clients:', error);
    const message = error instanceof Error ? error.message : 'Failed to fetch clients';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST a new client
export async function POST(request: Request) {
  const supabase = await createServerClient()
  const supabaseAdmin = await createAdminClient()

  // Get user auth info from our helper
  const { isAdmin, error, status } = await getUserAuthInfo(supabase);

  // Return early if there was an auth error
  if (error) {
    return NextResponse.json({ error }, { status: status || 401 });
  }

  // This endpoint is admin-only
  if (!isAdmin) {
    return NextResponse.json({ error: 'Forbidden: Requires admin role' }, { status: 403 })
  }

  // Parse request body
  let clientData: { email: string; address?: string; user_id?: string };
  try {
    const body = await request.json();
    if (!body.email || typeof body.email !== 'string' || body.email.trim() === '') {
      throw new Error('Missing or invalid required field: email');
    }
    clientData = {
      email: body.email.trim(),
      address: typeof body.address === 'string' ? body.address.trim() : undefined,
      user_id: typeof body.user_id === 'string' ? body.user_id : undefined,
    };
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : 'Invalid request body';
    return NextResponse.json({ error: errorMessage }, { status: 400 })
  }

  // Insert the new client
  try {
    const { data: newClient, error: insertError } = await supabaseAdmin
      .from('clients')
      .insert(clientData)
      .select()
      .single();

    if (insertError) {
      console.error('Error inserting client:', insertError)
      // Handle potential errors like duplicate email
      if (insertError.code === '23505') { // Unique constraint violation
        return NextResponse.json({ error: `A client with this email already exists.` }, { status: 400 });
      }
      throw insertError;
    }

    if (!newClient) {
      throw new Error('Client created but failed to retrieve data.');
    }

    return NextResponse.json(newClient, { status: 201 })

  } catch (error: unknown) {
    console.error('Error creating client:', error);
    const message = error instanceof Error ? error.message : 'Failed to create client';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}