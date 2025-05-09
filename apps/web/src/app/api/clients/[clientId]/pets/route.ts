import { NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { getUserAuthInfo } from '@booking-and-accounts-monorepo/utils'

// POST a new pet for a specific client
export async function POST(
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

  // Only admins can add pets to any client
  if (!isAdmin) {
    return NextResponse.json({ error: 'Forbidden: Requires admin role' }, { status: 403 })
  }

  // Verify the client exists
  const { error: clientError } = await supabaseAdmin
    .from('clients')
    .select('id')
    .eq('id', clientId)
    .single();

  if (clientError) {
    if (clientError.code === 'PGRST116') { // Not found
      return NextResponse.json({ error: 'Client not found' }, { status: 404 })
    }
    console.error('Error fetching client:', clientError);
    return NextResponse.json({ error: clientError.message }, { status: 500 })
  }

  // Parse request body
  let petData: { name: string; breed?: string; size?: string; is_confirmed?: boolean };
  try {
    const body = await request.json();
    if (!body.name || typeof body.name !== 'string' || body.name.trim() === '') {
      throw new Error('Missing or invalid required field: name');
    }
    petData = {
      name: body.name.trim(),
      breed: typeof body.breed === 'string' ? body.breed.trim() : undefined,
      size: typeof body.size === 'string' ? body.size.trim() : undefined,
      is_confirmed: false, // Set default value to false for new pets
    };
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : 'Invalid request body';
    return NextResponse.json({ error: errorMessage }, { status: 400 })
  }

  // Insert the new pet
  try {
    const { data: newPet, error: insertError } = await supabaseAdmin
      .from('pets')
      .insert({
        ...petData,
        client_id: clientId
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error inserting pet:', insertError)
      throw insertError;
    }

    if (!newPet) {
      throw new Error('Pet created but failed to retrieve data.');
    }

    return NextResponse.json(newPet, { status: 201 })

  } catch (error: unknown) {
    console.error('Error creating pet:', error);
    const message = error instanceof Error ? error.message : 'Failed to create pet';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(request: Request, context: { params: { clientId: string } }) {
    const supabase = await createServerClient();
    const supabaseAdmin = await createAdminClient();

    // 1. Check Auth & Role (Admin/Staff)
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    const { data: staffData, error: staffError } = await supabase
        .from('staff')
        .select('role')
        .eq('user_id', user.id)
        .single();

    if (staffError || !staffData || !['admin', 'staff'].includes(staffData.role || '')) {
        return NextResponse.json({ error: 'Forbidden: Requires admin or staff role' }, { status: 403 });
    }

    // 2. Get Client ID from route params
    const clientIdStr = context.params.clientId; // Access directly from context
    const clientId = parseInt(clientIdStr, 10);
    if (isNaN(clientId)) {
        return NextResponse.json({ error: 'Invalid Client ID format' }, { status: 400 });
    }

    // 3. Query Client's Pets
    try {
        const { data: pets, error: queryError } = await supabaseAdmin
            .from('pets')
            .select('id, client_id, name, breed, size, is_active, is_confirmed') // Select all Pet fields
            .eq('client_id', clientId)
            .order('name'); // Order alphabetically

        if (queryError) {
            console.error("Client pets query error:", queryError);
            throw new Error('Database error fetching client pets.');
        }

        return NextResponse.json(pets || []); // Return empty array if no pets

    } catch (e) {
        const message = e instanceof Error ? e.message : 'An unexpected error occurred fetching pets.';
        console.error('Fetch Client Pets Error:', e);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}