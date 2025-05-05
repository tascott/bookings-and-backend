import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { toZonedTime, format } from 'date-fns-tz'; // Corrected import name

export async function POST(request: Request) {
    const supabase = await createClient();
    const supabaseAdmin = await createAdminClient();

    // 1. Check Auth & Role (Admin Only)
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    const { data: staffData, error: staffError } = await supabase
        .from('staff')
        .select('role')
        .eq('user_id', user.id)
        .single();

    // --- MODIFICATION: Restrict to Admin only ---
    if (staffError || !staffData || staffData.role !== 'admin') {
        return NextResponse.json({ error: 'Forbidden: Requires admin role' }, { status: 403 });
    }

    // 2. Parse and Validate Input
    let inputData: {
        client_id: number;
        pet_ids: number[];
        service_id: number;
        start_time: string;
        end_time: string;
    };
    try {
        const body = await request.json();
        inputData = {
            client_id: parseInt(body.client_id, 10),
            pet_ids: body.pet_ids,
            service_id: parseInt(body.service_id, 10),
            start_time: body.start_time,
            end_time: body.end_time,
        };

        if (isNaN(inputData.client_id) || isNaN(inputData.service_id))
             throw new Error('Invalid client_id or service_id.');
        if (!Array.isArray(inputData.pet_ids) || inputData.pet_ids.length === 0)
             throw new Error('pet_ids must be a non-empty array.');
        if (inputData.pet_ids.some((id: unknown) => typeof id !== 'number' || isNaN(id)))
             throw new Error('Invalid pet_id found in the pet_ids array.');
        if (!inputData.start_time || !inputData.end_time || isNaN(new Date(inputData.start_time).getTime()) || isNaN(new Date(inputData.end_time).getTime()))
             throw new Error('Invalid start_time or end_time format.');
        if (new Date(inputData.start_time) >= new Date(inputData.end_time))
             throw new Error('Start time must be before end time.');

    } catch (e) {
        const errorMessage = e instanceof Error ? e.message : 'Invalid request body';
        return NextResponse.json({ error: errorMessage }, { status: 400 });
    }

    // 3. Validate Client Exists & Pet Ownership
    try {
        const { data: clientExists, error: clientCheckError } = await supabaseAdmin
            .from('clients')
            .select('id, default_staff_id') // Also fetch default_staff_id
            .eq('id', inputData.client_id)
            .single();
        if (clientCheckError || !clientExists) {
            throw new Error(`Client with ID ${inputData.client_id} not found.`);
        }

        const { data: ownedPets, error: petCheckError } = await supabaseAdmin
            .from('pets')
            .select('id') // Only select ID for existence check
            .eq('client_id', inputData.client_id)
            .in('id', inputData.pet_ids);

        if (petCheckError) throw new Error('Could not verify pet ownership.');
        if (!ownedPets || ownedPets.length !== inputData.pet_ids.length) {
            throw new Error('One or more selected pets do not belong to the specified client.');
        }
        // --- Removed check for inactive/unconfirmed pets for admin booking ---
        // const inactiveOrUnconfirmedPets = ownedPets.filter(p => !p.is_active || !p.is_confirmed);
        // if (inactiveOrUnconfirmedPets.length > 0) {
        //      throw new Error(`One or more selected pets are inactive or unconfirmed: ${inactiveOrUnconfirmedPets.map(p => p.id).join(', ')}`);
        // }

        const defaultStaffId = clientExists.default_staff_id;

    // 4. Find Service Availability Rule & Determine Fields/Staff/Vehicle
        const { data: serviceDetails, error: serviceError } = await supabaseAdmin
            .from('services')
            .select('name')
            .eq('id', inputData.service_id)
            .single();
        if (serviceError || !serviceDetails) {
            throw new Error(`Service with ID ${inputData.service_id} not found.`);
        }

        // --- MODIFICATION: Convert times to London timezone before extracting parts ---
        const londonTimeZone = 'Europe/London';
        const requestedStartTimeUTC = new Date(inputData.start_time);
        const requestedEndTimeUTC = new Date(inputData.end_time);

        const requestedStartTimeLondon = toZonedTime(requestedStartTimeUTC, londonTimeZone);
        // We only need the start time to determine the date and day for rule matching
        // const requestedEndTimeLondon = toZonedTime(requestedEndTimeUTC, londonTimeZone);

        const requestedDayOfWeekLondon = parseInt(format(requestedStartTimeLondon, 'i', { timeZone: londonTimeZone })); // ISO day of week (1=Mon, 7=Sun)
        const requestedDateLondon = format(requestedStartTimeLondon, 'yyyy-MM-dd', { timeZone: londonTimeZone });
        const requestedTimeStartLondon = format(requestedStartTimeLondon, 'HH:mm:ss', { timeZone: londonTimeZone });
        const requestedTimeEndLondon = format(requestedEndTimeUTC, 'HH:mm:ss', { timeZone: londonTimeZone }); // Use original UTC end time for consistency? Or London? Let's stick to London for comparison.
        // --- END MODIFICATION ---

        // Fetch potentially matching rules
        const { data: potentialRules, error: ruleFetchError } = await supabaseAdmin
            .from('service_availability')
            .select('id, field_ids, use_staff_vehicle_capacity, start_time, end_time, specific_date, days_of_week')
            .eq('service_id', inputData.service_id)
            .eq('is_active', true);

        if (ruleFetchError) throw new Error(`Error fetching availability rules: ${ruleFetchError.message}`);
        if (!potentialRules || potentialRules.length === 0) throw new Error('No active availability rules found for this service.');

        // Find the exact rule matching date/time (using London time parts)
        const availabilityRule = potentialRules.find(rule => {
             // --- MODIFICATION: Compare using London date/day ---
            const dateOrDayMatch = (
                (rule.specific_date && rule.specific_date === requestedDateLondon) ||
                (!rule.specific_date && rule.days_of_week && rule.days_of_week.includes(requestedDayOfWeekLondon))
            );
            if (!dateOrDayMatch) {
                 console.log(`Admin Booking Rule ${rule.id} Skipped: Date/Day mismatch (Rule Date: ${rule.specific_date}, Rule Days: ${rule.days_of_week}, Req London Date: ${requestedDateLondon}, Req London Day: ${requestedDayOfWeekLondon})`);
                 return false;
            }
             // --- END MODIFICATION ---

             // --- MODIFICATION: Compare using London time ---
            // Check time match: requested slot should be within the rule's time
            // Assuming rule times are stored as HH:MM or HH:MM:SS
             const ruleStartTime = rule.start_time.length === 5 ? rule.start_time + ':00' : rule.start_time;
             const ruleEndTime = rule.end_time.length === 5 ? rule.end_time + ':00' : rule.end_time;
             const timeMatch = requestedTimeStartLondon >= ruleStartTime && requestedTimeEndLondon <= ruleEndTime;
            if (!timeMatch) {
                 console.log(`Admin Booking Rule ${rule.id} Skipped: Time mismatch (Rule Start: ${ruleStartTime}, Rule End: ${ruleEndTime}, Req London Start: ${requestedTimeStartLondon}, Req London End: ${requestedTimeEndLondon})`);
                return false;
            }
             // --- END MODIFICATION ---
             console.log(`Admin Booking Rule ${rule.id} Matched.`);
            return true;
        });

        if (!availabilityRule) {
            throw new Error('No matching availability rule found for the requested service, date, and time range.');
        }
        if (!availabilityRule.field_ids || availabilityRule.field_ids.length === 0) {
             throw new Error(`Configuration error: Availability rule ${availabilityRule.id} is missing required field_ids.`);
        }

        const booking_field_ids_for_insert: number[] = availabilityRule.field_ids;
        let assigned_staff_user_id: string | null = null;
        let assigned_vehicle_id: number | null = null;

        // Determine assigned staff/vehicle IF the rule requires it
        if (availabilityRule.use_staff_vehicle_capacity) {
            if (!defaultStaffId) {
                console.warn(`Admin Booking Warning: Rule ${availabilityRule.id} uses staff capacity, but client ${inputData.client_id} has no default staff assigned. Booking will proceed without staff assignment.`);
            } else {
                const { data: staffDetails, error: staffQueryError } = await supabaseAdmin
                    .from('staff')
                    .select('user_id, default_vehicle_id')
                    .eq('id', defaultStaffId)
                    .single();

                if (staffQueryError || !staffDetails) {
                     console.warn(`Admin Booking Warning: Could not fetch details for default staff ID ${defaultStaffId}. Booking proceeding without staff assignment.`);
                } else if (!staffDetails.user_id || !staffDetails.default_vehicle_id) {
                     console.warn(`Admin Booking Warning: Default staff ID ${defaultStaffId} is missing user_id or default_vehicle_id. Booking proceeding without staff assignment.`);
                } else {
                    assigned_staff_user_id = staffDetails.user_id;
                    assigned_vehicle_id = staffDetails.default_vehicle_id;
                    // Optional: Check if staff is actually *available* via staff_availability
                    // For admin booking, we might skip this check to allow overrides, or just log a warning.
                    // Let's skip the availability check for now to allow override.
                    console.log(`Admin Booking: Assigning staff user ${assigned_staff_user_id} and vehicle ${assigned_vehicle_id} based on client default.`);
                }
            }
        }

    // 5. Database Insert (No Capacity Check for Admin)
        // --- Create Booking ---
        const { data: newBooking, error: bookingInsertError } = await supabaseAdmin
            .from('bookings')
            .insert({
                booking_field_ids: booking_field_ids_for_insert,
                service_type: serviceDetails.name,
                start_time: inputData.start_time,
                end_time: inputData.end_time,
                status: 'confirmed', // Or maybe 'admin_booked'?
                assigned_staff_id: assigned_staff_user_id,
                vehicle_id: assigned_vehicle_id,
                // Admin bookings are likely not paid initially
                is_paid: false,
            })
            .select('id')
            .single();

        if (bookingInsertError) throw new Error(`Booking insert failed: ${bookingInsertError.message}`);
        if (!newBooking || !newBooking.id) throw new Error('Failed to retrieve new booking ID.');

        const bookingId = newBooking.id;

        // --- Link Client ---
        const { error: bookingClientInsertError } = await supabaseAdmin
            .from('booking_clients')
            .insert({ booking_id: bookingId, client_id: inputData.client_id });

        if (bookingClientInsertError) {
            await supabaseAdmin.from('bookings').delete().eq('id', bookingId); // Rollback
            throw new Error(`Failed to link client: ${bookingClientInsertError.message}. Booking rollbacked.`);
        }

        // --- Link Pets ---
        const petLinks = inputData.pet_ids.map(petId => ({ booking_id: bookingId, pet_id: petId }));
        const { error: bookingPetsInsertError } = await supabaseAdmin
            .from('booking_pets')
            .insert(petLinks);

        if (bookingPetsInsertError) {
            await supabaseAdmin.from('booking_clients').delete().eq('booking_id', bookingId); // Rollback
            await supabaseAdmin.from('bookings').delete().eq('id', bookingId); // Rollback
            throw new Error(`Failed to link pets: ${bookingPetsInsertError.message}. Booking rollbacked.`);
        }

        // --- Success ---
        // Optionally fetch the full created booking data to return
        const { data: finalBooking, error: fetchFinalError } = await supabaseAdmin
            .from('bookings')
            .select('*')
            .eq('id', bookingId)
            .single();

        if (fetchFinalError) {
             console.error('Failed to fetch final booking details, but booking created:', fetchFinalError);
             return NextResponse.json({ success: true, booking_id: bookingId, message: "Booking created, but failed to fetch final details." }, { status: 201 });
        }

        return NextResponse.json(finalBooking, { status: 201 });

    } catch (e) {
        const errorMessage = e instanceof Error ? e.message : 'An unexpected error occurred.';
        console.error('Admin Booking Error:', e);
        return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
}