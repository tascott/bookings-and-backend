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
  let updateData: {
    first_name?: string | null
    last_name?: string | null
    email?: string | null
    phone?: string | null
  }

  try {
    const body = await request.json()

    // If the client is sending a name field, we need to map it to first_name
    // This ensures backward compatibility with the UI
    updateData = {
      first_name: body.name !== undefined ? body.name : undefined,
      email: body.email !== undefined ? body.email : undefined,
      phone: body.phone !== undefined ? body.phone : undefined
    }

    // Ensure at least one field is being updated
    if (Object.values(updateData).every(val => val === undefined)) {
      throw new Error('No valid fields provided for update')
    }

    console.log("Updating client with data:", updateData);
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : 'Invalid request body'
    return NextResponse.json({ error: errorMessage }, { status: 400 })
  }

  // 4. Update the client
  try {
    const { data: updatedClient, error: updateError } = await supabaseAdmin
      .from('clients')
      .update(updateData)
      .eq('id', clientId)
      .select()
      .single()

    if (updateError) {
      console.error('Error updating client:', updateError)
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    if (!updatedClient) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 })
    }

    // Return the updated client
    return NextResponse.json(updatedClient)
  } catch (error) {
    console.error('Error processing client update:', error)
    const message = error instanceof Error ? error.message : 'Failed to update client'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}