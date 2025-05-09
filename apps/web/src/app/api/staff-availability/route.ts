import { NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { getUserAuthInfo } from '@booking-and-accounts-monorepo/utils';

// GET handler - List availability rules (admin only), optionally filter by staff_id
export async function GET(request: Request) {
    const supabase = await createServerClient()
    const supabaseAdmin = await createAdminClient()

    // Check auth & admin role
    const { isAdmin, error: authError, status } = await getUserAuthInfo(supabase);
    if (authError || !isAdmin) {
        return NextResponse.json({ error: authError || 'Forbidden: Requires admin role' }, { status: status || 403 });
    }

    const { searchParams } = new URL(request.url);
    const staffIdParam = searchParams.get('staff_id');

    let query = supabaseAdmin
        .from('staff_availability')
        .select('*, staff(profiles(first_name, last_name))') // Select all fields and staff name for context
        .order('staff_id').order('specific_date').order('start_time');

    if (staffIdParam) {
        const staffId = parseInt(staffIdParam, 10);
        if (isNaN(staffId)) {
            return NextResponse.json({ error: 'Invalid staff_id parameter' }, { status: 400 });
        }
        query = query.eq('staff_id', staffId);
    }

    try {
        const { data, error } = await query;
        if (error) throw error;
        return NextResponse.json(data || []);
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to fetch staff availability';
        console.error("Staff Availability GET Error:", err);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

// POST handler - Create a new availability rule (admin only)
export async function POST(request: Request) {
    const supabase = await createServerClient()
    const supabaseAdmin = await createAdminClient()

    // Check auth & admin role
    const { isAdmin, error: authError, status } = await getUserAuthInfo(supabase);
    if (authError || !isAdmin) {
        return NextResponse.json({ error: authError || 'Forbidden: Requires admin role' }, { status: status || 403 });
    }

    // Define expected structure for incoming data
    type AvailabilityRulePayload = {
        staff_id: number;
        start_time: string;
        end_time: string;
        days_of_week?: number[];
        specific_date?: string;
        is_available?: boolean;
    }

    let ruleData: AvailabilityRulePayload;
    try {
        ruleData = await request.json();

        // Basic Validation
        if (!ruleData.staff_id || typeof ruleData.staff_id !== 'number') throw new Error('Missing or invalid staff_id');
        if (!ruleData.start_time || !ruleData.end_time) throw new Error('Missing start_time or end_time');
        if (ruleData.start_time >= ruleData.end_time) throw new Error('End time must be after start time');
        if (!ruleData.days_of_week && !ruleData.specific_date) throw new Error('Either days_of_week or specific_date must be provided');
        if (ruleData.days_of_week && ruleData.specific_date) throw new Error('Cannot provide both days_of_week and specific_date');
        // Check days_of_week array elements more strictly
        if (ruleData.days_of_week && (!Array.isArray(ruleData.days_of_week) || ruleData.days_of_week.some(d => typeof d !== 'number' || !Number.isInteger(d) || d < 0 || d > 6))) {
            throw new Error('Invalid days_of_week format (must be array of integers 0-6)');
        }
        // Check specific_date format (simple check, assumes YYYY-MM-DD)
        if (ruleData.specific_date && !/^\d{4}-\d{2}-\d{2}$/.test(ruleData.specific_date)) {
            throw new Error('Invalid specific_date format (must be YYYY-MM-DD)');
        }
        if (ruleData.is_available !== undefined && typeof ruleData.is_available !== 'boolean') {
             throw new Error('Invalid is_available format (must be boolean)');
        }

    } catch (e) {
        const errorMessage = e instanceof Error ? e.message : 'Invalid request body';
        return NextResponse.json({ error: errorMessage }, { status: 400 });
    }

    // Prepare data for insert (only include valid fields)
    // Use a more specific type for the payload
    type InsertPayload = {
        staff_id: number;
        start_time: string;
        end_time: string;
        is_available: boolean;
        days_of_week?: number[];
        specific_date?: string;
    }
    const insertPayload: InsertPayload = {
        staff_id: ruleData.staff_id,
        start_time: ruleData.start_time,
        end_time: ruleData.end_time,
        is_available: ruleData.is_available === undefined ? true : ruleData.is_available, // Default to true
    };
    if (ruleData.days_of_week) insertPayload.days_of_week = ruleData.days_of_week;
    if (ruleData.specific_date) insertPayload.specific_date = ruleData.specific_date;

    try {
        const { data: newRule, error: insertError } = await supabaseAdmin
            .from('staff_availability')
            .insert(insertPayload)
            .select('*, staff(profiles(first_name, last_name))') // Return new rule with staff name
            .single();

        if (insertError) {
            // Handle specific errors like FK violation if staff_id doesn't exist
             if (insertError.code === '23503') { // FK violation
                 return NextResponse.json({ error: `Invalid staff_id: ${ruleData.staff_id} does not exist.` }, { status: 400 });
            }
            throw insertError;
        }

        if (!newRule) throw new Error('Failed to create rule or retrieve data.');

        return NextResponse.json(newRule, { status: 201 });

    } catch (err) {
         const message = err instanceof Error ? err.message : 'Failed to create staff availability rule';
         console.error("Staff Availability POST Error:", err);
         return NextResponse.json({ error: message }, { status: 500 });
    }
}