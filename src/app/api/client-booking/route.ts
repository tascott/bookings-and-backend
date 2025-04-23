import { NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'

// Define the structure expected from the DB function for a single slot
// This might need adjustment based on the actual return type if not exactly matching CalculatedSlot
type SingleSlotCheckResult = {
    slot_field_id: number;
    slot_field_name: string;
    slot_start_time: string; // ISO string
    slot_end_time: string;   // ISO string
    slot_remaining_capacity: number;
}

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
        .select('id')
        .eq('user_id', user.id)
        .single();
    if (clientError || !clientData) {
        console.error('Error fetching client profile:', clientError);
        return NextResponse.json({ error: 'Client profile not found or error fetching it.' }, { status: 404 });
    }
    const clientId = clientData.id;

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

    // 4. Final Availability Check & Field Assignment
    let fieldToBook: number | null = null;
    try {
        // We need start/end *dates* for the DB function
        const checkStartDate = inputData.start_time.split('T')[0];
        const checkEndDate = inputData.end_time.split('T')[0]; // Usually the same day for one slot

        const { data: availableSlots, error: rpcError } = await supabase.rpc('calculate_available_slots', {
            in_service_id: inputData.service_id,
            in_start_date: checkStartDate,
            in_end_date: checkEndDate // Check only the specific date
        });

        if (rpcError) {
            throw new Error(`Database error checking availability: ${rpcError.message}`);
        }

        const matchingSlots: SingleSlotCheckResult[] = (availableSlots || [])
             // Filter the results from DB function for the *exact* time slot
             .filter((slot: SingleSlotCheckResult) =>
                 slot.slot_start_time === inputData.start_time &&
                 slot.slot_end_time === inputData.end_time &&
                 slot.slot_remaining_capacity > 0
             );

        if (matchingSlots.length === 0) {
            return NextResponse.json({ error: 'Sorry, this slot is no longer available.' }, { status: 409 }); // 409 Conflict
        }

        if (serviceDetails.requires_field_selection) {
            // Specific field booking: check if the requested field_id is in the available slots
            if (inputData.field_id === undefined) {
                throw new Error('This service requires a specific field selection.');
            }
            const specificFieldSlot = matchingSlots.find(slot => slot.slot_field_id === inputData.field_id);
            if (!specificFieldSlot) {
                return NextResponse.json({ error: 'Sorry, the selected field is no longer available for this time slot.' }, { status: 409 });
            }
            fieldToBook = specificFieldSlot.slot_field_id;
        } else {
            // Aggregated booking: assign the first available field from the matching slots
            fieldToBook = matchingSlots[0].slot_field_id; // Simple strategy: pick the first available
        }

    } catch (e) {
        const errorMessage = e instanceof Error ? e.message : 'Error verifying availability.';
        console.error('Availability check/assignment error:', e);
        return NextResponse.json({ error: errorMessage }, { status: 500 });
    }

    if (fieldToBook === null) { // Should theoretically not happen if logic above is sound
        return NextResponse.json({ error: 'Could not determine a field to book.' }, { status: 500 });
    }

    // 5. Database Insert (Booking, Client Link, Pet Links)
    try {
        // --- Create Booking ---
        const { data: newBooking, error: bookingInsertError } = await supabaseAdmin
            .from('bookings')
            .insert({
                field_id: fieldToBook,
                start_time: inputData.start_time,
                end_time: inputData.end_time,
                service_type: serviceDetails.name, // Store service name for simplicity, or use service_id
                status: 'confirmed',
                // max_capacity: null, // Or derive from rule/field?
            })
            .select('id')
            .single();

        if (bookingInsertError) {
            console.error('Error inserting booking:', bookingInsertError);
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
            // Potentially attempt to delete the booking record here for atomicity if needed
            throw new Error(`Booking created (ID: ${bookingId}) but failed to link to client: ${bookingClientInsertError.message}`);
        }

        // --- Link Pets (using booking_pets junction table) ---
        const petLinks = inputData.pet_ids.map(petId => ({ // Prepare rows for insert
            booking_id: bookingId,
            pet_id: petId
        }));

        // **** IMPORTANT: Requires `booking_pets` table to exist ****
        // **** Table Schema: id (pk), booking_id (fk->bookings.id), pet_id (fk->pets.id) ****
        const { error: bookingPetInsertError } = await supabaseAdmin
            .from('booking_pets') // Assumes table name is booking_pets
            .insert(petLinks);

        if (bookingPetInsertError) {
            console.error('Error inserting booking_pet links:', bookingPetInsertError);
            // CRITICAL: Ideally, rollback booking and booking_client inserts here.
            // Since true transactions aren't easy, log error and inform user of partial success.
            // Consider returning a specific error message indicating booking succeeded but pet linking failed.
             throw new Error(`Booking created (ID: ${bookingId}) and client linked, but failed to link pets: ${bookingPetInsertError.message}`);
        }
        // ---------------------------------------------------------

        // 6. Return Success Response
        return NextResponse.json({ success: true, bookingId: bookingId, message: 'Booking successful!' }, { status: 201 });

    } catch (e) {
        const errorMessage = e instanceof Error ? e.message : 'An unexpected error occurred during booking creation.';
        console.error('Booking creation error:', e);
        return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
}