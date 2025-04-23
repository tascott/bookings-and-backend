import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin' // Use admin for inserts/updates if needed

// GET user's pets
export async function GET() {
    const supabase = await createClient()

    // 1. Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    // 2. Get client_id associated with the user by fetching from clients table
    let clientId: number;
    try {
        const { data: clientData, error: clientError } = await supabase
            .from('clients')
            .select('id')
            .eq('user_id', user.id) // Match the user_id column in clients
            .single();

        if (clientError) {
            console.error('Error fetching client profile for user:', user.id, clientError);
            if (clientError.code === 'PGRST116') { // Not found
                 return NextResponse.json({ error: 'Client profile not found for this user.' }, { status: 404 });
            }
            throw clientError; // Rethrow other errors
        }
        if (!clientData) {
            return NextResponse.json({ error: 'Client profile not found for this user.' }, { status: 404 });
        }
        clientId = clientData.id;
    } catch (error) {
         console.error('Error during client ID fetch:', error);
         const message = error instanceof Error ? error.message : 'Failed to retrieve client profile';
         return NextResponse.json({ error: message }, { status: 500 });
    }

    // 3. Fetch pets for the client
    try {
        // RLS on 'pets' should allow select based on client_id matching authenticated user's client record
        const { data: pets, error: petsError } = await supabase
            .from('pets')
            .select('*')
            .eq('client_id', clientId) // Filter by client_id
            .order('name'); // Optional ordering

        if (petsError) {
            throw petsError;
        }

        return NextResponse.json(pets || []);

    } catch (error: unknown) {
        console.error('Error fetching pets:', error);
        const message = error instanceof Error ? error.message : 'Failed to fetch pets';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

// POST a new pet for the user
export async function POST(request: Request) {
    const supabase = await createClient()
    const supabaseAdmin = await createAdminClient() // Use admin client for insert to bypass RLS if needed

    // 1. Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    // 2. Get client_id (same logic as GET, fetch from clients table)
    let clientId: number;
    try {
        const { data: clientData, error: clientError } = await supabase
            .from('clients')
            .select('id')
            .eq('user_id', user.id)
            .single();
        if (clientError) {
            console.error('Error fetching client profile for user:', user.id, clientError);
             if (clientError.code === 'PGRST116') { // Not found
                 return NextResponse.json({ error: 'Client profile not found for this user.' }, { status: 404 });
            }
            throw clientError;
        }
        if (!clientData) {
             return NextResponse.json({ error: 'Client profile not found for this user.' }, { status: 404 });
        }
        clientId = clientData.id;
    } catch (error) {
         console.error('Error during client ID fetch:', error);
         const message = error instanceof Error ? error.message : 'Failed to retrieve client profile';
         return NextResponse.json({ error: message }, { status: 500 });
    }

    // 3. Parse request body
    let petData: { name: string; breed?: string; size?: string /* Add other fields as needed */ };
    try {
        const body = await request.json();
        if (!body.name || typeof body.name !== 'string' || body.name.trim() === '') {
            throw new Error('Missing or invalid required field: name');
        }
        petData = {
            name: body.name.trim(),
            breed: typeof body.breed === 'string' ? body.breed.trim() : undefined,
            size: typeof body.size === 'string' ? body.size.trim() : undefined,
            // Add other fields from body here...
        };
    } catch (e) {
        const errorMessage = e instanceof Error ? e.message : 'Invalid request body';
        return NextResponse.json({ error: errorMessage }, { status: 400 })
    }

    // 4. Insert the new pet
    try {
        const { data: newPet, error: insertError } = await supabaseAdmin
            .from('pets')
            .insert({
                ...petData,
                client_id: clientId // Assign the correct client_id
            })
            .select()
            .single();

        if (insertError) {
            console.error('Error inserting pet:', insertError)
            // Handle potential errors like FK violation if client_id is wrong
            if (insertError.code === '23503') { // Foreign key violation
                return NextResponse.json({ error: `Invalid client reference.` }, { status: 400 });
            }
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