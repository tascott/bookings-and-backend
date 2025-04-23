import { NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/utils/supabase/server'

// GET available slots by calling the database function
export async function GET(request: Request) {
  const supabase = await createServerClient()
  const { searchParams } = new URL(request.url)

  // 1. Get and validate input parameters
  const serviceIdParam = searchParams.get('service_id')
  const startDateParam = searchParams.get('start_date') // Expecting YYYY-MM-DD
  const endDateParam = searchParams.get('end_date')     // Expecting YYYY-MM-DD

  if (!serviceIdParam || !startDateParam || !endDateParam) {
    return NextResponse.json({ error: 'Missing required query parameters: service_id, start_date, end_date' }, { status: 400 })
  }

  const serviceId = parseInt(serviceIdParam, 10);
  if (isNaN(serviceId)) {
      return NextResponse.json({ error: 'Invalid service_id format. Must be an integer.' }, { status: 400 });
  }

  // Basic date validation (consider using a library like date-fns for robust validation)
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(startDateParam) || !dateRegex.test(endDateParam)) {
      return NextResponse.json({ error: 'Invalid date format. Use YYYY-MM-DD.' }, { status: 400 });
  }

  const startDate = startDateParam;
  const endDate = endDateParam;

  // Optional: Add check if start_date is after end_date
  if (new Date(startDate) > new Date(endDate)) {
       return NextResponse.json({ error: 'start_date cannot be after end_date.' }, { status: 400 });
  }

  // 2. Check user authentication (optional but recommended for client-specific logic later)
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    // Allow unauthenticated access for now? Or require login?
    // For now, let's allow it, but log a warning or consider requiring auth.
    // console.warn('Accessing available slots without authentication.');
    // If auth is required: return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  // 3. Call the database function
  try {
    // Define the expected structure of a slot returned by the RPC
    // Ensure this matches the actual return type from your calculate_available_slots function
    type CalculatedSlot = {
        slot_field_id: number;
        slot_field_name: string;
        slot_start_time: string; // ISO String from TIMESTAMPTZ
        slot_end_time: string;   // ISO String from TIMESTAMPTZ
        slot_remaining_capacity: number;
    }

    // Explicitly type the expected return structure of the RPC call
    // Provide function name as first type argument, expected return as second
    const { data: slots, error: rpcError } = await supabase.rpc(
        'calculate_available_slots',
        {
          in_service_id: serviceId,
          in_start_date: startDate,
          in_end_date: endDate
        },
        { /* Optional: Add count option if needed */ }
      ).returns<CalculatedSlot[]>() // Use .returns<T>() method

    if (rpcError) {
      console.error('Error calling calculate_available_slots RPC:', rpcError);
      // Provide a generic error or more specific based on rpcError.code if needed
      return NextResponse.json({ error: `Database error calculating slots: ${rpcError.message}` }, { status: 500 })
    }

    // Add an explicit check if the returned data is an array before proceeding
    if (!Array.isArray(slots)) {
        // Log the unexpected non-array data (might be a Supabase error object)
        console.error('Unexpected data structure returned from RPC:', slots);
        // Return an error or an empty array, depending on desired behavior
        return NextResponse.json({ error: 'Invalid data received from slot calculation.' }, { status: 500 });
    }

    // Now TypeScript knows slots is definitely CalculatedSlot[] here
    const fetchedSlots: CalculatedSlot[] = slots;

    // 4. Filter out slots starting on the current date (UTC)
    const todayUTC = new Date().toISOString().split('T')[0]; // Get current date in YYYY-MM-DD format (UTC)

    // Explicitly type the parameter in the filter function
    const filteredSlots = fetchedSlots.filter((slot: CalculatedSlot) => {
        if (!slot || typeof slot.slot_start_time !== 'string') {
            // Add a check for safety, though RPC typing should help
            console.warn('Skipping invalid slot data:', slot);
            return false;
        }
        // Extract the date part from the slot's start time (assuming ISO string)
        const slotStartDate = slot.slot_start_time.split('T')[0];
        // Keep only slots where the start date is strictly AFTER today
        return slotStartDate > todayUTC;
    });


    // 5. Return the filtered results
    return NextResponse.json(filteredSlots); // Return the filtered array

  } catch (e) {
    console.error('Unexpected error in /api/available-slots:', e);
    const errorMessage = e instanceof Error ? e.message : 'An unknown server error occurred.';
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}