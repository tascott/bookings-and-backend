import { NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'

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

    // --- NEW Section 5: Capacity Check & Field/Staff Assignment ---
    let field_id_for_insert: number | null = null;
    let assigned_staff_user_id: string | null = null;
    let assigned_vehicle_id: number | null = null;
    let available_field_id: number | null = null;

    try {
        const num_pets_requested = inputData.pet_ids.length;

        // 5a. Find the relevant active service_availability rule
        const requestedStartTime = new Date(inputData.start_time);
        const requestedDayOfWeek = requestedStartTime.getUTCDay();
        const requestedDate = inputData.start_time.split('T')[0];
        const requestedTimeStart = inputData.start_time.substring(11, 19);
        const requestedTimeEnd = inputData.end_time.substring(11, 19);

        // Fetch potentially matching rules first
        const { data: potentialRules, error: ruleFetchError } = await supabaseAdmin
            .from('service_availability')
            .select('*')
            .eq('service_id', inputData.service_id)
            .eq('is_active', true);

        if (ruleFetchError) throw new Error(`Error fetching availability rules: ${ruleFetchError.message}`);
        if (!potentialRules || potentialRules.length === 0) throw new Error('No active availability rules found for this service.');

        // Find the rule that fully contains the requested time slot
        const availabilityRule = potentialRules.find(rule => {
            // Check if the rule applies to the requested date/day
            const dateOrDayMatch = (
                (rule.specific_date && rule.specific_date === requestedDate) ||
                (!rule.specific_date && rule.days_of_week && rule.days_of_week.includes(requestedDayOfWeek))
            );
            if (!dateOrDayMatch) return false;

            // Check if the requested time slot is fully within the rule's time range
            return requestedTimeStart >= rule.start_time && requestedTimeEnd <= rule.end_time;
        });

        if (!availabilityRule) {
            throw new Error('No matching availability rule found for the requested date and time range.');
        }
        if (!availabilityRule.field_ids || availabilityRule.field_ids.length === 0) {
             // This should be prevented by the new check constraint, but good to double-check
             throw new Error(`Configuration error: Availability rule ${availabilityRule.id} is missing required field_ids.`);
        }

        // 5b. Determine Capacity & Perform Checks based on the rule's flag
        let max_effective_capacity = 0;
        let current_booked_pet_count = 0;

        // --- Scenario 1: Use Staff Vehicle Capacity ---
        if (availabilityRule.use_staff_vehicle_capacity) {
            console.log(`Rule ${availabilityRule.id} uses staff vehicle capacity.`);
            if (!defaultStaffId) {
                throw new Error('This service requires a default staff member assigned to your client profile, but none is set.');
            }
            const { data: staffDetails, error: staffError } = await supabaseAdmin
                .from('staff')
                .select('user_id, default_vehicle_id')
                .eq('id', defaultStaffId)
                .single();
            if (staffError || !staffDetails || !staffDetails.user_id || !staffDetails.default_vehicle_id) {
                throw new Error(`Failed to fetch details or missing info for assigned staff member (ID: ${defaultStaffId}).`);
            }
            assigned_staff_user_id = staffDetails.user_id;
            assigned_vehicle_id = staffDetails.default_vehicle_id;
            const { data: staffAvailability, error: staffAvailError } = await supabaseAdmin
                .from('staff_availability')
                .select('id')
                .eq('staff_id', defaultStaffId)
                .eq('is_available', true)
                .lte('start_time', requestedTimeStart)
                .gte('end_time', requestedTimeEnd)
                .or(`specific_date.eq.${requestedDate},and(specific_date.is.null,days_of_week.cs.{${requestedDayOfWeek}})`)
                .limit(1);
            if (staffAvailError) throw new Error(`Error checking staff availability: ${staffAvailError.message}`);
            if (!staffAvailability || staffAvailability.length === 0) {
                throw new Error(`Assigned staff member (ID: ${defaultStaffId}) is not scheduled as available for the entire duration requested.`);
            }
            const { data: vehicleData, error: vehicleCapError } = await supabaseAdmin
                .from('vehicles')
                .select('pet_capacity')
                .eq('id', assigned_vehicle_id)
                .single();
            if (vehicleCapError || !vehicleData) throw new Error(`Failed to fetch capacity for vehicle (ID: ${assigned_vehicle_id}).`);
            max_effective_capacity = vehicleData.pet_capacity || 0;

            // Check Overlapping Bookings for THIS STAFF MEMBER
            const { data: staffOverlaps, error: staffOverlapError } = await supabaseAdmin
                .from('bookings')
                .select('id, booking_pets(count)') // Select needed data
                .eq('assigned_staff_id', assigned_staff_user_id) // Filter by staff
                .lt('start_time', inputData.end_time) // Overlap time condition
                .gt('end_time', inputData.start_time) // Overlap time condition
                .neq('status', 'cancelled'); // Filter out cancelled

            if (staffOverlapError) throw new Error(`Error checking staff overlaps: ${staffOverlapError.message}`);
            // Explicitly type the reduce parameters
            current_booked_pet_count = staffOverlaps?.reduce((sum: number, booking: { booking_pets: { count: number }[] }) => sum + (booking.booking_pets[0]?.count || 0), 0) || 0;

            // Find an available field among the rule's fields
            // Check which fields are booked *at all* during the requested time by *any* service/staff
            const { data: bookedFieldsData, error: bookedFieldsError } = await supabaseAdmin
                .from('bookings')
                .select('field_id') // Need distinct field_id
                .in('field_id', availabilityRule.field_ids) // Filter by relevant fields
                .lt('start_time', inputData.end_time) // Overlap time condition
                .gt('end_time', inputData.start_time) // Overlap time condition
                .neq('status', 'cancelled'); // Filter out cancelled

            if (bookedFieldsError) throw new Error(`Error checking booked fields: ${bookedFieldsError.message}`);
            // Explicitly type map/filter parameter
            const bookedFieldIds = new Set(bookedFieldsData?.map((b: { field_id: number | null }) => b.field_id).filter((id): id is number => id !== null) || []);

            // Find the first field from the rule that is NOT in the bookedFieldIds set
            available_field_id = availabilityRule.field_ids.find((id: number) => !bookedFieldIds.has(id)) || null;
            if (available_field_id === null) {
                throw new Error('All suitable fields are already booked during the requested time, even though staff has capacity.');
            }
            field_id_for_insert = available_field_id;

        // --- Scenario 2: Use Field Capacity ---
        } else { // use_staff_vehicle_capacity is false
            console.log(`Rule ${availabilityRule.id} uses field capacity.`);
            // Capacity is now determined by the rule's base_capacity
            // If base_capacity is null, we treat it as effectively unlimited for this check
            // The check later will use the calculated current_booked_pet_count
            max_effective_capacity = availabilityRule.base_capacity ?? 9999; // Use a large number if base_capacity is null
            if (availabilityRule.base_capacity === null) {
                console.log(`Rule ${availabilityRule.id} has NULL base_capacity, treating as unlimited.`);
            }

            // Check Overlapping Bookings in ANY of the rule's fields
            const { data: fieldOverlaps, error: fieldOverlapError } = await supabaseAdmin
                .from('bookings')
                .select('id, booking_pets(count)') // Need pet count
                .in('field_id', availabilityRule.field_ids) // Filter by relevant fields
                .lt('start_time', inputData.end_time) // Overlap time condition
                .gt('end_time', inputData.start_time) // Overlap time condition
                .neq('status', 'cancelled'); // Filter out cancelled

            if (fieldOverlapError) throw new Error(`Error checking field overlaps: ${fieldOverlapError.message}`);
            current_booked_pet_count = fieldOverlaps?.reduce((sum: number, booking: { booking_pets: { count: number }[] }) => sum + (booking.booking_pets[0]?.count || 0), 0) || 0;

            // Determine field_id for insert (respecting client choice if service requires it)
            if (serviceDetails.requires_field_selection) {
                if (inputData.field_id === undefined) {
                    throw new Error('This service requires a specific field selection, but field_id was not provided.');
                }
                if (!availabilityRule.field_ids.includes(inputData.field_id)) {
                    throw new Error(`The selected field ID (${inputData.field_id}) is not valid for this availability rule.`);
                }
                field_id_for_insert = inputData.field_id;
            } else {
                // Simple approach: Assign to the first field in the rule.
                // TODO: Could enhance this to find the first field with specific remaining capacity if needed, based on base_capacity.
                field_id_for_insert = availabilityRule.field_ids[0];
            }
            assigned_staff_user_id = null;
            assigned_vehicle_id = null;
        }

        // 5c. Perform Final Capacity Check
        let current_remaining_capacity: number | null;
        if (availabilityRule.base_capacity === null && !availabilityRule.use_staff_vehicle_capacity) {
            // If base capacity is null (unlimited) and not using staff capacity, remaining is null (infinite)
            current_remaining_capacity = null;
        } else {
            // Otherwise calculate remaining based on the determined max and booked count
            current_remaining_capacity = max_effective_capacity - current_booked_pet_count;
        }

        // Check capacity ONLY if remaining capacity is not null (i.e., not unlimited)
        if (current_remaining_capacity !== null && num_pets_requested > current_remaining_capacity) {
            return NextResponse.json(
                { error: `Capacity exceeded. Requested ${num_pets_requested} pets, but only ${current_remaining_capacity} slots available (Based on ${availabilityRule.use_staff_vehicle_capacity ? 'staff vehicle' : 'rule base capacity'}). Max: ${max_effective_capacity}, Booked: ${current_booked_pet_count}).` },
                { status: 409 }
            );
        }

        // Ensure a field ID was determined for insertion
        if (field_id_for_insert === null) {
            throw new Error('Failed to determine a suitable field for the booking.');
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
                field_id: field_id_for_insert, // Use the determined field ID
                service_type: serviceDetails.name,
                start_time: inputData.start_time,
                end_time: inputData.end_time,
                status: 'confirmed',
                assigned_staff_id: assigned_staff_user_id, // Use determined staff (null if field-based)
                vehicle_id: assigned_vehicle_id,        // Use determined vehicle (null if field-based)
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
