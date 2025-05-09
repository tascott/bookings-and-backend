// Remove unused imports
// import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
// import { cookies } from 'next/headers';
import { NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { getUserAuthInfo } from '@booking-and-accounts-monorepo/utils'
import { Database } from '@booking-and-accounts-monorepo/shared-types/types_db';

// GET a specific client by ID
export async function GET(
  request: Request,
  { params }: { params: { clientId: string } }
) {
  const supabase = await createServerClient()
  const supabaseAdmin = await createAdminClient()
  const clientId = parseInt(params.clientId, 10)

  if (isNaN(clientId)) {
    return NextResponse.json({ error: 'Invalid client ID format' }, { status: 400 })
  }

  // Get user auth info from our helper
  const { clientId: userClientId, isAdmin, error, status } = await getUserAuthInfo(supabase);

  // Return early if there was an auth error
  if (error) {
    return NextResponse.json({ error }, { status: status || 401 });
  }

  // If not admin, check if the user is requesting their own client data
  if (!isAdmin) {
    // Check if client ID was found
    if (!userClientId) {
      return NextResponse.json({ error: 'Client profile not found for this user' }, { status: 404 })
    }

    // If user is not requesting their own data, forbid access
    if (userClientId !== clientId) {
      return NextResponse.json({ error: 'Forbidden: Cannot access other client profiles' }, { status: 403 })
    }
  }

  // 3. Fetch the client and their pets
  try {
    // First get the client data
    const { data: client, error: clientError } = await supabaseAdmin
      .from('clients')
      .select('*')
      .eq('id', clientId)
      .single()

    if (clientError) {
      if (clientError.code === 'PGRST116') { // Not found
        return NextResponse.json({ error: 'Client not found' }, { status: 404 })
      }
      throw clientError
    }

    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 })
    }

    // Then fetch the pets for this client
    const { data: pets, error: petsError } = await supabaseAdmin
      .from('pets')
      .select('*')
      .eq('client_id', clientId)
      .order('name')

    if (petsError) {
      throw petsError
    }

    // Return client with their pets
    return NextResponse.json({
      ...client,
      pets: pets || []
    })

  } catch (error) {
    console.error('Error fetching client data:', error)
    const message = error instanceof Error ? error.message : 'Failed to fetch client data'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// PUT (Update) a specific client
export async function PUT(
  request: Request,
  { params }: { params: { clientId: string } }
) {
  // Use server/admin clients instead of route handler client
  const supabaseServer = await createServerClient();
  const supabaseAdmin = await createAdminClient();
  const clientId = Number(params.clientId);

  // Check user authentication using server client
  const { data: { session }, error: sessionError } = await supabaseServer.auth.getSession();
  if (sessionError) {
    console.error("Session Error in PUT:", sessionError);
    return NextResponse.json({ error: 'Failed to retrieve session' }, { status: 500 });
  }
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!session.user?.id) {
    console.error('Authorization Error: Session exists but user ID is missing.');
    return NextResponse.json({ error: 'Internal authorization error' }, { status: 500 });
  }
  const userId = session.user.id;

  // Check if the user is admin using admin client
  // (Keep the stricter admin check for updates for now)
  const { data: adminData, error: adminError } = await supabaseAdmin
    .from('staff')
    .select('role')
    .eq('user_id', userId)
    .eq('role', 'admin')
    .maybeSingle();

  if (adminError || !adminData) {
    console.error('Authorization Error (Admin Check): ', adminError);
    return NextResponse.json({ error: 'Forbidden: Only admins can update client details.' }, { status: 403 });
  }

  if (isNaN(clientId)) {
    return NextResponse.json({ error: 'Invalid client ID' }, { status: 400 });
  }

  try {
    const body = await request.json();

    // Separate data for clients and profiles tables
    const clientUpdateData: Partial<Database['public']['Tables']['clients']['Update']> = {}
    const profileUpdateData: Partial<Database['public']['Tables']['profiles']['Update']> = {}

    // Existing fields for 'clients' table
    if (body.hasOwnProperty('email')) clientUpdateData.email = body.email
    if (body.hasOwnProperty('default_staff_id')) clientUpdateData.default_staff_id = body.default_staff_id

    // Existing fields for 'profiles' table
    if (body.hasOwnProperty('first_name')) profileUpdateData.first_name = body.first_name
    if (body.hasOwnProperty('last_name')) profileUpdateData.last_name = body.last_name
    if (body.hasOwnProperty('phone')) profileUpdateData.phone = body.phone

    // New address fields for 'profiles' table
    if (body.hasOwnProperty('address_line_1')) profileUpdateData.address_line_1 = body.address_line_1
    if (body.hasOwnProperty('address_line_2')) profileUpdateData.address_line_2 = body.address_line_2
    if (body.hasOwnProperty('town_or_city')) profileUpdateData.town_or_city = body.town_or_city
    if (body.hasOwnProperty('county')) profileUpdateData.county = body.county
    if (body.hasOwnProperty('postcode')) profileUpdateData.postcode = body.postcode
    if (body.hasOwnProperty('country')) profileUpdateData.country = body.country
    if (body.hasOwnProperty('latitude')) profileUpdateData.latitude = body.latitude
    if (body.hasOwnProperty('longitude')) profileUpdateData.longitude = body.longitude

    // Use supabaseAdmin for database operations
    // 1. Get the user_id associated with the client ID
    const { data: clientInfo, error: clientInfoError } = await supabaseAdmin
      .from('clients')
      .select('user_id')
      .eq('id', clientId)
      .maybeSingle()

    if (clientInfoError) throw clientInfoError
    if (!clientInfo || !clientInfo.user_id) {
      return NextResponse.json({ error: 'Client not found or user link missing' }, { status: 404 })
    }

    const targetUserId = clientInfo.user_id

    // 2. Update the 'clients' table if necessary
    if (Object.keys(clientUpdateData).length > 0) {
      const { error: clientUpdateError } = await supabaseAdmin
        .from('clients')
        .update(clientUpdateData)
        .eq('id', clientId)

      if (clientUpdateError) throw clientUpdateError
    }

    // 3. Update the 'profiles' table using the user_id
    if (Object.keys(profileUpdateData).length > 0) {
      const { error: profileUpdateError } = await supabaseAdmin
        .from('profiles')
        .update(profileUpdateData)
        .eq('user_id', targetUserId)

      if (profileUpdateError) throw profileUpdateError
    }

    // 4. Fetch the combined updated client/profile data to return
    // (Similar logic to GET /api/clients, joining profiles and clients)
    const { data: updatedClientData, error: fetchError } = await supabaseAdmin
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
        )
      `)
      .eq('id', clientId)
      .maybeSingle()

    if (fetchError) throw fetchError
    if (!updatedClientData) {
      return NextResponse.json({ error: 'Failed to retrieve updated client data' }, { status: 404 })
    }

    // Flatten the profile data into the client object for the response
    // Safely access the first profile object
    const profile = Array.isArray(updatedClientData.profiles) ? updatedClientData.profiles[0] : updatedClientData.profiles;
    const responseData = {
      ...updatedClientData,
      first_name: profile?.first_name,
      last_name: profile?.last_name,
      phone: profile?.phone,
      address_line_1: profile?.address_line_1,
      address_line_2: profile?.address_line_2,
      town_or_city: profile?.town_or_city,
      county: profile?.county,
      postcode: profile?.postcode,
      country: profile?.country,
      latitude: profile?.latitude,
      longitude: profile?.longitude,
      profiles: undefined, // Remove the nested profiles object
    }

    return NextResponse.json(responseData)

  } catch (error) {
    console.error('Client Update Error:', error)
    const message = error instanceof Error ? error.message : 'An unexpected error occurred'
    return NextResponse.json({ error: `Failed to update client: ${message}` }, { status: 500 })
  }
}