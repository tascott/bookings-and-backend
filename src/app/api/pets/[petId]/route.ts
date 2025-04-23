import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin' // Use admin client for updates/deletes

// PUT (Update) a specific pet
export async function PUT(request: Request, { params }: { params: { petId: string } }) {
    const supabase = await createClient()
    const supabaseAdmin = await createAdminClient()
    const petId = parseInt(params.petId, 10);

    if (isNaN(petId)) {
        return NextResponse.json({ error: 'Invalid Pet ID format' }, { status: 400 });
    }

    // 1. Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    // 2. Get client_id by fetching from clients table
    let clientId: number;
    try {
        const { data: clientData, error: clientError } = await supabase
            .from('clients')
            .select('id')
            .eq('user_id', user.id)
            .single();
        if (clientError) {
            console.error('Error fetching client profile for user:', user.id, clientError);
             if (clientError.code === 'PGRST116') { return NextResponse.json({ error: 'Client profile not found.' }, { status: 404 }); }
            throw clientError;
        }
        if (!clientData) { return NextResponse.json({ error: 'Client profile not found.' }, { status: 404 }); }
        clientId = clientData.id;
    } catch (error) {
         console.error('Error during client ID fetch:', error);
         const message = error instanceof Error ? error.message : 'Failed to retrieve client profile';
         return NextResponse.json({ error: message }, { status: 500 });
    }

    // 3. Parse request body for update data
    let updateData: { name?: string; breed?: string; size?: string /* Add other fields */ };
    try {
        const body = await request.json();
        updateData = {
            name: body.name && typeof body.name === 'string' ? body.name.trim() : undefined,
            breed: body.breed && typeof body.breed === 'string' ? body.breed.trim() : undefined,
            size: body.size && typeof body.size === 'string' ? body.size.trim() : undefined,
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

    // 4. Update the pet (checking ownership implicitly via client_id filter)
    try {
        const { data: updatedPet, error: updateError } = await supabaseAdmin
            .from('pets')
            .update(updateData)
            .eq('id', petId)
            .eq('client_id', clientId) // IMPORTANT: Ensure user owns this pet
            .select()
            .single();

        if (updateError) {
            console.error('Error updating pet:', updateError)
            // Handle specific errors like FK violation if necessary (though unlikely on update)
            throw updateError;
        }

        // If update succeeded but returned no data, it means the petId + clientId didn't match
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

    // 1. Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    // 2. Get client_id by fetching from clients table
    let clientId: number;
    try {
        const { data: clientData, error: clientError } = await supabase
            .from('clients')
            .select('id')
            .eq('user_id', user.id)
            .single();
        if (clientError) {
            console.error('Error fetching client profile for user:', user.id, clientError);
             if (clientError.code === 'PGRST116') { return NextResponse.json({ error: 'Client profile not found.' }, { status: 404 }); }
            throw clientError;
        }
        if (!clientData) { return NextResponse.json({ error: 'Client profile not found.' }, { status: 404 }); }
        clientId = clientData.id;
    } catch (error) {
         console.error('Error during client ID fetch:', error);
         const message = error instanceof Error ? error.message : 'Failed to retrieve client profile';
         return NextResponse.json({ error: message }, { status: 500 });
    }

    // 3. Delete the pet (checking ownership implicitly via client_id filter)
    try {
        const { error: deleteError, count } = await supabaseAdmin
            .from('pets')
            .delete({ count: 'exact' })
            .eq('id', petId)
            .eq('client_id', clientId); // IMPORTANT: Ensure user owns this pet

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