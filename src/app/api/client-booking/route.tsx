import { NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';

// --- Email Imports ---
import { render } from '@react-email/render';
import { sendEmail } from '@/utils/sendEmail';
import BookingConfirmationClient from '@/emails/BookingConfirmationClient';
import BookingConfirmationAdmin from '@/emails/BookingConfirmationAdmin';
// ---------------------

export async function POST(request: Request) {
	const supabase = await createServerClient();
	const supabaseAdmin = await createAdminClient();

	// 1. Authentication & Get Client/User Info
	const {
		data: { user },
		error: authError,
	} = await supabase.auth.getUser();
	if (authError || !user || !user.email) { // Ensure email exists
		return NextResponse.json({ error: 'Not authenticated or missing user email' }, { status: 401 });
	}
	// Fetch client ID and default staff ID
	const { data: clientData, error: clientError } = await supabase
        .from('clients')
        .select('id, default_staff_id')
        .eq('user_id', user.id)
        .single();
	if (clientError || !clientData) {
		console.error('Error fetching client data:', clientError);
		return NextResponse.json({ error: 'Client not found or error fetching it.' }, { status: 404 });
	}
    // Fetch profile info (first name)
    const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('first_name')
        .eq('id', user.id) // Assuming profile ID matches user ID
        .single();
    if (profileError) {
        console.error('Error fetching profile data:', profileError);
        // Don't fail the request, just use a default name
    }

	const clientId = clientData.id;
    const defaultStaffId = clientData.default_staff_id;
    const clientFirstName = profileData?.first_name || 'Valued Customer'; // Use fetched name or default
    const clientEmail = user.email; // Use email from auth user

    // Remove previous client/profile fetching logic
	// const { data: clientProfileData, error: clientProfileError } = await supabase...
    // let clientFirstName = 'Valued Customer'; // Default
    // if (clientProfileData.profiles && !Array.isArray(clientProfileData.profiles)) {
    //     clientFirstName = clientProfileData.profiles.first_name || clientFirstName;
    // }

	// 2. Parse and Validate Input
	let inputData: {
		service_id: number;
		start_time: string;
		end_time: string;
		pet_ids: number[];
	};
	try {
		const body = await request.json();
		inputData = {
			service_id: parseInt(body.service_id, 10),
			start_time: body.start_time,
			end_time: body.end_time,
			pet_ids: body.pet_ids,
		};

		// --- Add Pet ID Validation ---
		if (!Array.isArray(inputData.pet_ids) || inputData.pet_ids.length === 0) {
			throw new Error('Missing or invalid required field: pet_ids (must be a non-empty array)');
		}
		// Ensure all pet IDs are numbers
		if (inputData.pet_ids.some((id) => typeof id !== 'number' || isNaN(id))) {
			throw new Error('Invalid pet_id found in the pet_ids array. All IDs must be numbers.');
		}
		// -----------------------------

		if (isNaN(inputData.service_id) || !inputData.start_time || !inputData.end_time) {
			throw new Error('Missing or invalid required fields: service_id, start_time, end_time');
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

    // 2.5 Validate Pet Ownership & Fetch Pet Names
    let petNames: string[] = [];
	try {
		const { data: ownedPetsData, error: petCheckError } = await supabaseAdmin
			.from('pets')
			.select('id, name, is_confirmed') // Select name and confirmation status
			.eq('client_id', clientId)
			.in('id', inputData.pet_ids);

		if (petCheckError) {
			console.error('Error validating/fetching pets:', petCheckError);
			throw new Error('Could not verify/fetch pets.');
		}

		if (!ownedPetsData || ownedPetsData.length !== inputData.pet_ids.length) {
            const foundIds = ownedPetsData?.map(p => p.id) || [];
            const missingIds = inputData.pet_ids.filter(id => !foundIds.includes(id));
			return NextResponse.json({ error: `Invalid pet selection: Pet(s) with ID(s) ${missingIds.join(', ')} not found or do not belong to this client.` }, { status: 403 });
		}

        // Check confirmation status again here just to be safe
        const unconfirmedPets = ownedPetsData.filter(p => !p.is_confirmed);
        if (unconfirmedPets.length > 0) {
            return NextResponse.json(
                { error: `Pets ${unconfirmedPets.map(p => p.name).join(', ')} are not confirmed yet and cannot be booked` },
                { status: 400 }
            );
        }

        petNames = ownedPetsData.map(p => p.name);

	} catch (e) {
        // ... error handling ...
        // TEMP - replace with actual handling if needed
        const errorMessage = e instanceof Error ? e.message : 'Error verifying pet ownership or confirmation status.';
		console.error('Pet validation/fetch error:', e);
		return NextResponse.json({ error: errorMessage }, { status: 500 });
	}

    // Remove redundant pet validation section (steps 4a, 4b)
    // const { data: clientPets, error: clientPetsError } = ...

    // 3. Fetch Service Details (Need this for email and potentially for rule logic)
    const { data: serviceDetails, error: serviceError } = await supabaseAdmin
        .from('services')
        .select('id, name')
        .eq('id', inputData.service_id)
        .single();

    if (serviceError || !serviceDetails) {
        return NextResponse.json({ error: `Service with ID ${inputData.service_id} not found.` }, { status: 404 });
    }

	// --- UPDATED Section 5: Capacity Check & Field Assignment ---
	let booking_field_ids_for_insert: number[] = []; // Changed to array
	let assigned_staff_user_id: string | null = null;
	let assigned_vehicle_id: number | null = null;

	try {
		const num_pets_requested = inputData.pet_ids.length;

		// 5a. Find the relevant active service_availability rule
		// Convert incoming timestamp to Europe/London time
		const requestedStartLondon = new Date(new Date(inputData.start_time).toLocaleString('en-US', { timeZone: 'Europe/London' }));
		const requestedEndLondon = new Date(new Date(inputData.end_time).toLocaleString('en-US', { timeZone: 'Europe/London' }));

		// Get date, day, and time parts in Europe/London timezone
		const requestedDayOfWeekLondon = requestedStartLondon.getDay(); // Sunday = 0, Monday = 1, ..., Saturday = 6
		// Adjust to match ISODOW (Monday=1, Sunday=7) if your DB uses that
		const requestedIsoDayOfWeekLondon = requestedDayOfWeekLondon === 0 ? 7 : requestedDayOfWeekLondon;
		const requestedDateLondon = requestedStartLondon.toISOString().split('T')[0]; // YYYY-MM-DD in London
		const requestedTimeStartLondon = requestedStartLondon.toTimeString().split(' ')[0]; // HH:MM:SS in London
		const requestedTimeEndLondon = requestedEndLondon.toTimeString().split(' ')[0]; // HH:MM:SS in London

		console.log(
			`[Client Booking API] Request Parsed (London Time): Date=${requestedDateLondon}, Day=${requestedIsoDayOfWeekLondon}, Start=${requestedTimeStartLondon}, End=${requestedTimeEndLondon}`
		);

		// Fetch potentially matching rules first
		const { data: potentialRules, error: ruleFetchError } = await supabaseAdmin
			.from('service_availability')
			.select('*') // Select all needed fields
			.eq('service_id', inputData.service_id)
			.eq('is_active', true);

		if (ruleFetchError) throw new Error(`Error fetching availability rules: ${ruleFetchError.message}`);
		if (!potentialRules || potentialRules.length === 0) throw new Error('No active availability rules found for this service.');

		// Find the rule that fully contains the requested time slot (using London time)
		const availabilityRule = potentialRules.find((rule) => {
			// Check if the rule applies to the requested date/day (using London date/day)
			const dateOrDayMatch =
				(rule.specific_date && rule.specific_date === requestedDateLondon) ||
				(!rule.specific_date && rule.days_of_week && rule.days_of_week.includes(requestedIsoDayOfWeekLondon)); // Use adjusted London day
			if (!dateOrDayMatch) {
				console.log(
					`Rule ${rule.id} skipped: Date/Day mismatch (Rule Date: ${rule.specific_date}, Rule Days: ${rule.days_of_week}, Req Date: ${requestedDateLondon}, Req Day: ${requestedIsoDayOfWeekLondon})`
				);
				return false;
			}

			// Check if the requested time slot is fully within the rule's time range (using London time)
			const timeMatch = requestedTimeStartLondon >= rule.start_time && requestedTimeEndLondon <= rule.end_time;
			if (!timeMatch) {
				console.log(
					`Rule ${rule.id} skipped: Time mismatch (Rule Start: ${rule.start_time}, Rule End: ${rule.end_time}, Req Start: ${requestedTimeStartLondon}, Req End: ${requestedTimeEndLondon})`
				);
				return false;
			}
			console.log(`Rule ${rule.id} MATCHED.`);
			return true;
		});

		if (!availabilityRule) {
			console.error('Failed to find matching rule after checking', potentialRules.length, 'potential rules.');
			throw new Error('No matching availability rule found for the requested date and time range.');
		}
		if (!availabilityRule.field_ids || availabilityRule.field_ids.length === 0) {
			throw new Error(`Configuration error: Availability rule ${availabilityRule.id} is missing required field_ids.`);
		}

		// --- Assign ALL relevant field IDs ---
		booking_field_ids_for_insert = availabilityRule.field_ids;
		console.log(`Booking will be associated with fields: ${booking_field_ids_for_insert.join(', ')}`);

		// 5b. Capacity Checks (Simplified)
		let max_effective_capacity: number | null = null; // Can be null if no limit
		let current_booked_pet_count = 0;

		if (availabilityRule.use_staff_vehicle_capacity) {
			console.log(`Rule ${availabilityRule.id} uses staff vehicle capacity.`);
			if (!defaultStaffId) throw new Error('This service requires a default staff member assigned to your client profile, but none is set.');
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
				.lte('start_time', requestedTimeStartLondon)
				.gte('end_time', requestedTimeEndLondon)
				.or(`specific_date.eq.${requestedDateLondon},and(specific_date.is.null,days_of_week.cs.{${requestedIsoDayOfWeekLondon}})`)
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
			max_effective_capacity = vehicleData.pet_capacity || 0; // Use 0 if null/undefined

			// Check Overlapping Bookings for THIS STAFF MEMBER
			const { data: staffOverlaps, error: staffOverlapError } = await supabaseAdmin
				.from('bookings')
				.select('id, booking_pets(count)') // Select needed data
				.eq('assigned_staff_id', assigned_staff_user_id) // Filter by staff
				.lt('start_time', inputData.end_time) // Overlap time condition
				.gt('end_time', inputData.start_time) // Overlap time condition
				.neq('status', 'cancelled'); // Filter out cancelled

			if (staffOverlapError) throw new Error(`Error checking staff overlaps: ${staffOverlapError.message}`);
			current_booked_pet_count =
				staffOverlaps?.reduce(
					(sum: number, booking: { booking_pets: { count: number }[] }) => sum + (booking.booking_pets[0]?.count || 0),
					0
				) || 0;

			// No need to find an available field anymore
			console.log(`Staff capacity check: Max=${max_effective_capacity}, Booked=${current_booked_pet_count}, Requested=${num_pets_requested}`);
		} else {
            // Field Capacity Check (if not using staff/vehicle)
            console.log(`Rule ${availabilityRule.id} uses field capacity.`);
            max_effective_capacity = availabilityRule.max_pets_per_booking ?? null; // Use rule's per-booking limit if defined

            // Check overlaps based on ANY of the rule's fields
            // const { data: fieldOverlaps, error: fieldOverlapError } = await supabaseAdmin
            //     .from('bookings')
            //     .select('id, booking_pets(count)')
            //     .contains('booking_field_ids', booking_field_ids_for_insert) // Check if booking overlaps ANY field
            //     .lt('start_time', inputData.end_time)
            //     .gt('end_time', inputData.start_time)
            //     .neq('status', 'cancelled');

            // if (fieldOverlapError) throw new Error(`Error checking field overlaps: ${fieldOverlapError.message}`);

            // Note: Field capacity is trickier. The rule might have a total field capacity,
            // or it might be unlimited. We're currently using `max_pets_per_booking` if set.
            // We don't have a simple way to sum pets across *all* overlapping bookings in a field here
            // without more complex logic or a dedicated function/view.
            // For now, we just enforce the *per-booking* limit if it exists.
            current_booked_pet_count = 0; // Resetting as we're not summing across field overlaps here.
            console.log(`Field capacity check: Per-Booking Max=${max_effective_capacity ?? 'Unlimited'}, Requested=${num_pets_requested}`);
		}

		// Final capacity check (applies to both scenarios)
		if (max_effective_capacity !== null) { // Only check if a limit exists
            if (num_pets_requested > max_effective_capacity) {
                throw new Error(
                    `Requested number of pets (${num_pets_requested}) exceeds the maximum capacity per booking (${max_effective_capacity}) for this service/time.`
                );
            }
            if (availabilityRule.use_staff_vehicle_capacity && num_pets_requested + current_booked_pet_count > max_effective_capacity) {
                throw new Error(
                    `Booking would exceed the staff/vehicle capacity (${max_effective_capacity}). Currently booked: ${current_booked_pet_count}, Requested: ${num_pets_requested}.`
                );
            }
            // Add similar check here if you implement total field capacity logic
        }
	} catch (e) {
		const errorMessage = e instanceof Error ? e.message : 'Failed during capacity check or field assignment.';
		console.error('Capacity/Field Assignment Error:', e);
		// Use 409 Conflict if it's specifically a capacity issue
		const statusCode = errorMessage.toLowerCase().includes('capacity') ? 409 : 500;
		return NextResponse.json({ error: errorMessage }, { status: statusCode });
	}
	// --- END UPDATED Section 5 ---

	// --- Section 6: Database Transaction ---
    try {
        // Start transaction (example using a hypothetical transaction helper or just sequential awaits)
        console.log('Starting booking transaction...');

        // 6a. Insert into bookings table
        const { data: bookingResult, error: bookingInsertError } = await supabaseAdmin
            .from('bookings')
            .insert({
                // field_id: booking_field_id_for_insert, // Removed single field_id
                booking_field_ids: booking_field_ids_for_insert, // Use array
                start_time: inputData.start_time,
                end_time: inputData.end_time,
                service_type: serviceDetails.name, // Use fetched service name
                status: 'confirmed', // Default status
                is_paid: false, // Default payment status
                assigned_staff_id: assigned_staff_user_id, // UUID of staff (or null)
                vehicle_id: assigned_vehicle_id, // Vehicle ID (or null)
                // Add other fields like max_capacity if needed based on rule
            })
            .select('id') // Select the ID of the newly created booking
            .single();

        if (bookingInsertError) throw new Error(`Booking insertion failed: ${bookingInsertError.message}`);
        if (!bookingResult) throw new Error('Booking insertion succeeded but no ID was returned.');

        const newBookingId = bookingResult.id;
        console.log(`Booking created with ID: ${newBookingId}`);

        // 6b. Insert into booking_clients
        const { error: bookingClientInsertError } = await supabaseAdmin
            .from('booking_clients')
            .insert({ booking_id: newBookingId, client_id: clientId });

        if (bookingClientInsertError) throw new Error(`Booking client link failed: ${bookingClientInsertError.message}`);

        // 6c. Insert into booking_pets
        const petLinks = inputData.pet_ids.map((petId) => ({ booking_id: newBookingId, pet_id: petId }));
        const { error: bookingPetInsertError } = await supabaseAdmin
            .from('booking_pets')
            .insert(petLinks);

        if (bookingPetInsertError) throw new Error(`Booking pet link failed: ${bookingPetInsertError.message}`);

        console.log('Booking transaction completed successfully.');

        // --- Send Confirmation Emails ---
        try {
            console.log('Preparing booking confirmation emails...');
            const adminEmail = process.env.RESEND_EMAIL;

            // Format data for emails (moved outside the if block)
            const bookingDateFormatted = new Date(inputData.start_time).toLocaleDateString('en-GB', { dateStyle: 'full', timeZone: 'Europe/London' });
            const bookingTimeFormatted = `${new Date(inputData.start_time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Europe/London' })} - ${new Date(inputData.end_time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Europe/London' })}`;

            if (!adminEmail) {
                console.warn('Admin email (RESEND_EMAIL) not configured. Skipping admin notification.');
            } else {
                // Render Admin Email
                const adminHtml = await render(
                    <BookingConfirmationAdmin
                        clientName={clientFirstName}
                        clientEmail={clientEmail}
                        serviceName={serviceDetails.name}
                        bookingDate={bookingDateFormatted}
                        bookingTime={bookingTimeFormatted}
                        pets={petNames}
                    />
                );
                // Send Admin Email (don't wait for it necessarily)
                sendEmail({
                    to: adminEmail,
                    subject: `New Booking: ${serviceDetails.name} for ${clientFirstName}`,
                    html: adminHtml,
                    // Use admin email as reply-to for admin notification
                    replyTo: adminEmail
                }).catch(err => console.error("Error sending admin confirmation email:", err)); // Log error but don't fail request
            }

            // Render Client Email
            const clientHtml = await render(
                <BookingConfirmationClient
                    clientName={clientFirstName}
                    serviceName={serviceDetails.name}
                    bookingDate={bookingDateFormatted}
                    bookingTime={bookingTimeFormatted}
                    pets={petNames}
                />
            );
            // Send Client Email (don't wait for it necessarily)
            sendEmail({
                to: clientEmail,
                subject: `Your Booking Confirmation for ${serviceDetails.name}`,
                html: clientHtml,
                // Let replies go to the default admin email
                replyTo: process.env.RESEND_EMAIL
            }).catch(err => console.error("Error sending client confirmation email:", err)); // Log error but don't fail request

        } catch (emailError) {
            // Log error if email preparation/sending fails, but don't fail the booking
            console.error('Error preparing or sending booking confirmation emails:', emailError);
        }
        // --- End Email Sending ---

        // If everything worked, return success
        return NextResponse.json({ message: 'Booking created successfully', bookingId: newBookingId }, { status: 201 });

    } catch (e) {
        // Handle transaction errors (rollback might be needed depending on setup)
        const errorMessage = e instanceof Error ? e.message : 'Failed to create booking due to an internal error.';
        console.error('Booking Transaction Error:', errorMessage, e);
        return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
}

// Note: Consider adding DELETE or PUT handlers if clients need to modify/cancel bookings
// Ensure proper authorization and business logic (e.g., cancellation deadlines)