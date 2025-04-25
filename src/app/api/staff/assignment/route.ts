import { NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';

// PATCH handler to update staff default vehicle
export async function PATCH(request: Request) {
    const supabase = await createServerClient();
    const supabaseAdmin = await createAdminClient();

    // 1. Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // 2. Check if the user is an admin
    const { data: staffData, error: staffError } = await supabase
        .from('staff')
        .select('role')
        .eq('user_id', user.id)
        .single();

    if (staffError || !staffData || staffData.role !== 'admin') {
        return NextResponse.json({ error: 'Forbidden: Requires admin role' }, { status: 403 });
    }

    // 3. Parse request body
    let staffId: number;
    let defaultVehicleId: number | null;
    try {
        const body = await request.json();
        if (typeof body.staffId !== 'number') {
            throw new Error('Missing or invalid staffId');
        }
        // Allow null for defaultVehicleId
        if (typeof body.defaultVehicleId !== 'number' && body.defaultVehicleId !== null) {
             throw new Error('Invalid defaultVehicleId');
        }
        staffId = body.staffId;
        defaultVehicleId = body.defaultVehicleId;
    } catch (e) {
        const message = e instanceof Error ? e.message : 'Invalid request body';
        return NextResponse.json({ error: message }, { status: 400 });
    }

    // 4. Update the staff record using admin client
    try {
        const { error: updateError } = await supabaseAdmin
            .from('staff')
            .update({ default_vehicle_id: defaultVehicleId })
            .eq('id', staffId);

        if (updateError) {
            console.error("Error updating staff default vehicle:", updateError);
            // Check for specific errors like foreign key violation if vehicle doesn't exist
            if (updateError.code === '23503') { // Foreign key violation
                 return NextResponse.json({ error: 'Invalid vehicle ID specified' }, { status: 400 });
            }
            throw new Error(updateError.message || 'Failed to update staff record');
        }

        // 5. Return success
        return NextResponse.json({ success: true });

    } catch (e) {
        const message = e instanceof Error ? e.message : 'Internal server error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}