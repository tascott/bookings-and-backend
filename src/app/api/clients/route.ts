import { NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { getUserAuthInfo } from '@/utils/auth-helpers'

// GET all clients with their pets
export async function GET() {
  const supabase = await createServerClient()

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

  // Use admin client to fetch all clients and their pets
  const supabaseAdmin = await createAdminClient()

  // First fetch all clients
  const { data: clients, error: clientsError } = await supabaseAdmin
    .from('clients')
    .select('*')
    .order('id')

  if (clientsError) {
    console.error('Error fetching clients:', clientsError)
    return NextResponse.json({ error: clientsError.message }, { status: 500 })
  }

  // Then fetch all pets and group them by client_id
  const { data: pets, error: petsError } = await supabaseAdmin
    .from('pets')
    .select('*')
    .order('name')

  if (petsError) {
    console.error('Error fetching pets:', petsError)
    return NextResponse.json({ error: petsError.message }, { status: 500 })
  }

  // Group pets by client_id
  const petsByClient = new Map()
  for (const pet of pets || []) {
    if (!petsByClient.has(pet.client_id)) {
      petsByClient.set(pet.client_id, [])
    }
    petsByClient.get(pet.client_id).push(pet)
  }

  // Add pets to each client
  const clientsWithPets = clients?.map(client => ({
    ...client,
    pets: petsByClient.get(client.id) || []
  })) || []

  return NextResponse.json(clientsWithPets)
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
  let clientData: { first_name?: string; last_name?: string; email: string; phone?: string; address?: string; user_id?: string };
  try {
    const body = await request.json();
    if (!body.email || typeof body.email !== 'string' || body.email.trim() === '') {
      throw new Error('Missing or invalid required field: email');
    }
    clientData = {
      email: body.email.trim(),
      first_name: typeof body.first_name === 'string' ? body.first_name.trim() : undefined,
      last_name: typeof body.last_name === 'string' ? body.last_name.trim() : undefined,
      phone: typeof body.phone === 'string' ? body.phone.trim() : undefined,
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