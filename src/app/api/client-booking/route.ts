import { NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import type { ServiceAvailability } from '@/types'; // Import shared type

// Define the structure expected from the DB function for a single slot - REMOVED as RPC is removed
/*
type SingleSlotCheckResult = {
    slot_field_id: number;
    slot_field_name: string;
    slot_start_time: string; // ISO string
    slot_end_time: string;   // ISO string
    slot_remaining_capacity: number;
}
*/

export async function POST(request: Request) {
    const supabase = await createServerClient();
    const supabaseAdmin = await createAdminClient();

    // 1. Authentication & Get Client ID
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    // Fetch the client ID associated with the authenticated user
    const { data: clientData, error: clientError } = await supabase
        .from('clients')
        .select('id, default_staff_id')
        .eq('user_id', user.id)
        .single();
    if (clientError || !clientData) {
        console.error('Error fetching client profile:', clientError);
        return NextResponse.json({ error: 'Client profile not found or error fetching it.' }, { status: 404 });
    }
    const clientId = clientData.id;

    // Fetch client details including default_staff_id
    const { data: fullClientData, error: fullClientError } = await supabase
        .from('clients')
        .select('id, default_staff_id')
        .eq('id', clientId)
        .single();

    if (fullClientError || !fullClientData) {
        console.error('Error fetching full client details:', fullClientError);
        return NextResponse.json({ error: 'Failed to fetch client details.' }, { status: 500 });
    }
    const defaultStaffId = fullClientData.default_staff_id; // Store the default staff ID

    // 2. Parse and Validate Input
    let inputData: {
        service_id: number;
        start_time: string;
        end_time: string;
        field_id?: number;
        pet_ids: number[]; // Added pet_ids
    };
    try {
        const body = await request.json();
        inputData = {
            service_id: parseInt(body.service_id, 10),
            start_time: body.start_time,
            end_time: body.end_time,
            field_id: body.field_id ? parseInt(body.field_id, 10) : undefined,
            pet_ids: body.pet_ids, // Get pet_ids from body
        };

        // --- Add Pet ID Validation ---
        if (!Array.isArray(inputData.pet_ids) || inputData.pet_ids.length === 0) {
            throw new Error('Missing or invalid required field: pet_ids (must be a non-empty array)');
        }
        // Ensure all pet IDs are numbers
        if (inputData.pet_ids.some(id => typeof id !== 'number' || isNaN(id))) {
             throw new Error('Invalid pet_id found in the pet_ids array. All IDs must be numbers.');
        }
        // -----------------------------

        if (isNaN(inputData.service_id) || !inputData.start_time || !inputData.end_time) {
            throw new Error('Missing or invalid required fields: service_id, start_time, end_time');
        }
        if (inputData.field_id !== undefined && isNaN(inputData.field_id)) {
            throw new Error('Invalid optional field_id format.');
        }
        // Validate that the received strings can be parsed into valid Dates
        if (isNaN(new Date(inputData.start_time).getTime()) || isNaN(new Date(inputData.end_time).getTime())) {
             throw new Error('Invalid start_time or end_time format. Could not parse date string.');
        }
        if (new Date(inputData.start_time) >= new Date(inputData.end_time)) {
            throw new Error('Start time must be before end time.');
        }

    } catch (e) {
        const errorMessage = e instanceof Error ? e.message : 'Invalid request body';
        return NextResponse.json({ error: errorMessage }, { status: 400 });
    }

    // 2.5 Validate Pet Ownership
    try {
        const { data: ownedPets, error: petCheckError } = await supabaseAdmin
            .from('pets')
            .select('id')
            .eq('client_id', clientId)
            .in('id', inputData.pet_ids);

        if (petCheckError) {
            console.error('Error validating pet ownership:', petCheckError);
            throw new Error('Could not verify pet ownership.');
        }

        // Check if the number of owned pets found matches the number submitted
        if (!ownedPets || ownedPets.length !== inputData.pet_ids.length) {
            return NextResponse.json({ error: 'Invalid pet selection: One or more selected pets do not belong to this client.' }, { status: 403 }); // Forbidden
        }
    } catch (e) {
         const errorMessage = e instanceof Error ? e.message : 'Error verifying pet ownership.';
         console.error('Pet ownership validation error:', e);
         return NextResponse.json({ error: errorMessage }, { status: 500 });
    }

    // 3. Fetch Service Details (to check requires_field_selection)
    const { data: serviceDetails, error: serviceError } = await supabaseAdmin
        .from('services')
        .select('name, requires_field_selection')
        .eq('id', inputData.service_id)
        .single();

    if (serviceError || !serviceDetails) {
        return NextResponse.json({ error: `Service with ID ${inputData.service_id} not found.` }, { status: 404 });
    }

    // 4. Validate the pets
    // a. Check if all pets belong to the client
    const { data: clientPets, error: clientPetsError } = await supabase
        .from('pets')
        .select('id, is_confirmed')
        .eq('client_id', clientId);

    if (clientPetsError) {
        console.error('Error fetching client pets:', clientPetsError);
        return NextResponse.json({ error: 'Failed to validate pet ownership' }, { status: 500 });
    }

    // Create a set of client's pet IDs for easy lookup
    const clientPetIds = new Set(clientPets.map(p => p.id));
    const clientPetMap = new Map(clientPets.map(p => [p.id, p]));

    // Check if all pet IDs in the request belong to this client
    const invalidPetIds = inputData.pet_ids.filter(id => !clientPetIds.has(id));
    if (invalidPetIds.length > 0) {
        return NextResponse.json(
            { error: `Pet IDs ${invalidPetIds.join(', ')} do not belong to this client` },
            { status: 400 }
        );
    }

    // b. Check if all pets are confirmed
    const unconfirmedPetIds = inputData.pet_ids
        .filter(id => clientPetMap.has(id) && !clientPetMap.get(id)?.is_confirmed);

    if (unconfirmedPetIds.length > 0) {
        return NextResponse.json(
            { error: `Pets with IDs ${unconfirmedPetIds.join(', ')} are not confirmed yet and cannot be booked` },
            { status: 400 }
        );
    }

    // --- NEW Section 5: Capacity Check & Field Determination ---
    let field_id_for_insert: number | null = null;
    // Use the imported type ServiceAvailability
    let availabilityRule: ServiceAvailability | undefined = undefined; // Define variable to hold the rule
    let staffUserIdForAssignment: string | null = null; // Variable to store staff user_id for insert
    let vehicleIdForAssignment: number | null = null; // Variable to store vehicle_id for insert

    try {
        const num_pets_requested = inputData.pet_ids.length;

        // 5a. Find the relevant active service_availability rule
        // This query needs to find a rule matching the service_id, that is active,
        // and whose time/day constraints match the requested booking time.
        const requestedStartTime = new Date(inputData.start_time);
        const requestedDayOfWeek = requestedStartTime.getUTCDay(); // 0=Sun, 1=Mon,... 6=Sat
        const requestedDate = inputData.start_time.split('T')[0];
        const requestedTime = requestedStartTime.toISOString().substring(11, 19); // HH:mm:ss

        // Fetch potentially matching rules first
        const { data: potentialRules, error: ruleFetchError } = await supabaseAdmin
            .from('service_availability')
            .select('*') // Select all columns needed
            .eq('service_id', inputData.service_id)
            .eq('is_active', true);

        if (ruleFetchError) throw new Error(`Error fetching availability rules: ${ruleFetchError.message}`);
        if (!potentialRules || potentialRules.length === 0) throw new Error('No active availability rules found for this service.');

        // Filter rules based on date/time/day matching
        availabilityRule = potentialRules.find(rule => {
            // Check specific date first
            if (rule.specific_date && rule.specific_date === requestedDate) {
                 // Check time overlap within the specific date rule
                return requestedTime >= rule.start_time && requestedTime < rule.end_time;
            }
            // Check recurring days if no specific date matches
            if (!rule.specific_date && rule.days_of_week && rule.days_of_week.includes(requestedDayOfWeek)) {
                 // Check time overlap within the recurring rule
                return requestedTime >= rule.start_time && requestedTime < rule.end_time;
            }
            return false; // No match
        });

        if (!availabilityRule) {
            throw new Error('No matching availability rule found for the requested date/time.');
        }

        // 5b. Calculate Max Effective Capacity based on the matched rule
        let max_effective_capacity = 0;
        if (availabilityRule.capacity_type === 'field') {
            if (!availabilityRule.field_ids || availabilityRule.field_ids.length === 0) {
                throw new Error('Availability rule with "field" capacity type has no associated field IDs.');
            }
            const { data: fieldsData, error: fieldCapError } = await supabaseAdmin
                .from('fields')
                .select('capacity')
                .in('id', availabilityRule.field_ids);

            if (fieldCapError) throw new Error(`Error fetching field capacities: ${fieldCapError.message}`);
            max_effective_capacity = fieldsData?.reduce((sum, field) => sum + (field.capacity || 0), 0) || 0;

        } else if (availabilityRule.capacity_type === 'staff_vehicle') {
            // --- Staff Vehicle Capacity Logic ---
            if (!defaultStaffId) {
                throw new Error('This service requires a default staff member assigned to your client profile, but none is set.');
            }

            // Fetch the default staff member's details (user_id, default_vehicle_id)
            const { data: staffDetails, error: staffError } = await supabaseAdmin
                .from('staff')
                .select('user_id, default_vehicle_id')
                .eq('id', defaultStaffId)
                .single();

            if (staffError || !staffDetails) {
                throw new Error(`Failed to fetch details for assigned staff member (ID: ${defaultStaffId}): ${staffError?.message}`);
            }
            if (!staffDetails.default_vehicle_id) {
                throw new Error(`Assigned staff member (ID: ${defaultStaffId}) does not have a default vehicle assigned.`);
            }
            if (!staffDetails.user_id) {
                 throw new Error(`Assigned staff member (ID: ${defaultStaffId}) does not have a user_id associated.`);
            }

            staffUserIdForAssignment = staffDetails.user_id; // Store for potential booking insert
            vehicleIdForAssignment = staffDetails.default_vehicle_id; // Store for potential booking insert

            // Check if the staff member is available according to staff_availability
            const { data: staffAvailability, error: staffAvailError } = await supabaseAdmin
                .from('staff_availability')
                .select('id') // Just need to know if a matching record exists
                .eq('staff_id', defaultStaffId)
                .eq('is_available', true)
                // Time check: requested slot must be within an available block
                .lte('start_time', requestedTime) // Available block starts before or at requested time
                .gte('end_time', requestedTime)   // Available block ends after requested time (exclusive end? Check rule insert)
                                                  // TODO: Refine time check for full overlap if needed (start < req_end && end > req_start)
                // Date/Day check
                .or(`specific_date.eq.${requestedDate},and(specific_date.is.null,days_of_week.cs.{${requestedDayOfWeek}})`)
                .limit(1);

            if (staffAvailError) {
                throw new Error(`Error checking staff availability: ${staffAvailError.message}`);
            }
            if (!staffAvailability || staffAvailability.length === 0) {
                throw new Error(`Assigned staff member (ID: ${defaultStaffId}) is not scheduled to work at the requested time.`);
            }

            // Fetch the vehicle's capacity
            const { data: vehicleData, error: vehicleCapError } = await supabaseAdmin
                .from('vehicles')
                .select('pet_capacity')
                .eq('id', staffDetails.default_vehicle_id)
                .single();

            if (vehicleCapError || !vehicleData) {
                throw new Error(`Failed to fetch capacity for vehicle (ID: ${staffDetails.default_vehicle_id}): ${vehicleCapError?.message}`);
            }

            max_effective_capacity = vehicleData.pet_capacity || 0;
            // --- End Staff Vehicle Capacity Logic ---
        } else {
            throw new Error(`Unknown capacity_type: ${availabilityRule.capacity_type}`);
        }

        // 5c. Calculate Current Booked Pet Count for the overlapping time
        // Find bookings that overlap the requested time slot based on resource (field/staff/vehicle - requires further refinement)
        let overlapQuery = supabaseAdmin
            .from('bookings')
            .select('id', { count: 'exact' }) // Select booking IDs and count
            .neq('status', 'cancelled') // Ignore cancelled bookings
            .lt('start_time', inputData.end_time) // Booking starts before requested slot ends
            .gt('end_time', inputData.start_time); // Booking ends after requested slot starts

        // Refine overlap check based on capacity type
        if (availabilityRule.capacity_type === 'field') {
            // Correctly check overlap against *all* fields associated with this rule
            if (availabilityRule.field_ids && availabilityRule.field_ids.length > 0) {
                overlapQuery = overlapQuery.in('field_id', availabilityRule.field_ids);
            } else {
                // This case should ideally be prevented by validation when creating/updating rules
                // If a rule has type 'field' but no field_ids, it's an invalid state.
                // Throw an error or handle as appropriate, perhaps assume 0 capacity or deny booking.
                console.error(`Availability rule ${availabilityRule.id} has type 'field' but no field_ids.`);
                throw new Error(`Configuration error: Availability rule for service is missing field assignments.`);
            }
            // NOTE: field_id_for_insert is determined *later* (step 5e) and is not relevant for calculating current booked count across all fields.
            /* --- REMOVED OLD LOGIC ---
            if (field_id_for_insert !== null) {
                 overlapQuery = overlapQuery.eq('field_id', field_id_for_insert);
            } else {
                 // If no specific field, check against any field in the rule? Or is field_id always non-null here?
                 console.warn('Overlap check for field capacity type with null field_id_for_insert - check logic');
                 // Potentially check overlap on *any* field linked to the rule?
                 // overlapQuery = overlapQuery.in('field_id', availabilityRule.field_ids);
            }
            */
        } else if (availabilityRule.capacity_type === 'staff_vehicle') {
            if (staffUserIdForAssignment) {
                 // Check bookings assigned to the same staff member
                 overlapQuery = overlapQuery.eq('assigned_staff_id', staffUserIdForAssignment);
                 // Alternatively, or additionally, check by vehicle_id if more robust?
                 // overlapQuery = overlapQuery.eq('vehicle_id', vehicleIdForAssignment);
            } else {
                 // Should not happen if defaultStaffId check passed earlier
                 throw new Error('Cannot check staff_vehicle overlap without an assigned staff member.');
            }
        }

        const { count: overlapCount, error: overlapError } = await overlapQuery;

        if (overlapError) throw new Error(`Error checking overlapping bookings: ${overlapError.message}`);

        let current_booked_pet_count = 0;
        // If overlapCount > 0, we need to sum pets from those bookings
        if (overlapCount && overlapCount > 0) {
             // Fetch the IDs of the overlapping bookings identified by the refined query
             // Re-run the query but select IDs instead of count
             const { data: overlappingBookingsData, error: overlapIdError } = await overlapQuery.select('id');
             if (overlapIdError) throw new Error(`Error fetching overlapping booking IDs: ${overlapIdError.message}`);

             const overlappingBookingIds = overlappingBookingsData?.map(b => b.id) || [];
             if (overlappingBookingIds.length > 0) {
                const { count: petCount, error: petCountError } = await supabaseAdmin
                    .from('booking_pets')
                    .select('*', { count: 'exact', head: true })
                    .in('booking_id', overlappingBookingIds);

                if (petCountError) throw new Error(`Error counting booked pets: ${petCountError.message}`);
                current_booked_pet_count = petCount || 0;
             }
        }

        // 5d. Perform Capacity Check
        const current_remaining_capacity = max_effective_capacity - current_booked_pet_count;

        if (num_pets_requested > current_remaining_capacity) {
            return NextResponse.json(
                { error: `Capacity exceeded. Requested ${num_pets_requested} pets, but only ${current_remaining_capacity} slots available (Max: ${max_effective_capacity}, Booked: ${current_booked_pet_count}).` },
                { status: 409 } // 409 Conflict
            );
        }

        // 5e. Determine field_id for insert
        if (availabilityRule.capacity_type === 'staff_vehicle') {
            field_id_for_insert = null;
        } else if (availabilityRule.capacity_type === 'field') {
             if (serviceDetails.requires_field_selection) {
                if (inputData.field_id === undefined) {
                     throw new Error('This service requires a specific field selection, but field_id was not provided.');
                 }
                 if (!availabilityRule.field_ids.includes(inputData.field_id)) {
                    throw new Error(`The selected field ID (${inputData.field_id}) is not valid for this availability rule.`);
                 }
                 field_id_for_insert = inputData.field_id;
             } else {
                // Doesn't require selection, assign first field from the rule
                field_id_for_insert = availabilityRule.field_ids[0] ?? null; // Default to null if array is somehow empty
             }
        } else {
             // Should not happen due to earlier check, but good practice
            field_id_for_insert = null;
        }

    } catch (e) {
        const errorMessage = e instanceof Error ? e.message : 'Error during capacity check or field assignment.';
        console.error('Capacity/Field Assignment Error:', e);
        return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
    // --- END NEW Section 5 ---

    // 6. Database Insert (Booking, Client Link, Pet Links)
    try {
        // --- Create Booking ---
        const { data: newBooking, error: bookingInsertError } = await supabaseAdmin
            .from('bookings')
            .insert({
                // Use the determined field_id_for_insert
                field_id: field_id_for_insert,
                service_type: serviceDetails.name, // CORRECT column, use fetched service name
                start_time: inputData.start_time,
                end_time: inputData.end_time,
                status: 'confirmed',
                assigned_staff_id: staffUserIdForAssignment, // Add assigned staff user ID
                vehicle_id: vehicleIdForAssignment, // Add assigned vehicle ID
                // is_paid default is FALSE in schema
                // max_capacity: null, // Let DB handle default or calculate if needed
            })
            .select('id')
            .single();

        if (bookingInsertError) {
            console.error('Error inserting booking:', bookingInsertError);
            // Check for specific errors if needed (e.g., unique constraint violation)
            throw new Error(`Failed to create booking: ${bookingInsertError.message}`);
        }

        if (!newBooking || !newBooking.id) {
             throw new Error('Failed to retrieve new booking ID after insert.');
        }

        const bookingId = newBooking.id;

        // --- Link Client ---
        const { error: bookingClientInsertError } = await supabaseAdmin
            .from('booking_clients')
            .insert({ booking_id: bookingId, client_id: clientId });

        if (bookingClientInsertError) {
            console.error('Error inserting booking_client link:', bookingClientInsertError);
            // Attempt to delete the booking record for better atomicity
            await supabaseAdmin.from('bookings').delete().eq('id', bookingId);
            throw new Error(`Booking created (ID: ${bookingId}) but failed to link to client: ${bookingClientInsertError.message}. Booking rollbacked.`);
        }

        // --- Link Pets (using booking_pets junction table) ---
        const petLinks = inputData.pet_ids.map(petId => ({
            booking_id: bookingId,
            pet_id: petId
        }));

        const { error: bookingPetsInsertError } = await supabaseAdmin
            .from('booking_pets')
            .insert(petLinks);

        if (bookingPetsInsertError) {
            console.error('Error inserting booking_pets links:', bookingPetsInsertError);
             // Attempt to delete booking and client link
            await supabaseAdmin.from('booking_clients').delete().eq('booking_id', bookingId);
            await supabaseAdmin.from('bookings').delete().eq('id', bookingId);
            throw new Error(`Booking and client link created but failed to link pets: ${bookingPetsInsertError.message}. Booking rollbacked.`);
        }

        // --- Success ---
        // Optionally fetch the full created booking data to return
         const { data: finalBooking, error: fetchFinalError } = await supabaseAdmin
            .from('bookings')
            .select('*') // Select desired fields
            .eq('id', bookingId)
            .single();

        if (fetchFinalError) {
             console.error('Failed to fetch final booking details, but booking likely succeeded:', fetchFinalError);
             // Return a minimal success response if fetching fails
             return NextResponse.json({ success: true, booking_id: bookingId, message: "Booking created, but failed to fetch final details." }, { status: 201 });
        }

        return NextResponse.json(finalBooking, { status: 201 }); // Return the created booking details

    } catch (e) {
        const errorMessage = e instanceof Error ? e.message : 'An unexpected error occurred during database operations.';
        console.error('Booking Insert/Link Error:', e);
        // Status code might depend on the error type (e.g., 409 if it was a constraint violation during insert)
        return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
}
// Note: Consider adding DELETE or PUT handlers if clients need to modify/cancel bookings
// Ensure proper authorization and business logic (e.g., cancellation deadlines)
