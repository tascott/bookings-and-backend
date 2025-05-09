import { NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { getUserAuthInfo } from '@booking-and-accounts-monorepo/utils';

// GET clients (admin: all non-staff clients with search/pagination; staff: clients assigned to them)
export async function GET(request: Request) {
  const supabase = await createServerClient()
  const supabaseAdmin = await createAdminClient()

  // --- Get user auth info and role FIRST ---
  const { user, isAdmin, isStaff, error: authError, status: authStatus } = await getUserAuthInfo(supabase);

  // Return early if there was an auth error or no user
  if (authError || !user) {
    return NextResponse.json({ error: authError || 'Authentication required' }, { status: authStatus || 401 });
  }

  // --- Read query parameters ---
  const { searchParams } = new URL(request.url);
  const assignedStaffIdParam = searchParams.get('assigned_staff_id');
  const search = searchParams.get('search')?.trim() || '';
  const limit = parseInt(searchParams.get('limit') || '0', 10);
  const offset = parseInt(searchParams.get('offset') || '0', 10);


  try {
    // --- Logic Branching based on Role and Parameter ---

    // CASE 1: Staff requesting their assigned clients
    if (assignedStaffIdParam === 'me' && isStaff) {
      // Get the staff ID associated with this user
      const { data: staffInfo, error: staffInfoError } = await supabaseAdmin
        .from('staff')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (staffInfoError || !staffInfo) {
        console.error('Error fetching staff ID for user:', user.id, staffInfoError);
        return NextResponse.json({ error: 'Failed to verify staff identity.' }, { status: 500 });
      }
      const staffId = staffInfo.id;

      // Fetch clients assigned to this staff member
      const { data: clients, error: clientsError, count } = await supabaseAdmin
        .from('clients')
        .select(`
          id,
          user_id,
          email,
          default_staff_id,
          profiles (
            first_name,
            last_name,
            phone,
            address_line_1,
            address_line_2,
            town_or_city,
            county,
            postcode,
            country,
            latitude,
            longitude
           ),
          pets ( id, name, breed, size, is_confirmed )
        `, { count: 'exact' }) // Keep count if needed for UI
        .eq('default_staff_id', staffId)
        .order('id'); // Optional ordering

      if (clientsError) {
        console.error('Error fetching assigned clients:', clientsError);
        throw clientsError;
      }

       // Flatten the profile and pets (simplified for this case)
      const clientsWithDetails = (clients || []).map(c => {
        const clientProfile = Array.isArray(c.profiles) ? c.profiles[0] : c.profiles;
        return {
          id: c.id,
          user_id: c.user_id,
          email: c.email,
          default_staff_id: c.default_staff_id,
          first_name: clientProfile?.first_name ?? null,
          last_name: clientProfile?.last_name ?? null,
          phone: clientProfile?.phone ?? null,
          address_line_1: clientProfile?.address_line_1 ?? null,
          address_line_2: clientProfile?.address_line_2 ?? null,
          town_or_city: clientProfile?.town_or_city ?? null,
          county: clientProfile?.county ?? null,
          postcode: clientProfile?.postcode ?? null,
          country: clientProfile?.country ?? null,
          latitude: clientProfile?.latitude ?? null,
          longitude: clientProfile?.longitude ?? null,
          pets: c.pets || [],
          // default_staff_name is omitted as it's implicitly the current staff user
        };
      });
      // Return only the clients and total count for the staff view
      return NextResponse.json({ clients: clientsWithDetails, total: count ?? clientsWithDetails.length });

    }
    // CASE 2: Admin requesting general client list
    else if (isAdmin) {
      // Fetch all user IDs from the staff table first (existing admin logic)
      const { data: staffUsers, error: staffFetchError } = await supabaseAdmin
        .from('staff')
        .select('user_id');

      if (staffFetchError) {
          console.error('Error fetching staff user IDs:', staffFetchError);
          throw new Error(`Failed to fetch staff data: ${staffFetchError.message}`);
      }
      const staffUserIds = staffUsers?.map(s => s.user_id).filter(id => id) || [];

      // Build the client query (existing admin logic)
      let query = supabaseAdmin
        .from('clients')
        .select(`
          id,
          user_id,
          email,
          default_staff_id,
          profiles (
            first_name,
            last_name,
            phone,
            address_line_1,
            address_line_2,
            town_or_city,
            county,
            postcode,
            country,
            latitude,
            longitude
          ),
          pets ( id, name, breed, size, is_confirmed ),
          staff ( profiles ( first_name, last_name ) )
        `, { count: 'exact' })
        .order('id');

      // Filter out users who are also in the staff table
      if (staffUserIds.length > 0) {
        query = query.not('user_id', 'in', `(${staffUserIds.join(',')})`);
      }

      // Apply search and pagination (existing admin logic)
      if (search) {
        query = query.ilike('email', `%${search}%`); // Keep existing simple search
      }
      if (limit > 0) {
        query = query.range(offset, offset + limit - 1);
      }

      const { data: clients, error: clientsError, count } = await query;
      if (clientsError) {
        console.error('Error fetching clients (admin):', clientsError);
        throw clientsError;
      }

      // Flatten the joined profile and staff profile fields (existing admin logic)
      const clientsWithDetails = (clients || []).map(c => {
        const clientProfile = Array.isArray(c.profiles) ? c.profiles[0] : c.profiles;

        // Safely extract nested staff profile (existing admin logic)
        type StaffProfile = { first_name: string | null, last_name: string | null };
        type StaffWithProfile = { profiles: StaffProfile | StaffProfile[] | null };
        let staffProfile: StaffProfile | null = null;
        if (c.staff) {
            const staffData = c.staff as StaffWithProfile | StaffWithProfile[];
            const singleStaff = Array.isArray(staffData) ? staffData[0] : staffData;
            if (singleStaff?.profiles) {
                const profilesData = singleStaff.profiles;
                staffProfile = Array.isArray(profilesData) ? profilesData[0] : profilesData;
            }
        }
        const defaultStaffName = staffProfile ? `${staffProfile.first_name || ''} ${staffProfile.last_name || ''}`.trim() : null;

        return {
          id: c.id,
          user_id: c.user_id,
          email: c.email,
          default_staff_id: c.default_staff_id,
          first_name: clientProfile?.first_name ?? null,
          last_name: clientProfile?.last_name ?? null,
          phone: clientProfile?.phone ?? null,
          address_line_1: clientProfile?.address_line_1 ?? null,
          address_line_2: clientProfile?.address_line_2 ?? null,
          town_or_city: clientProfile?.town_or_city ?? null,
          county: clientProfile?.county ?? null,
          postcode: clientProfile?.postcode ?? null,
          country: clientProfile?.country ?? null,
          latitude: clientProfile?.latitude ?? null,
          longitude: clientProfile?.longitude ?? null,
          pets: c.pets || [],
          default_staff_name: defaultStaffName || null
        };
      });
      // Return clients, total count for admin view
      return NextResponse.json({ clients: clientsWithDetails, total: count ?? clientsWithDetails.length });

    }
    // CASE 3: Non-admin attempting to access without the 'me' param, or other forbidden cases
    else {
      return NextResponse.json({ error: 'Forbidden: Access denied' }, { status: 403 });
    }

  } catch (error) {
    console.error('API Error in GET /api/clients:', error);
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