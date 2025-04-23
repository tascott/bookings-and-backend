import { NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'

// GET all bookings, enriching with client names
export async function GET() {
  const supabase = await createServerClient()
  const supabaseAdmin = await createAdminClient()

  // Check auth & role (Admin/Staff)
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }
  const { data: staffData, error: staffError } = await supabase
    .from('staff')
    .select('role')
    .eq('user_id', user.id)
    .single()

  if (staffError || !staffData || !['admin', 'staff'].includes(staffData.role || '')) {
    return NextResponse.json({ error: 'Forbidden: Requires admin or staff role' }, { status: 403 })
  }

  try {
    // 1. Fetch all relevant bookings
    // TODO: Add pagination/date filtering later
    const { data: bookingsData, error: bookingsError } = await supabaseAdmin
      .from('bookings')
      .select('*')
      .order('start_time', { ascending: false });

    if (bookingsError) throw bookingsError;
    if (!bookingsData) throw new Error('Failed to fetch bookings.');

    // Extract booking IDs to fetch relevant client links
    const bookingIds = bookingsData.map(b => b.id);

    // 2. Fetch relevant booking_client links and associated client names
    const clientLinksMap = new Map<number, { clientId: number; clientName: string | null }>();

    if (bookingIds.length > 0) {
      const { data: clientLinksData, error: clientLinksError } = await supabaseAdmin
        .from('booking_clients')
        .select(`
          booking_id,
          client_id,
          clients ( id, name )
        `)
        .in('booking_id', bookingIds);

      if (clientLinksError) throw clientLinksError;

      // 3. Create a map for easy lookup: booking_id -> client info
      clientLinksData?.forEach(link => {
          // Linter might still infer clients as array, handle it
          const clientInfo = Array.isArray(link.clients) ? link.clients[0] : link.clients;
          if (link.booking_id) {
              clientLinksMap.set(link.booking_id, {
                  clientId: link.client_id,
                  clientName: clientInfo?.name ?? null
              });
          }
      });
    }

    // 4. Merge client info into bookings data
    const processedBookings = bookingsData.map(booking => {
      const clientInfo = clientLinksMap.get(booking.id);
      return {
        ...booking,
        client_id: clientInfo?.clientId,
        client_name: clientInfo?.clientName,
      };
    });

    return NextResponse.json(processedBookings);

  } catch (error: unknown) {
      console.error('Error fetching enriched bookings:', error);
      const message = error instanceof Error ? error.message : 'Failed to fetch bookings';
      return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST a new booking (Admin/Staff Manual Creation)
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