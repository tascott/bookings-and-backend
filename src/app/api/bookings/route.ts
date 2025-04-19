import { NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'

// GET all bookings
export async function GET() {
  const supabase = await createServerClient()
  // const { searchParams } = new URL(request.url) // Keep commented
  // Potential future query params: field_id, start_date, end_date

  // Check auth
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  // Allow staff+admin to view bookings
   const { data: staffData, error: staffError } = await supabase
    .from('staff')
    .select('role')
    .eq('user_id', user.id)
    .single()

  if (staffError || !staffData || !['admin', 'staff'].includes(staffData.role || '')) {
    return NextResponse.json({ error: 'Forbidden: Requires admin or staff role to view bookings' }, { status: 403 })
  }

  // Build query (fetch all for now)
  const supabaseAdmin = await createAdminClient()
  // Use const since query is not reassigned here
  const query = supabaseAdmin.from('bookings').select('*')
  // TODO: Add filtering based on searchParams later if needed

  const { data: bookings, error } = await query.order('start_time', { ascending: true })

  if (error) {
    console.error('Error fetching bookings:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(bookings)
}

// POST a new booking (Admin/Staff only)
export async function POST(request: Request) {
  const supabase = await createServerClient()
  const supabaseAdmin = await createAdminClient()

   // Check user authentication
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  // Check if user is admin or staff
  const { data: staffData, error: staffError } = await supabase
    .from('staff')
    .select('role')
    .eq('user_id', user.id)
    .single()

  if (staffError || !staffData || !['admin', 'staff'].includes(staffData.role || '')) {
    return NextResponse.json({ error: 'Forbidden: Requires admin or staff role to create bookings' }, { status: 403 })
  }

  // Parse request body
  let bookingData: { field_id: number; start_time: string; end_time: string; service_type?: string; status?: string; max_capacity?: number };
  try {
    const body = await request.json();
    if (!body.field_id || !body.start_time || !body.end_time) {
        throw new Error('Missing required fields: field_id, start_time, end_time');
    }

    const startTime = new Date(body.start_time);
    const endTime = new Date(body.end_time);

    if (isNaN(startTime.getTime()) || isNaN(endTime.getTime())) {
        throw new Error('Invalid date format for start_time or end_time');
    }
    if (endTime <= startTime) {
        throw new Error('End time must be after start time');
    }

    bookingData = {
        field_id: parseInt(body.field_id, 10),
        start_time: startTime.toISOString(), // Store as ISO string UTC
        end_time: endTime.toISOString(), // Store as ISO string UTC
        service_type: body.service_type,
        status: body.status || 'open', // Default status
        max_capacity: body.max_capacity ? parseInt(body.max_capacity, 10) : undefined
    };

     if (isNaN(bookingData.field_id)) {
       throw new Error('Invalid field_id');
     }
     if (bookingData.max_capacity !== undefined && isNaN(bookingData.max_capacity)) {
       throw new Error('Invalid max_capacity');
     }

  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : 'Invalid request body';
    return NextResponse.json({ error: errorMessage }, { status: 400 })
  }

  // Insert the new booking
  const { data: newBooking, error: insertError } = await supabaseAdmin
    .from('bookings')
    .insert(bookingData)
    .select()
    .single(); // Return the new booking

  if (insertError) {
    console.error('Error creating booking:', insertError)
    if (insertError.code === '23503') { // Foreign key violation
         return NextResponse.json({ error: `Invalid field_id: ${bookingData.field_id} does not exist.` }, { status: 400 });
    }
    // TODO: Add check for overlapping bookings later?
    return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  return NextResponse.json(newBooking, { status: 201 })
}