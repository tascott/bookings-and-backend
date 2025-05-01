import { NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import type { ServiceAvailability } from '@/types'; // Import the specific type

// Define the type for the Supabase client instance if possible, otherwise use ReturnType
// type SupabaseClientType = ReturnType<typeof createServerClient>; // Removed unused alias

// Updated type definition reflecting the new schema
type ServiceAvailabilityUpdateData = Partial<Omit<ServiceAvailability, 'id' | 'created_at' | 'capacity_type'>> & {
    use_staff_vehicle_capacity?: boolean; // Ensure this can be received
    field_ids?: number[]; // Field IDs are expected now
};

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
    let availabilityData: ServiceAvailabilityUpdateData;
    try {
        const body = await request.json();
        availabilityData = body;

        // --- Validation ---
        if (availabilityData.service_id === undefined || !Array.isArray(availabilityData.field_ids) || availabilityData.field_ids.length === 0 || availabilityData.start_time === undefined || availabilityData.end_time === undefined) {
             throw new Error('Missing required fields for update: service_id, field_ids (non-empty array), start_time, end_time');
        }

        // Validate field_ids (always required now)
        availabilityData.field_ids = availabilityData.field_ids.map((id: string | number) => parseInt(String(id), 10));
        if (availabilityData.field_ids.some(isNaN)) {
            throw new Error('Invalid field_id found in field_ids array.');
        }

        availabilityData.service_id = parseInt(String(availabilityData.service_id), 10);
        if (isNaN(availabilityData.service_id)) {
            throw new Error('Invalid service_id.');
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
        availabilityData.specific_date = availabilityData.specific_date || null;
        // Validate use_staff_vehicle_capacity (ensure boolean, default false)
        availabilityData.use_staff_vehicle_capacity = typeof availabilityData.use_staff_vehicle_capacity === 'boolean' ? availabilityData.use_staff_vehicle_capacity : false;
        // --- End Validation ---

    } catch (e) {
        const errorMessage = e instanceof Error ? e.message : 'Invalid request body';
        return NextResponse.json({ error: errorMessage }, { status: 400 });
    }

    // Perform update
    // Define the type for the update payload matching the NEW table columns
    type DbUpdatePayload = {
        service_id?: number;
        field_ids?: number[]; // Not nullable in payload type, validation ensures it's array
        start_time?: string;
        end_time?: string;
        days_of_week?: number[] | null;
        specific_date?: string | null;
        use_staff_vehicle_capacity?: boolean;
        is_active?: boolean;
        override_price?: number | null;
    };

    const updatePayload: DbUpdatePayload = {};
    // Build payload from validated data
    if (availabilityData.service_id !== undefined) updatePayload.service_id = availabilityData.service_id;
    if (availabilityData.field_ids !== undefined) updatePayload.field_ids = availabilityData.field_ids; // Always send field_ids
    if (availabilityData.start_time !== undefined) updatePayload.start_time = availabilityData.start_time;
    if (availabilityData.end_time !== undefined) updatePayload.end_time = availabilityData.end_time;
    if (availabilityData.days_of_week !== undefined) updatePayload.days_of_week = availabilityData.days_of_week;
    if (availabilityData.specific_date !== undefined) updatePayload.specific_date = availabilityData.specific_date;
    updatePayload.use_staff_vehicle_capacity = availabilityData.use_staff_vehicle_capacity;
    if (availabilityData.is_active !== undefined) updatePayload.is_active = availabilityData.is_active;
    if (availabilityData.override_price !== undefined) updatePayload.override_price = availabilityData.override_price;


    const { data: updatedRule, error: updateError } = await supabaseAdmin
        .from('service_availability')
        .update(updatePayload)
        .eq('id', ruleId)
        .select()
        .single();

    if (updateError) {
        console.error(`Error updating availability rule ${ruleId}:`, updateError);
        if (updateError.code === '23503') { // FK violation
             // Error message might need adjustment if field_ids causes the issue
             return NextResponse.json({ error: `Invalid service_id (${availabilityData.service_id}) or one of the field_ids.` }, { status: 400 });
        }
         if (updateError.code === '23514') { // Check constraint
             // This might now fire if use_staff_vehicle_capacity=false and field_ids is empty/null
             return NextResponse.json({ error: `Check constraint failed: ${updateError.message}. Ensure field_ids are provided when not using staff vehicle capacity.` }, { status: 400 });
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