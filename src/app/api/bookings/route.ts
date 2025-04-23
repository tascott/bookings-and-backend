import { NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'

// Define the final structure returned by the GET request
// Includes original booking data plus linked client and pet names
type EnrichedBooking = {
  id: number;
  field_id: number;
  start_time: string;
  end_time: string;
  service_type: string | null;
  status: string;
  max_capacity: number | null;
  created_at: string; // Assuming this exists on bookings table
  // Added fields
  client_id: number | null;
  client_name: string | null;
  pet_names: string[]; // Array of pet names for this booking
}

// GET all bookings, enriching with client AND pet names
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
    const { data: bookingsData, error: bookingsError } = await supabaseAdmin
      .from('bookings')
      .select('*')
      .order('start_time', { ascending: false });

    if (bookingsError) throw bookingsError;
    if (!bookingsData) {
      // Return empty array if no bookings found, not an error
      return NextResponse.json([]);
    }

    const bookingIds = bookingsData.map(b => b.id);

    // Map to store booking_id -> client_id
    const bookingClientMap = new Map<number, number>();
    // Set to store unique client_ids
    const clientIds = new Set<number>();

    // 2. Fetch relevant booking_client links if there are bookings
    if (bookingIds.length > 0) {
      const { data: clientLinksData, error: clientLinksError } = await supabaseAdmin
        .from('booking_clients')
        .select('booking_id, client_id') // Fetch only IDs
        .in('booking_id', bookingIds);

      if (clientLinksError) {
          console.error("Error fetching booking_clients:", clientLinksError); // Log specific error
          throw new Error(`Failed to fetch booking client links: ${clientLinksError.message}`);
      }

      // Populate map and set
      clientLinksData?.forEach(link => {
        if (link.booking_id && link.client_id) {
          bookingClientMap.set(link.booking_id, link.client_id);
          clientIds.add(link.client_id);
        }
      });
    }

    // Map to store client_id -> client_name
    const clientNameMap = new Map<number, string | null>();

    // 3. Fetch client names if there are linked clients
    if (clientIds.size > 0) {
      const { data: clientsData, error: clientsError } = await supabaseAdmin
        .from('clients')
        .select('id, first_name, last_name') // Fetch names
        .in('id', Array.from(clientIds)); // Query using unique client IDs

      if (clientsError) {
           console.error("Error fetching clients:", clientsError); // Log specific error
           throw new Error(`Failed to fetch client details: ${clientsError.message}`);
      }

      // Populate client name map
      clientsData?.forEach(client => {
         // Combine first and last name, handle nulls
         const fullName = [client.first_name, client.last_name].filter(Boolean).join(' ') || null;
         clientNameMap.set(client.id, fullName);
      });
    }

    // --- Pet Data Fetching (NEW) ---
    const bookingPetMap = new Map<number, number[]>(); // booking_id -> [pet_id, ...]
    const petIds = new Set<number>();
    // Fetch booking_pet links
    const { data: petLinksData, error: petLinksError } = await supabaseAdmin
        .from('booking_pets')
        .select('booking_id, pet_id')
        .in('booking_id', bookingIds);
    if (petLinksError) {
        console.error("Error fetching booking_pets:", petLinksError);
        throw new Error(`Failed to fetch booking pet links: ${petLinksError.message}`);
    }
    petLinksData?.forEach(link => {
        if (link.booking_id && link.pet_id) {
            if (!bookingPetMap.has(link.booking_id)) {
                bookingPetMap.set(link.booking_id, []);
            }
            // Add petId to the list for this booking
            const petIdList = bookingPetMap.get(link.booking_id);
            if(petIdList) { // Type guard
               petIdList.push(link.pet_id);
            }
            petIds.add(link.pet_id);
        }
    });
    // Fetch pet names
    const petNameMap = new Map<number, string>(); // pet_id -> name
    if (petIds.size > 0) {
        const { data: petsData, error: petsError } = await supabaseAdmin
            .from('pets')
            .select('id, name')
            .in('id', Array.from(petIds));
        if (petsError) {
            console.error("Error fetching pets:", petsError);
            throw new Error(`Failed to fetch pet details: ${petsError.message}`);
        }
        petsData?.forEach(pet => {
            if (pet.id && pet.name) { // Ensure name is not null/empty
                 petNameMap.set(pet.id, pet.name);
            }
        });
    }
    // --- End Pet Data Fetching ---

    // 4. Merge ALL data into final response structure
    const processedBookings: EnrichedBooking[] = bookingsData.map(booking => {
      const clientId = bookingClientMap.get(booking.id);
      const clientName = clientId ? clientNameMap.get(clientId) : null;
      // Get linked pet IDs, default to empty array if none found for this booking
      const linkedPetIds = bookingPetMap.get(booking.id) || [];
      // Map IDs to names, filter out any potential undefined results if a pet was deleted
      const petNames = linkedPetIds.map(petId => petNameMap.get(petId)).filter((name): name is string => !!name);

      return {
        // Spread existing booking fields (ensure EnrichedBooking matches)
        id: booking.id,
        field_id: booking.field_id,
        start_time: booking.start_time,
        end_time: booking.end_time,
        service_type: booking.service_type,
        status: booking.status,
        max_capacity: booking.max_capacity,
        created_at: booking.created_at, // Ensure this is selected in step 1 if needed
        // Add enriched data
        client_id: clientId ?? null,
        client_name: clientName ?? null,
        pet_names: petNames, // Add the pet names array
      };
    });

    return NextResponse.json(processedBookings);

  } catch (error: unknown) {
      // Log the specific error that was thrown
      console.error('Error processing bookings request:', error);
      const message = error instanceof Error ? error.message : 'An internal error occurred while fetching bookings';
      // Ensure status code matches error type if possible, default 500
      const status = (error instanceof Error && (error.message.includes('Forbidden') || error.message.includes('authenticated'))) ? 403 : 500;
      return NextResponse.json({ error: message }, { status });
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