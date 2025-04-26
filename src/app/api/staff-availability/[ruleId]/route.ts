import { NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { getUserAuthInfo } from '@/utils/auth-helpers'

// Define expected structure for update payload
type AvailabilityRuleUpdatePayload = {
    staff_id?: number; // Should generally not be updated, but allow?
    start_time?: string;
    end_time?: string;
    days_of_week?: number[] | null; // Allow setting back to null
    specific_date?: string | null; // Allow setting back to null
    is_available?: boolean;
}

// PUT handler - Update an existing availability rule (admin only)
export async function PUT(request: Request, { params }: { params: { ruleId: string } }) {
    const supabase = await createServerClient()
    const supabaseAdmin = await createAdminClient()
    const ruleId = parseInt(params.ruleId, 10);

    if (isNaN(ruleId)) {
        return NextResponse.json({ error: 'Invalid Rule ID format' }, { status: 400 });
    }

    // Check auth & admin role
    const { isAdmin, error: authError, status } = await getUserAuthInfo(supabase);
    if (authError || !isAdmin) {
        return NextResponse.json({ error: authError || 'Forbidden: Requires admin role' }, { status: status || 403 });
    }

    let updateData: AvailabilityRuleUpdatePayload;
    try {
        const body = await request.json();
        updateData = body;

        // Validation similar to POST
        if (updateData.start_time && updateData.end_time && updateData.start_time >= updateData.end_time) {
             throw new Error('End time must be after start time');
        }
        // Check if update tries to set both days and date
        // This is tricky because we don't know the existing state easily without fetching first.
        // Let's allow setting one to null while the other exists.
        // A constraint in DB might be better.
        if (updateData.days_of_week && updateData.specific_date) {
            throw new Error('Cannot provide both days_of_week and specific_date in the same update');
        }
         if (updateData.days_of_week === null && updateData.specific_date === null) {
             throw new Error('Cannot set both days_of_week and specific_date to null. Delete the rule instead.');
        }
        if (updateData.days_of_week && (!Array.isArray(updateData.days_of_week) || updateData.days_of_week.some(d => typeof d !== 'number' || !Number.isInteger(d) || d < 0 || d > 6))) {
            throw new Error('Invalid days_of_week format');
        }
        if (updateData.specific_date && !/^\d{4}-\d{2}-\d{2}$/.test(updateData.specific_date)) {
             throw new Error('Invalid specific_date format');
        }
        if (updateData.is_available !== undefined && typeof updateData.is_available !== 'boolean') {
            throw new Error('Invalid is_available format');
        }
        if (updateData.staff_id !== undefined && (typeof updateData.staff_id !== 'number' || !Number.isInteger(updateData.staff_id))) {
             throw new Error('Invalid staff_id format');
        }
        // Ensure at least one field is being updated
        if (Object.keys(updateData).length === 0) {
            throw new Error('No fields provided for update.');
        }

    } catch (e) {
        const errorMessage = e instanceof Error ? e.message : 'Invalid request body';
        return NextResponse.json({ error: errorMessage }, { status: 400 });
    }

    try {
        // Perform the update
        const { data: updatedRule, error: updateError } = await supabaseAdmin
            .from('staff_availability')
            .update(updateData)
            .eq('id', ruleId)
            .select('*, staff(profiles(first_name, last_name))') // Return updated rule with staff name
            .single();

        if (updateError) {
             if (updateError.code === 'PGRST116') { // Row not found
                return NextResponse.json({ error: 'Rule not found.' }, { status: 404 });
             }
             if (updateError.code === '23503') { // Foreign key violation (e.g., bad staff_id)
                 return NextResponse.json({ error: `Update failed: Invalid reference (e.g., staff_id).` }, { status: 400 });
             }
             // Handle potential constraint violation (e.g. check_day_or_date if both become null)
             if (updateError.message.includes('check_day_or_date')) {
                 return NextResponse.json({ error: 'Update failed: Cannot have both days_of_week and specific_date as null. Delete the rule instead.' }, { status: 400 });
             }
            throw updateError;
        }

        if (!updatedRule) {
            // Should be caught by PGRST116, but as fallback
            return NextResponse.json({ error: 'Rule not found.' }, { status: 404 });
        }

        return NextResponse.json(updatedRule);

    } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to update staff availability rule';
        console.error(`Staff Availability PUT Error (ID: ${ruleId}):`, err);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

// DELETE handler - Delete an availability rule (admin only)
export async function DELETE(request: Request, { params }: { params: { ruleId: string } }) {
    const supabase = await createServerClient()
    const supabaseAdmin = await createAdminClient()
    const ruleId = parseInt(params.ruleId, 10);

    if (isNaN(ruleId)) {
        return NextResponse.json({ error: 'Invalid Rule ID format' }, { status: 400 });
    }

    // Check auth & admin role
    const { isAdmin, error: authError, status } = await getUserAuthInfo(supabase);
    if (authError || !isAdmin) {
        return NextResponse.json({ error: authError || 'Forbidden: Requires admin role' }, { status: status || 403 });
    }

    try {
        const { error: deleteError, count } = await supabaseAdmin
            .from('staff_availability')
            .delete({ count: 'exact' })
            .eq('id', ruleId);

        if (deleteError) throw deleteError;

        if (count === 0) {
             return NextResponse.json({ error: 'Rule not found.' }, { status: 404 });
        }

        return NextResponse.json({ message: 'Rule deleted successfully' }, { status: 200 }); // 200 OK

    } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to delete staff availability rule';
        console.error(`Staff Availability DELETE Error (ID: ${ruleId}):`, err);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}