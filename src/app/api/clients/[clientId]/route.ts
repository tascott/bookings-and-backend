import { NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { getUserAuthInfo } from '@/utils/auth-helpers'

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
  const supabase = await createServerClient()
  const supabaseAdmin = await createAdminClient()
  const clientId = parseInt(params.clientId, 10)

  if (isNaN(clientId)) {
    return NextResponse.json({ error: 'Invalid client ID format' }, { status: 400 })
  }

  // Get user auth info from our helper
  const { isAdmin, error, status } = await getUserAuthInfo(supabase);

  // Return early if there was an auth error
  if (error) {
    return NextResponse.json({ error }, { status: status || 401 });
  }

  // Only admins can update clients
  if (!isAdmin) {
    return NextResponse.json({ error: 'Forbidden: Requires admin role' }, { status: 403 })
  }

  // 3. Parse the request body
  let incomingData: {
    first_name?: string | null
    last_name?: string | null // Accept last_name directly now
    name?: string // Keep for backward compatibility
    email?: string | null
    phone?: string | null
    default_staff_id?: number | null
  }
  let clientUpdateData: { email?: string | null; default_staff_id?: number | null } = {};
  let profileUpdateData: { first_name?: string | null; last_name?: string | null; phone?: string | null } = {};

  try {
    const body = await request.json()
    incomingData = body;

    // Separate data for clients and profiles tables
    if (incomingData.email !== undefined) {
      clientUpdateData.email = incomingData.email;
    }
    if (incomingData.default_staff_id !== undefined) {
       // Validate default_staff_id (must be number or null)
      if (incomingData.default_staff_id !== null && typeof incomingData.default_staff_id !== 'number') {
        throw new Error('Invalid default_staff_id format. Must be a number or null.');
      }
      clientUpdateData.default_staff_id = incomingData.default_staff_id;
    }

    // Handle name fields for profiles table
    if (incomingData.first_name !== undefined) {
      profileUpdateData.first_name = incomingData.first_name;
    } else if (incomingData.name !== undefined) {
      // Backward compatibility: treat 'name' as 'first_name' if first_name isn't provided
      profileUpdateData.first_name = incomingData.name;
    }
    if (incomingData.last_name !== undefined) {
        profileUpdateData.last_name = incomingData.last_name;
    }
    if (incomingData.phone !== undefined) {
      profileUpdateData.phone = incomingData.phone;
    }

    // Ensure at least one field is being updated across both tables
    if (Object.keys(clientUpdateData).length === 0 && Object.keys(profileUpdateData).length === 0) {
      throw new Error('No valid fields provided for update')
    }

  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : 'Invalid request body'
    return NextResponse.json({ error: errorMessage }, { status: 400 })
  }

  // 4. Perform Updates
  try {
    // Fetch client's user_id first, needed for profile update
    const { data: clientInfo, error: clientFetchError } = await supabaseAdmin
      .from('clients')
      .select('user_id')
      .eq('id', clientId)
      .single();

    if (clientFetchError || !clientInfo?.user_id) {
      console.error('Error fetching client user_id:', clientFetchError);
      return NextResponse.json({ error: 'Client not found or user_id missing.' }, { status: 404 });
    }
    const userId = clientInfo.user_id;

    // --- Update Profile --- (Only if there's profile data to update)
    if (Object.keys(profileUpdateData).length > 0) {
      const { error: profileUpdateError } = await supabaseAdmin
        .from('profiles')
        .update(profileUpdateData)
        .eq('user_id', userId);

      if (profileUpdateError) {
        console.error('Error updating profile:', profileUpdateError);
        // Decide if this is a critical error or if client update can proceed
        // For now, let's return an error
        return NextResponse.json({ error: `Failed to update profile data: ${profileUpdateError.message}` }, { status: 500 });
      }
    }

    // --- Update Client --- (Only if there's client data to update)
    let updatedClientData = null;
    if (Object.keys(clientUpdateData).length > 0) {
      const { data: updatedClient, error: clientUpdateError } = await supabaseAdmin
        .from('clients')
        .update(clientUpdateData)
        .eq('id', clientId)
        .select() // Select updated client data
        .single();

      if (clientUpdateError) {
        console.error('Error updating client:', clientUpdateError);
        // If profile update succeeded but client update failed, the state is inconsistent.
        // Consider rolling back or logging inconsistency.
        return NextResponse.json({ error: `Failed to update client data: ${clientUpdateError.message}` }, { status: 500 });
      }
      updatedClientData = updatedClient;
    }

    // If only profile was updated, fetch the client data again to return full object
    if (!updatedClientData) {
        const { data: finalClientData, error: finalFetchError } = await supabaseAdmin
            .from('clients')
            .select('*')
            .eq('id', clientId)
            .single();
        if (finalFetchError) {
             console.error('Error fetching final client data after profile update:', finalFetchError);
             return NextResponse.json({ message: 'Profile updated, but failed to fetch final client state.' }, { status: 200 }); // Or status 500?
        }
        updatedClientData = finalClientData;
    }

    // Fetch updated profile data to include in the response
    const { data: updatedProfileData, error: profileFetchError } = await supabaseAdmin
      .from('profiles')
      .select('first_name, last_name, phone')
      .eq('user_id', userId)
      .single();

    // Combine results for the response
    const responseData = {
        ...(updatedClientData || {}),
        // Add profile fields directly to the response object
        first_name: updatedProfileData?.first_name,
        last_name: updatedProfileData?.last_name,
        phone: updatedProfileData?.phone,
    };

    return NextResponse.json(responseData);

  } catch (error) {
    console.error('Error processing client/profile update:', error);
    const message = error instanceof Error ? error.message : 'Failed to update client/profile'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}