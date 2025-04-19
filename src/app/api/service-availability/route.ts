import { NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'

// GET all service availability rules
export async function GET(request: Request) {
  const supabase = await createServerClient()
  const { searchParams } = new URL(request.url)
  const serviceId = searchParams.get('service_id')
  const fieldId = searchParams.get('field_id') // For checking if a field is included

  // Check auth
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  // Allow staff+admin to view availability
   const { data: staffData, error: staffError } = await supabase
    .from('staff')
    .select('role')
    .eq('user_id', user.id)
    .single()
  if (staffError || !staffData || !['admin', 'staff'].includes(staffData.role || '')) {
    return NextResponse.json({ error: 'Forbidden: Requires admin or staff role' }, { status: 403 })
  }

  // Build query
  const supabaseAdmin = await createAdminClient()
  let query = supabaseAdmin.from('service_availability').select('*')
  if (serviceId) {
    query = query.eq('service_id', serviceId)
  }
  if (fieldId) {
    // Use array contains operator '@>'
    query = query.contains('field_ids', [fieldId])
  }

  const { data: availability, error } = await query.order('id') // Order by creation or service_id?

  if (error) {
    console.error('Error fetching service availability:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(availability)
}

// POST a new service availability rule (Admin only)
export async function POST(request: Request) {
  const supabase = await createServerClient()
  const supabaseAdmin = await createAdminClient()

   // Check auth & admin role
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }
  const { data: staffData, error: staffError } = await supabase
    .from('staff')
    .select('role')
    .eq('user_id', user.id)
    .single()
  if (staffError || !staffData || staffData.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden: Requires admin role' }, { status: 403 })
  }

  // Parse request body
  let availabilityData: {
      service_id: number;
      field_ids: number[];
      start_time: string;
      end_time: string;
      base_capacity?: number;
      is_active?: boolean;
      days_of_week?: number[];
      specific_date?: string;
  };

  try {
    const body = await request.json();
    // Basic validation
    if (!body.service_id || !Array.isArray(body.field_ids) || body.field_ids.length === 0 || !body.start_time || !body.end_time) {
        throw new Error('Missing required fields: service_id, field_ids (array), start_time, end_time');
    }

    // Validate field IDs
    const fieldIds = body.field_ids.map((id: string | number) => parseInt(String(id), 10));
    if (fieldIds.some(isNaN)) {
        throw new Error('Invalid field_id found in the field_ids array.');
    }

    // Validate times, recurrence, capacity, date format
    const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$/;
    if (!timeRegex.test(body.start_time) || !timeRegex.test(body.end_time)) throw new Error('Invalid time format');
    if (body.end_time <= body.start_time) throw new Error('End time must be after start time');
    if (body.days_of_week != null && body.specific_date != null) throw new Error('Cannot set both days_of_week and specific_date');

    let daysOfWeekValue: number[] | undefined = undefined;
    if (body.days_of_week != null) {
        if (!Array.isArray(body.days_of_week)) throw new Error('days_of_week must be an array.')
        const parsedDays: number[] = body.days_of_week.map((d: string | number) => parseInt(String(d), 10));
        if (parsedDays.some(isNaN)) throw new Error('Invalid number in days_of_week array.');
        if (parsedDays.some(d => d < 1 || d > 7)) throw new Error('Invalid day in days_of_week array (1-7).');
        if (parsedDays.length > 0) daysOfWeekValue = parsedDays;
    }
    const baseCapacityRaw = body.base_capacity ? parseInt(body.base_capacity, 10) : undefined;
    const baseCapacityValue = (baseCapacityRaw !== undefined && !isNaN(baseCapacityRaw)) ? baseCapacityRaw : undefined;
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (body.specific_date != null && !dateRegex.test(body.specific_date)) throw new Error('Invalid specific_date format');
    // --------------------------------

    availabilityData = {
        service_id: parseInt(body.service_id, 10),
        field_ids: fieldIds,
        start_time: body.start_time,
        end_time: body.end_time,
        base_capacity: baseCapacityValue,
        is_active: body.is_active !== undefined ? body.is_active : true,
        days_of_week: daysOfWeekValue,
        specific_date: body.specific_date || null
    };
    if (isNaN(availabilityData.service_id)) throw new Error('Invalid service_id');

  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : 'Invalid request body';
    return NextResponse.json({ error: errorMessage }, { status: 400 })
  }

  // Insert the new availability rule
  const { data: newAvailability, error: insertError } = await supabaseAdmin
    .from('service_availability')
    .insert(availabilityData)
    .select()
    .single();

  if (insertError) {
    console.error('Error creating service availability:', insertError)
    if (insertError.code === '23503') { // FK violation
         return NextResponse.json({ error: `Invalid service_id (${availabilityData.service_id}) or one of the field_ids.` }, { status: 400 });
    }
    if (insertError.code === '23514') { // Check constraint
        return NextResponse.json({ error: `Check constraint failed: ${insertError.message}` }, { status: 400 });
    }
    return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  return NextResponse.json(newAvailability, { status: 201 })
}