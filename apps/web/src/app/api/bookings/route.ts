import { NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'

// Define the final structure returned by the GET request
// Includes original booking data plus linked client and pet names
type EnrichedBooking = {
  id: number;
  booking_field_ids?: number[];
  start_time: string;
  end_time: string;
  service_type: string | null;
  status: string;
  max_capacity: number | null;
  created_at: string; // Assuming this exists on bookings table
  is_paid: boolean; // Add is_paid
  // Added fields
  client_id: number | null;
  client_name: string | null;
  pets?: { id: number; name: string }[]; // Changed from pet_names: string[]
}

// GET all bookings, enriching with client AND pet names
export async function GET(request: Request) {
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

  // Read query parameters
  const { searchParams } = new URL(request.url);
  const assignedStaffIdFilter = searchParams.get('assigned_staff_id');

  try {
    // 1. Fetch relevant bookings
    let bookingsQuery = supabaseAdmin
      .from('bookings')
      .select('*')
      .order('start_time', { ascending: false });

    // Apply filter if assigned_staff_id is provided
    if (assignedStaffIdFilter) {
      bookingsQuery = bookingsQuery.eq('assigned_staff_id', assignedStaffIdFilter);
    }

    const { data: bookingsData, error: bookingsError } = await bookingsQuery;

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
        .select('id, user_id, profiles(first_name, last_name)')
        .in('id', Array.from(clientIds));

      if (clientsError) {
           console.error("Error fetching clients:", clientsError); // Log specific error
           throw new Error(`Failed to fetch client details: ${clientsError.message}`);
      }

      // Populate client name map
      clientsData?.forEach(client => {
         // Handle profiles potentially being an array
         const profileData = Array.isArray(client.profiles) ? client.profiles[0] : client.profiles;
         // Combine first and last name from profileData
         const fullName = profileData ? [profileData.first_name, profileData.last_name].filter(Boolean).join(' ') : null;
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
            const petIdList = bookingPetMap.get(link.booking_id);
            if(petIdList) {
               petIdList.push(link.pet_id);
            }
            petIds.add(link.pet_id);
        }
    });
    // Fetch pet details (id and name)
    const petDetailsMap = new Map<number, { id: number; name: string }>(); // pet_id -> { id, name }
    if (petIds.size > 0) {
        const { data: petsData, error: petsError } = await supabaseAdmin
            .from('pets')
            .select('id, name') // Fetch id and name
            .in('id', Array.from(petIds));
        if (petsError) {
            console.error("Error fetching pets:", petsError);
            throw new Error(`Failed to fetch pet details: ${petsError.message}`);
        }
        petsData?.forEach(pet => {
            if (pet.id && pet.name) {
                 petDetailsMap.set(pet.id, { id: pet.id, name: pet.name });
            }
        });
    }
    // --- End Pet Data Fetching ---

    // 4. Merge ALL data into final response structure
    const processedBookings: EnrichedBooking[] = bookingsData.map(booking => {
      const clientId = bookingClientMap.get(booking.id);
      const clientName = clientId ? clientNameMap.get(clientId) : null;
      const linkedPetIds = bookingPetMap.get(booking.id) || [];
      // Map IDs to pet objects {id, name}, filter out any potential undefined results
      const pets = linkedPetIds
        .map(petId => petDetailsMap.get(petId))
        .filter((pet): pet is { id: number; name: string } => !!pet);

      return {
        // Spread existing booking fields (ensure EnrichedBooking matches)
        id: booking.id,
        booking_field_ids: booking.booking_field_ids,
        start_time: booking.start_time,
        end_time: booking.end_time,
        service_type: booking.service_type,
        status: booking.status,
        max_capacity: booking.max_capacity,
        created_at: booking.created_at,
        is_paid: booking.is_paid ?? false,
        client_id: clientId ?? null,
        client_name: clientName ?? null,
        pets: pets.length > 0 ? pets : undefined, // Set to undefined if no pets, to match optional type
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
  let bookingData: { booking_field_ids: number[]; start_time: string; end_time: string; service_type?: string; status?: string; max_capacity?: number };
  try {
    const body = await request.json();
    if (!Array.isArray(body.booking_field_ids) || body.booking_field_ids.length === 0 || !body.start_time || !body.end_time) {
        throw new Error('Missing required fields: booking_field_ids (must be a non-empty array), start_time, end_time');
    }
    // Validate all IDs in the array are numbers
    if (body.booking_field_ids.some((id: unknown) => typeof id !== 'number' || isNaN(id))) {
        throw new Error('Invalid booking_field_ids: Array must contain only numbers.');
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
        booking_field_ids: body.booking_field_ids,
        start_time: startTime.toISOString(), // Store as ISO string UTC
        end_time: endTime.toISOString(), // Store as ISO string UTC
        service_type: body.service_type,
        status: body.status || 'open', // Default status
        max_capacity: body.max_capacity ? parseInt(body.max_capacity, 10) : undefined
    };

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
    .select('id') // Select only the ID after insert
    .single();

  if (insertError) {
    console.error('Error creating booking:', insertError)
    if (insertError.code === '23503') { // Foreign key violation
         return NextResponse.json({ error: `Invalid booking_field_ids: ${bookingData.booking_field_ids.join(', ')} do not exist.` }, { status: 400 });
    }
    // TODO: Add check for overlapping bookings later?
    return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  return NextResponse.json(newBooking, { status: 201 })
}