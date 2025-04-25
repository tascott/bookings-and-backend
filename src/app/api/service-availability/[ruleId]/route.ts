import { NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import type { ServiceAvailability } from '@/types'; // Import the specific type

// Define the type for the Supabase client instance if possible, otherwise use ReturnType
// type SupabaseClientType = ReturnType<typeof createServerClient>; // Removed unused alias

// Helper function to check admin role
async function isAdmin(supabasePromise: ReturnType<typeof createServerClient>): Promise<boolean> {
    const supabase = await supabasePromise; // Await inside the helper
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return false;

    const { data: staffData, error: staffError } = await supabase
        .from('staff')
        .select('role')
        .eq('user_id', user.id)
        .single();

    return !staffError && staffData?.role === 'admin';
}

// PUT handler to update a service availability rule
export async function PUT(request: Request, { params }: { params: { ruleId: string } }) {
    const supabaseClientPromise = createServerClient(); // Pass the promise
    const supabaseAdmin = await createAdminClient();
    const ruleId = parseInt(params.ruleId, 10);

    if (!(await isAdmin(supabaseClientPromise))) { // Call with promise
        return NextResponse.json({ error: 'Forbidden: Requires admin role' }, { status: 403 });
    }

    if (isNaN(ruleId)) {
        return NextResponse.json({ error: 'Invalid rule ID' }, { status: 400 });
    }

    // Parse request body
    let availabilityData: Partial<ServiceAvailability>; // Use Partial for update
    try {
        const body = await request.json();
        availabilityData = body; // Assign directly, validation follows

        // --- Validation ---
        // Ensure required fields are present for an update (maybe allow partial updates?)
        // For now, assuming all fields are sent for PUT, similar to POST validation
        if (availabilityData.service_id === undefined || availabilityData.field_ids === undefined || availabilityData.start_time === undefined || availabilityData.end_time === undefined) {
             throw new Error('Missing required fields for update: service_id, field_ids, start_time, end_time');
        }
        availabilityData.service_id = parseInt(String(availabilityData.service_id), 10);
        availabilityData.field_ids = availabilityData.field_ids.map((id: string | number) => parseInt(String(id), 10));
        if (isNaN(availabilityData.service_id) || availabilityData.field_ids.some(isNaN)) {
            throw new Error('Invalid service_id or field_id.');
        }
        const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$/;
        if (!timeRegex.test(availabilityData.start_time) || !timeRegex.test(availabilityData.end_time)) throw new Error('Invalid time format');
        if (availabilityData.end_time <= availabilityData.start_time) throw new Error('End time must be after start time');
        if (availabilityData.days_of_week != null && availabilityData.specific_date != null) throw new Error('Cannot set both days_of_week and specific_date');
        if (availabilityData.days_of_week != null) {
             if (!Array.isArray(availabilityData.days_of_week)) throw new Error('days_of_week must be an array.')
             const parsedDays: number[] = availabilityData.days_of_week.map((d: string | number) => parseInt(String(d), 10));
             if (parsedDays.some(isNaN)) throw new Error('Invalid number in days_of_week array.');
             if (parsedDays.some(d => d < 1 || d > 7)) throw new Error('Invalid day in days_of_week array (1-7).');
             availabilityData.days_of_week = parsedDays.length > 0 ? parsedDays : null;
        } else {
             availabilityData.days_of_week = null;
        }
        if (availabilityData.base_capacity != null) {
             const parsedCap = parseInt(String(availabilityData.base_capacity), 10); // Ensure string conversion
             availabilityData.base_capacity = isNaN(parsedCap) ? null : parsedCap;
        } else {
            availabilityData.base_capacity = null;
        }
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (availabilityData.specific_date != null && availabilityData.specific_date !== '' && !dateRegex.test(availabilityData.specific_date)) throw new Error('Invalid specific_date format');

        if (availabilityData.override_price !== undefined && availabilityData.override_price !== null) {
            const parsedPrice = parseFloat(String(availabilityData.override_price)); // Ensure string conversion
            availabilityData.override_price = isNaN(parsedPrice) ? null : parsedPrice;
        } else {
             availabilityData.override_price = null;
        }
        // Handle is_active, default to true if not provided in PUT
        availabilityData.is_active = typeof availabilityData.is_active === 'boolean' ? availabilityData.is_active : true;
        availabilityData.specific_date = availabilityData.specific_date || null;
        // --- End Validation ---

    } catch (e) {
        const errorMessage = e instanceof Error ? e.message : 'Invalid request body';
        return NextResponse.json({ error: errorMessage }, { status: 400 });
    }

    // Perform update
    const { data: updatedRule, error: updateError } = await supabaseAdmin
        .from('service_availability')
        .update(availabilityData) // Removed 'as any' assertion
        .eq('id', ruleId)
        .select()
        .single();

    if (updateError) {
        console.error(`Error updating availability rule ${ruleId}:`, updateError);
        if (updateError.code === '23503') { // FK violation
             return NextResponse.json({ error: `Invalid service_id (${availabilityData.service_id}) or one of the field_ids.` }, { status: 400 });
        }
         if (updateError.code === '23514') { // Check constraint
             return NextResponse.json({ error: `Check constraint failed: ${updateError.message}` }, { status: 400 });
        }
        return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    if (!updatedRule) {
        return NextResponse.json({ error: `Availability rule with ID ${ruleId} not found.` }, { status: 404 });
    }

    return NextResponse.json(updatedRule);
}

// DELETE handler to remove a service availability rule
export async function DELETE(request: Request, { params }: { params: { ruleId: string } }) {
    const supabaseClientPromise = createServerClient(); // Pass the promise
    const supabaseAdmin = await createAdminClient();
    const ruleId = parseInt(params.ruleId, 10);

    if (!(await isAdmin(supabaseClientPromise))) { // Call with promise
        return NextResponse.json({ error: 'Forbidden: Requires admin role' }, { status: 403 });
    }

    if (isNaN(ruleId)) {
        return NextResponse.json({ error: 'Invalid rule ID' }, { status: 400 });
    }

    // Perform delete
    const { error: deleteError } = await supabaseAdmin
        .from('service_availability')
        .delete()
        .eq('id', ruleId);

    if (deleteError) {
        console.error(`Error deleting availability rule ${ruleId}:`, deleteError);
        return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
}