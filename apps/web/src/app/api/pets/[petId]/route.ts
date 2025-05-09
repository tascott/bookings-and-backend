import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin' // Use admin client for updates/deletes
import { getUserAuthInfo } from '@booking-and-accounts-monorepo/utils';

// GET a specific pet by ID
export async function GET(request: Request, { params }: { params: { petId: string } }) {
    const supabase = await createClient()
    const petId = parseInt(params.petId, 10);

    if (isNaN(petId)) {
        return NextResponse.json({ error: 'Invalid Pet ID format' }, { status: 400 });
    }

    // Use the combined auth helper function to get user auth info
    const { clientId, isAdmin, error, status } = await getUserAuthInfo(supabase);

    // Return early if there was an auth error
    if (error) {
        return NextResponse.json({ error }, { status: status || 401 });
    }

    // Fetch the pet
    try {
        let query = supabase
            .from('pets')
            .select('*')
            .eq('id', petId);

        // If not admin, only return pets owned by the client
        if (!isAdmin && clientId !== undefined) {
            query = query.eq('client_id', clientId);
        }

        const { data: pet, error: fetchError } = await query.single();

        if (fetchError) {
            if (fetchError.code === 'PGRST116') { // Not found
                return NextResponse.json({ error: 'Pet not found or access denied.' }, { status: 404 });
            }
            throw fetchError;
        }

        if (!pet) {
            return NextResponse.json({ error: 'Pet not found or access denied.' }, { status: 404 });
        }

        return NextResponse.json(pet);

    } catch (error: unknown) {
        console.error('Error fetching pet:', error);
        const message = error instanceof Error ? error.message : 'Failed to fetch pet';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

// PUT (Update) a specific pet
export async function PUT(request: Request, { params }: { params: { petId: string } }) {
    const supabase = await createClient()
    const supabaseAdmin = await createAdminClient()
    const petId = parseInt(params.petId, 10);

    if (isNaN(petId)) {
        return NextResponse.json({ error: 'Invalid Pet ID format' }, { status: 400 });
    }

    // Use the combined auth helper function to get user auth info
    const { clientId, isAdmin, error, status } = await getUserAuthInfo(supabase);

    // Return early if there was an auth error
    if (error) {
        return NextResponse.json({ error }, { status: status || 401 });
    }

    // Parse request body for update data
    let updateData: { name?: string; breed?: string; size?: string; is_confirmed?: boolean /* Add other fields */ };
    try {
        const body = await request.json();
        updateData = {
            name: body.name && typeof body.name === 'string' ? body.name.trim() : undefined,
            breed: body.breed && typeof body.breed === 'string' ? body.breed.trim() : undefined,
            size: body.size && typeof body.size === 'string' ? body.size.trim() : undefined,
            // Allow is_confirmed only for admin users
            is_confirmed: isAdmin && body.hasOwnProperty('is_confirmed') ? !!body.is_confirmed : undefined,
            // Add other optional fields...
        };
        // Ensure at least one field is being updated
        if (Object.values(updateData).every(val => val === undefined)) {
            throw new Error('No valid fields provided for update.');
        }
    } catch (e) {
        const errorMessage = e instanceof Error ? e.message : 'Invalid request body';
        return NextResponse.json({ error: errorMessage }, { status: 400 })
    }

    // Update the pet
    try {
        let query = supabaseAdmin
            .from('pets')
            .update(updateData)
            .eq('id', petId);

        // If not admin, ensure user owns this pet
        if (!isAdmin && clientId !== undefined) {
            query = query.eq('client_id', clientId);
        }

        const { data: updatedPet, error: updateError } = await query.select().single();

        if (updateError) {
            console.error('Error updating pet:', updateError)
            throw updateError;
        }

        // If update succeeded but returned no data, it means the petId didn't match or access was denied
        if (!updatedPet) {
            return NextResponse.json({ error: 'Pet not found or access denied.' }, { status: 404 });
        }

        return NextResponse.json(updatedPet);

    } catch (error: unknown) {
        console.error('Error processing pet update:', error);
        const message = error instanceof Error ? error.message : 'Failed to update pet';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

// DELETE a specific pet
export async function DELETE(request: Request, { params }: { params: { petId: string } }) {
    const supabase = await createClient()
    const supabaseAdmin = await createAdminClient()
    const petId = parseInt(params.petId, 10);

    if (isNaN(petId)) {
        return NextResponse.json({ error: 'Invalid Pet ID format' }, { status: 400 });
    }

    // Use the combined auth helper function to get user auth info
    const { clientId, isAdmin, error, status } = await getUserAuthInfo(supabase);

    // Return early if there was an auth error
    if (error) {
        return NextResponse.json({ error }, { status: status || 401 });
    }

    // Check if client ID is available for non-admin users
    if (!isAdmin && clientId === undefined) {
        return NextResponse.json({ error: 'Client profile required' }, { status: 404 });
    }

    // Delete the pet (checking ownership implicitly via client_id filter)
    try {
        // For regular users, ensure they only delete their own pets
        const deleteQuery = supabaseAdmin
            .from('pets')
            .delete({ count: 'exact' })
            .eq('id', petId);

        // Add client_id filter for regular users (non-admin)
        if (!isAdmin) {
            deleteQuery.eq('client_id', clientId!); // Non-null assertion is safe here due to prior check
        }

        const { error: deleteError, count } = await deleteQuery;

        if (deleteError) {
            console.error('Error deleting pet:', deleteError);
            throw deleteError;
        }

        // Check if a row was actually deleted
        if (count === 0) {
            return NextResponse.json({ error: 'Pet not found or access denied.' }, { status: 404 });
        }

        return NextResponse.json({ message: 'Pet deleted successfully' }, { status: 200 }); // 200 OK or 204 No Content

    } catch (error: unknown) {
        console.error('Error processing pet deletion:', error);
        const message = error instanceof Error ? error.message : 'Failed to delete pet';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}