import { NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import type { ServiceAvailability } from '@/types'

// GET available slots by calling the database function and adding pricing
export async function GET(request: Request) {
  const supabase = await createServerClient()
  const supabaseAdmin = await createAdminClient() // Use admin client for potentially needed table reads
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

  // 3. Fetch necessary data: Service default price and Relevant Availability Rules
  let serviceDefaultPrice: number | null = null;
  let availabilityRules: ServiceAvailability[] = []; // Use imported type

  try {
    // Fetch service default price
    const { data: serviceData, error: serviceError } = await supabaseAdmin
      .from('services')
      .select('default_price')
      .eq('id', serviceId)
      .maybeSingle(); // Use maybeSingle to handle service not found gracefully

    if (serviceError) throw serviceError;
    serviceDefaultPrice = serviceData?.default_price ?? null;

    // Fetch potentially relevant active availability rules for the service and date range
    // We fetch rules here to access override_price, even though RPC calculates slots
    const { data: rulesData, error: rulesError } = await supabaseAdmin
      .from('service_availability')
      .select('*') // Select all columns to match the type
      .eq('service_id', serviceId)
      .eq('is_active', true)
      // Add date range filter (needs careful logic for recurring vs specific)
      // This basic filter might fetch more than needed but ensures we don't miss rules
      .or(`specific_date.gte.${startDate},specific_date.is.null`)
      .or(`specific_date.lte.${endDate},specific_date.is.null`);

    if (rulesError) throw rulesError;
    availabilityRules = rulesData || [];

  } catch (dbError) {
    console.error('Database error fetching service/availability rules:', dbError);
    const message = dbError instanceof Error ? dbError.message : 'Failed to load pricing rules';
    return NextResponse.json({ error: message }, { status: 500 });
  }

  // 4. Call the database function
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

    // 5. Process slots: Add price and filter out today's slots
    const todayUTC = new Date().toISOString().split('T')[0];
    const processedSlots = fetchedSlots
        .map(slot => {
            // Find the matching availability rule to determine price
            // This matching logic needs to be robust (time, date/day, field)
            // For simplicity now, we assume a direct match based on time/field is sufficient
            // WARNING: This requires the RPC to ideally return the originating rule ID
            // or requires complex matching here based on slot time/field against fetched rules.
            // Placeholder: Assume we can find the rule (NEEDS REFINEMENT)
            const rule = availabilityRules.find(r =>
                r.field_ids.includes(slot.slot_field_id) &&
                // Basic time match (ignoring date/day for now - needs improvement)
                r.start_time === slot.slot_start_time.split('T')[1].substring(0, 8) &&
                r.end_time === slot.slot_end_time.split('T')[1].substring(0, 8)
            );

            const pricePerPet = rule?.override_price ?? serviceDefaultPrice ?? 0; // Default to 0 if no prices set

            return {
                ...slot,
                price_per_pet: pricePerPet
            };
        })
        .filter(slot => slot.slot_start_time.split('T')[0] > todayUTC);

    // 6. Return the processed slots
    return NextResponse.json(processedSlots);

  } catch (e) {
    console.error('Error processing or calling RPC for available slots:', e);
    const errorMessage = e instanceof Error ? e.message : 'An unknown server error occurred.';
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}