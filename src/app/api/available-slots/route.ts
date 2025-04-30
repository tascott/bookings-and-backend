import { NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
// import type { ServiceAvailability } from '@/types' // Import is no longer used

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

  // 2. Authentication & Fetch Client Default Staff ID
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  let clientDefaultStaffId: number | null = null;
  try {
      const { data: clientData, error: clientError } = await supabaseAdmin
        .from('clients')
        .select('default_staff_id')
        .eq('user_id', user.id)
        .maybeSingle(); // Use maybeSingle in case the user isn't a client yet

      if (clientError) throw clientError;
      if (!clientData) {
          // Handle case where authenticated user is not found in clients table (e.g., admin/staff)
          // For now, we'll proceed with null staff ID, RPC should handle this appropriately (e.g., return 0 staff capacity)
          console.warn(`User ${user.id} not found in clients table when fetching available slots.`);
      } else {
          clientDefaultStaffId = clientData.default_staff_id; // Can be null if not assigned
          if (!clientDefaultStaffId) {
               console.log(`Client associated with user ${user.id} has no default_staff_id assigned.`);
               // Proceed with null - RPC will need to handle this for staff-based capacity rules
          }
      }
  } catch (e) {
       console.error('Error fetching client default staff ID:', e);
       const message = e instanceof Error ? e.message : 'Failed to retrieve client information';
       return NextResponse.json({ error: message }, { status: 500 });
  }

  // --- MODIFICATION: Define type for fetched rules ---
  type FetchedAvailabilityRule = {
    id: number;
    days_of_week: number[] | null;
    specific_date: string | null;
    start_time: string; // HH:MM
    end_time: string;   // HH:MM
    override_price: number | null;
    use_staff_vehicle_capacity: boolean;
  }

  // 3. Fetch necessary data for pricing
  let serviceDefaultPrice: number | null = null;
  let availabilityRules: FetchedAvailabilityRule[] = []; // Use defined type
  try {
    // Fetch service default price
    const { data: serviceData, error: serviceError } = await supabaseAdmin
      .from('services')
      .select('default_price')
      .eq('id', serviceId)
      .maybeSingle();
    if (serviceError) throw serviceError;
    serviceDefaultPrice = serviceData?.default_price ?? null;
    console.log(`Service ${serviceId} default price: ${serviceDefaultPrice}`); // Log default price

    // Fetch potentially relevant active availability rules for the service
    const { data: rulesData, error: rulesError } = await supabaseAdmin
      .from('service_availability')
      .select('id, days_of_week, specific_date, start_time, end_time, override_price, use_staff_vehicle_capacity') // Select needed fields
      .eq('service_id', serviceId)
      .eq('is_active', true)
      // Basic filter: Fetch rules that *could* apply within the date range
      // More precise matching will happen in the mapping logic below
      .or(`specific_date.gte.${startDate},specific_date.is.null`)
      .or(`specific_date.lte.${endDate},specific_date.is.null`);

    if (rulesError) throw rulesError;
    availabilityRules = rulesData || [];
    console.log(`Fetched ${availabilityRules.length} active rules for service ${serviceId}`); // Log fetched rules count

  } catch (dbError) {
    console.error('Database error fetching service/availability rules:', dbError);
    const message = dbError instanceof Error ? dbError.message : 'Failed to load pricing rules';
    return NextResponse.json({ error: message }, { status: 500 });
  }

  // 4. Call the database function, passing the client's default staff ID
  try {
    // Define the expected structure of a slot returned by the RPC
    type CalculatedSlot = {
        slot_start_time: string; // ISO String from TIMESTAMPTZ
        slot_end_time: string;   // ISO String from TIMESTAMPTZ
        slot_remaining_capacity: number | null; // Allow null for infinite/staff-based
        rule_uses_staff_capacity: boolean;
        associated_field_ids: number[]; // Added
        zero_capacity_reason: string | null; // 'staff_full', 'no_staff', 'base_full', or null
    }

    const { data: slots, error: rpcError } = await supabase.rpc(
        'calculate_available_slots',
        {
          in_service_id: serviceId,
          in_start_date: startDate,
          in_end_date: endDate,
          in_client_default_staff_id: clientDefaultStaffId
        }
      ).returns<CalculatedSlot[]>()

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

    // 5. Process slots: Filter out today's slots, format capacity, and calculate price
    const todayUTC = new Date().toISOString().split('T')[0];
    const processedSlots = fetchedSlots
        .map(slot => {
            // --- MODIFICATION: Add Price Calculation Logic ---
            const slotStart = new Date(slot.slot_start_time);
            const slotDateStr = slot.slot_start_time.split('T')[0]; // YYYY-MM-DD
            const slotDayOfWeek = (slotStart.getUTCDay() + 6) % 7 + 1; // Monday=1, Sunday=7
            const slotStartTimeStr = slot.slot_start_time.split('T')[1].substring(0, 5); // HH:MM

            let slotPrice = serviceDefaultPrice ?? 0; // Start with default

            // Find best matching rule (specific date takes precedence over recurring)
            let bestMatchRule = null;
            // --- MODIFICATION: Add detailed logging inside rule loop ---
            console.log(`--- Checking rules for slot ${slot.slot_start_time} (Day ${slotDayOfWeek}, Date ${slotDateStr}, Time ${slotStartTimeStr}) ---`);
            for (const rule of availabilityRules) {
                console.log(`  Rule ${rule.id}: Start=${rule.start_time}, End=${rule.end_time}, Date=${rule.specific_date}, Days=${rule.days_of_week}, Price=${rule.override_price}, UsesStaffCap=${rule.use_staff_vehicle_capacity}`);
                // --- MODIFICATION: Truncate rule times to HH:MM ---
                const ruleStartTimeHHMM = rule.start_time.substring(0, 5);
                const ruleEndTimeHHMM = rule.end_time.substring(0, 5);
                // Check time overlap using truncated times
                const timeMatches = slotStartTimeStr >= ruleStartTimeHHMM && slotStartTimeStr < ruleEndTimeHHMM;
                console.log(`    Time comparison (${slotStartTimeStr} >= ${ruleStartTimeHHMM} && ${slotStartTimeStr} < ${ruleEndTimeHHMM}): ${timeMatches}`);
                // --- END MODIFICATION ---

                if (timeMatches) {
                    // Check specific date match
                    const specificDateMatches = rule.specific_date === slotDateStr;
                    console.log(`    Specific date comparison (${rule.specific_date} === ${slotDateStr}): ${specificDateMatches}`);
                    if (specificDateMatches) {
                        bestMatchRule = rule; // Exact date match is best
                        console.log(`    -> Best Match Found (Specific Date): Rule ${rule.id}`);
                        break; // Stop searching
                    }
                    // Check recurring day match (only if rule is not specific date)
                    const isRecurring = !rule.specific_date;
                    const dayMatches = isRecurring && rule.days_of_week?.includes(slotDayOfWeek);
                    console.log(`    Recurring day comparison (IsRecurring=${isRecurring}, Day=${slotDayOfWeek} in [${rule.days_of_week}]): ${dayMatches}`);
                    if (dayMatches) {
                         // Only update if no specific match was found earlier
                        if (!bestMatchRule || !bestMatchRule.specific_date) {
                             bestMatchRule = rule; // Recurring match
                             console.log(`    -> Match Found (Recurring Day): Rule ${rule.id}`);
                        }
                    }
                } else {
                     console.log(`    -> No Match (Time mismatch)`);
                }
            }
            // --- END MODIFICATION ---

            if (bestMatchRule && bestMatchRule.override_price !== null) {
                slotPrice = bestMatchRule.override_price;
                console.log(`Slot ${slot.slot_start_time}: Using override price ${slotPrice} from rule ${bestMatchRule.id}`);
            } else {
                 console.log(`Slot ${slot.slot_start_time}: Using default price ${slotPrice}`);
            }
            // --- END MODIFICATION ---

            return {
                start_time: slot.slot_start_time,
                end_time: slot.slot_end_time,
                remaining_capacity: slot.slot_remaining_capacity,
                uses_staff_capacity: slot.rule_uses_staff_capacity,
                field_ids: slot.associated_field_ids,
                price_per_pet: slotPrice, // Add the calculated price
                zero_capacity_reason: slot.zero_capacity_reason,
                // Add a simple capacity display string for UI
                capacity_display: slot.rule_uses_staff_capacity
                    ? (slot.slot_remaining_capacity !== null ? `${slot.slot_remaining_capacity} (Staff)` : 'Staff Limited - Check Booking') // Modified display
                    : (slot.slot_remaining_capacity !== null ? `${slot.slot_remaining_capacity}` : 'Unlimited')
            };
        })
        // --- MODIFICATION: Log filter values ---
        .filter(slot => {
            const slotDate = slot.start_time.split('T')[0];
            const isAfterToday = slotDate > todayUTC;
            console.log(`Filtering slot ${slot.start_time}: SlotDate=${slotDate}, TodayUTC=${todayUTC}, IsAfterToday=${isAfterToday}`);
            return isAfterToday;
        });
        // Original filter: .filter(slot => slot.start_time.split('T')[0] > todayUTC);
        // --- END MODIFICATION ---

    // 6. Return the processed slots
    return NextResponse.json(processedSlots);

  } catch (e) {
    console.error('Error processing or calling RPC for available slots:', e);
    const errorMessage = e instanceof Error ? e.message : 'An unknown server error occurred.';
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}