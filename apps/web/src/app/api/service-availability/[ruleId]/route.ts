import { NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import type { ServiceAvailability } from '@booking-and-accounts-monorepo/shared-types'; // Corrected import path

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
        const {
            service_id,
            field_ids,
            start_time,
            end_time,
            days_of_week,
            specific_date,
            use_staff_vehicle_capacity,
            is_active, // Capture is_active for validation
            override_price // Capture override_price for validation
        } = availabilityData;

        const providedFields = Object.keys(availabilityData);

        // If only is_active is provided, or very few fields, skip complex validation that depends on others.
        // This check might need refinement based on what minimal updates are allowed.
        // For now, if is_active is one of the fields, we allow it to be potentially the only one.
        const isDeactivationAttempt = providedFields.includes('is_active') && providedFields.length === 1;

        if (!isDeactivationAttempt) { // Only run these full validations if not just a deactivation
            if (service_id === undefined) throw new Error('Missing required field for update: service_id');
            if (!Array.isArray(field_ids) || field_ids.length === 0) throw new Error('Missing required field for update: field_ids (must be a non-empty array)');
            if (start_time === undefined) throw new Error('Missing required field for update: start_time');
            if (end_time === undefined) throw new Error('Missing required field for update: end_time');
        }

        if (service_id !== undefined) {
            availabilityData.service_id = parseInt(String(service_id), 10);
            if (isNaN(availabilityData.service_id)) {
                throw new Error('Invalid service_id.');
            }
        }

        if (field_ids !== undefined) {
            if (!Array.isArray(field_ids) || (field_ids.length === 0 && !isDeactivationAttempt)) { // Allow empty field_ids if not deactivation
                 throw new Error('field_ids must be a non-empty array.');
            }
            availabilityData.field_ids = field_ids.map((id: string | number) => parseInt(String(id), 10));
            if (availabilityData.field_ids.some(isNaN)) {
                throw new Error('Invalid field_id found in field_ids array.');
            }
        }


        if (start_time !== undefined) {
            const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$/;
            if (!timeRegex.test(start_time)) throw new Error('Invalid start_time format');
            availabilityData.start_time = start_time; // Ensure it's assigned back if valid
        }

        if (end_time !== undefined) {
            const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$/;
            if (!timeRegex.test(end_time)) throw new Error('Invalid end_time format');
            availabilityData.end_time = end_time; // Ensure it's assigned back if valid
        }

        if (start_time !== undefined && end_time !== undefined) {
            if (end_time <= start_time) throw new Error('End time must be after start time');
        }

        if (days_of_week != null && specific_date != null) {
            throw new Error('Cannot set both days_of_week and specific_date');
        }

        if (days_of_week != null) {
             if (!Array.isArray(days_of_week)) throw new Error('days_of_week must be an array.')
             const parsedDays: number[] = days_of_week.map((d: string | number) => parseInt(String(d), 10));
             if (parsedDays.some(isNaN)) throw new Error('Invalid number in days_of_week array.');
             if (parsedDays.some(d => d < 1 || d > 7)) throw new Error('Invalid day in days_of_week array (1-7).');
             availabilityData.days_of_week = parsedDays.length > 0 ? parsedDays : null;
        } else if (providedFields.includes('days_of_week')) { // if explicitly provided as null/empty
             availabilityData.days_of_week = null;
        }

        if (specific_date !== undefined) { // Check if specific_date was provided
            availabilityData.specific_date = specific_date || null;
        }

        if (providedFields.includes('use_staff_vehicle_capacity')) {
            availabilityData.use_staff_vehicle_capacity = typeof use_staff_vehicle_capacity === 'boolean' ? use_staff_vehicle_capacity : false;
        }

        if (providedFields.includes('is_active')) {
            if (typeof is_active !== 'boolean') throw new Error('is_active must be a boolean.');
            availabilityData.is_active = is_active;
        }

        if (override_price !== undefined) {
            const price = parseFloat(String(override_price));
            if (isNaN(price) || price < 0) throw new Error('Invalid override_price.');
            availabilityData.override_price = price;
        }
        // --- End Validation ---

    } catch (e) {
        const errorMessage = e instanceof Error ? e.message : 'Invalid request body';
        return NextResponse.json({ error: errorMessage }, { status: 400 });
    }

    // Perform update
    // Define the type for the update payload matching the NEW table columns
    type DbUpdatePayload = {
        service_id?: number;
        field_ids?: number[];
        start_time?: string;
        end_time?: string;
        days_of_week?: number[] | null;
        specific_date?: string | null;
        use_staff_vehicle_capacity?: boolean;
        is_active?: boolean;
        override_price?: number | null;
    };

    const updatePayload: DbUpdatePayload = {};
    // Build payload from validated data, only including fields that were actually in availabilityData
    if (availabilityData.hasOwnProperty('service_id')) updatePayload.service_id = availabilityData.service_id;
    if (availabilityData.hasOwnProperty('field_ids')) updatePayload.field_ids = availabilityData.field_ids;
    if (availabilityData.hasOwnProperty('start_time')) updatePayload.start_time = availabilityData.start_time;
    if (availabilityData.hasOwnProperty('end_time')) updatePayload.end_time = availabilityData.end_time;
    if (availabilityData.hasOwnProperty('days_of_week')) updatePayload.days_of_week = availabilityData.days_of_week;
    if (availabilityData.hasOwnProperty('specific_date')) updatePayload.specific_date = availabilityData.specific_date;
    // Ensure use_staff_vehicle_capacity is included if it was in the payload or defaults to false if not explicitly set for an update but other capacity related fields are changing
    if (availabilityData.hasOwnProperty('use_staff_vehicle_capacity')) {
        updatePayload.use_staff_vehicle_capacity = availabilityData.use_staff_vehicle_capacity;
    } else if (updatePayload.field_ids) {
        // If field_ids are being updated, and use_staff_vehicle_capacity is not specified,
        // we might need to infer its intended value or rely on a DB default.
        // For safety, let's assume if not provided during an update that involves fields, it defaults to false.
        // This specific logic might need more business context.
        // For now, only include if explicitly set.
    }

    if (availabilityData.hasOwnProperty('is_active')) updatePayload.is_active = availabilityData.is_active;
    if (availabilityData.hasOwnProperty('override_price')) updatePayload.override_price = availabilityData.override_price;


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