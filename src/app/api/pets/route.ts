import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin' // Use admin for inserts/updates if needed
import { getUserAuthInfo } from '@/utils/auth-helpers'

// GET user's pets
export async function GET() {
    const supabase = await createClient()
    const supabaseAdmin = await createAdminClient()

    // Get user auth info from our helper
    const { clientId, isAdmin, error, status } = await getUserAuthInfo(supabase);

    // Return early if there was an auth error
    if (error) {
        return NextResponse.json({ error }, { status: status || 401 });
    }

    // For this endpoint, a client ID is required for non-admin users
    if (!clientId && !isAdmin) {
        return NextResponse.json({ error: 'Client profile not found for this user' }, { status: 404 });
    }

    try {
        let petsQuery;

        if (isAdmin) {
            // Admin users can see all pets
            petsQuery = supabaseAdmin
                .from('pets')
                .select('*')
                .order('name');
        } else {
            // Regular users can only see their own pets
            petsQuery = supabase
                .from('pets')
                .select('*')
                .eq('client_id', clientId!) // Non-null assertion is safe here since we checked above
                .order('name');
        }

        const { data: pets, error: petsError } = await petsQuery;

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

    // Get user auth info from our helper
    const { clientId, error, status } = await getUserAuthInfo(supabase);

    // Return early if there was an auth error
    if (error) {
        return NextResponse.json({ error }, { status: status || 401 });
    }

    // For this endpoint, a client ID is required
    if (!clientId) {
        return NextResponse.json({ error: 'Client profile not found for this user' }, { status: 404 });
    }

    // Parse request body
    let petData: { name: string; breed?: string; size?: string; is_confirmed?: boolean /* Add other fields as needed */ };
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
            // Add other fields from body here...
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