import { NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';

export async function POST(request: Request) {
	const supabase = await createServerClient();
	const supabaseAdmin = await createAdminClient();

	// 1. Authentication & Get Client ID
	const {
		data: { user },
		error: authError,
	} = await supabase.auth.getUser();
	if (authError || !user) {
		return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
	}
	// Fetch the client ID associated with the authenticated user
	const { data: clientData, error: clientError } = await supabase.from('clients').select('id, default_staff_id').eq('user_id', user.id).single();
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

	// 3. Fetch Service Details
	const { data: serviceDetails, error: serviceError } = await supabaseAdmin.from('services').select('name').eq('id', inputData.service_id).single();

	if (serviceError || !serviceDetails) {
		return NextResponse.json({ error: `Service with ID ${inputData.service_id} not found.` }, { status: 404 });
	}

	// 4. Validate pets (belong to client, are confirmed)
	const { data: clientPets, error: clientPetsError } = await supabase.from('pets').select('id, is_confirmed').eq('client_id', clientId);

	if (clientPetsError) {
		console.error('Error fetching client pets:', clientPetsError);
		return NextResponse.json({ error: 'Failed to validate pet ownership' }, { status: 500 });
	}

	// Create a set of client's pet IDs for easy lookup
	const clientPetIds = new Set(clientPets.map((p) => p.id));
	const clientPetMap = new Map(clientPets.map((p) => [p.id, p]));

	// Check if all pet IDs in the request belong to this client
	const invalidPetIds = inputData.pet_ids.filter((id) => !clientPetIds.has(id));
	if (invalidPetIds.length > 0) {
		return NextResponse.json({ error: `Pet IDs ${invalidPetIds.join(', ')} do not belong to this client` }, { status: 400 });
	}

	// b. Check if all pets are confirmed
	const unconfirmedPetIds = inputData.pet_ids.filter((id) => clientPetMap.has(id) && !clientPetMap.get(id)?.is_confirmed);

	if (unconfirmedPetIds.length > 0) {
		return NextResponse.json(
			{ error: `Pets with IDs ${unconfirmedPetIds.join(', ')} are not confirmed yet and cannot be booked` },
			{ status: 400 }
		);
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
			// If not using staff vehicle capacity, there's no capacity limit enforced by this rule anymore.
			// We assume staff assignment/availability is handled elsewhere or isn't relevant.
			console.log(`Rule ${availabilityRule.id} does not use staff vehicle capacity. No capacity check performed.`);
			max_effective_capacity = null; // Indicate no limit from the rule
			current_booked_pet_count = 0; // Not relevant for this check
			assigned_staff_user_id = null;
			assigned_vehicle_id = null;
		}

		// 5c. Perform Final Capacity Check (only if max_effective_capacity is not null)
		if (max_effective_capacity !== null) {
			const current_remaining_capacity = max_effective_capacity - current_booked_pet_count;
			if (num_pets_requested > current_remaining_capacity) {
				return NextResponse.json(
					{
						error: `Capacity exceeded. Requested ${num_pets_requested} pets, but only ${current_remaining_capacity} slots available (Based on staff vehicle capacity). Max: ${max_effective_capacity}, Booked: ${current_booked_pet_count}).`,
					},
					{ status: 409 } // Conflict
				);
			}
		}

		// Ensure field IDs were determined
		if (booking_field_ids_for_insert.length === 0) {
			// This shouldn't happen due to earlier check, but good safeguard
			throw new Error('Failed to determine associated fields for the booking.');
		}
	} catch (e) {
		const errorMessage = e instanceof Error ? e.message : 'Error during capacity check or field assignment.';
		console.error('Capacity/Field Assignment Error:', e);
		return NextResponse.json({ error: errorMessage }, { status: 500 });
	}
	// --- END UPDATED Section 5 ---

	// 6. Database Insert
	try {
		// --- Create Booking ---
		const { data: newBooking, error: bookingInsertError } = await supabaseAdmin
			.from('bookings')
			.insert({
				booking_field_ids: booking_field_ids_for_insert, // ADDED
				service_type: serviceDetails.name,
				start_time: inputData.start_time,
				end_time: inputData.end_time,
				status: 'confirmed',
				assigned_staff_id: assigned_staff_user_id,
				vehicle_id: assigned_vehicle_id,
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
			throw new Error(
				`Booking created (ID: ${bookingId}) but failed to link to client: ${bookingClientInsertError.message}. Booking rollbacked.`
			);
		}

		// --- Link Pets (using booking_pets junction table) ---
		const petLinks = inputData.pet_ids.map((petId) => ({
			booking_id: bookingId,
			pet_id: petId,
		}));

		const { error: bookingPetsInsertError } = await supabaseAdmin.from('booking_pets').insert(petLinks);

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
			return NextResponse.json(
				{ success: true, booking_id: bookingId, message: 'Booking created, but failed to fetch final details.' },
				{ status: 201 }
			);
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
