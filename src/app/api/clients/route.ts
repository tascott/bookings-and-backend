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

  let query = supabaseAdmin
    .from('clients')
    .select('id, user_id, email, profiles(first_name, last_name, phone), pets(id, name, breed, size, is_confirmed)', { count: 'exact' })
    .order('id');

  if (search) {
    // Filter by email only (joined fields not supported in .or())
    query = query.ilike('email', `%${search}%`);
  }
  if (limit > 0) {
    query = query.range(offset, offset + limit - 1);
  }

  try {
    const { data: clients, error: clientsError, count } = await query;
    if (clientsError) {
      console.error('Error fetching clients:', clientsError);
      throw clientsError;
    }
    // Flatten the joined profile fields
    const clientsWithProfile = (clients || []).map(c => {
      const profile = Array.isArray(c.profiles) ? c.profiles[0] : c.profiles;
      return {
        ...c,
        first_name: profile?.first_name ?? null,
        last_name: profile?.last_name ?? null,
        phone: profile?.phone ?? null,
        pets: c.pets || []
      };
    });
    return NextResponse.json({ clients: clientsWithProfile, total: count ?? clientsWithProfile.length });
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