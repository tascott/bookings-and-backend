import { NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';

// --- Email Imports ---
import { render } from '@react-email/render';
import { sendEmail } from '@/utils/sendEmail';
import BookingConfirmationClient from '@/emails/BookingConfirmationClient';
import BookingConfirmationAdmin from '@/emails/BookingConfirmationAdmin';
import BookingSummaryClient from '@/emails/BookingSummaryClient';
import BookingSummaryAdmin from '@/emails/BookingSummaryAdmin';
// ---------------------

// Define the structure for a single booking input
interface BookingInput {
	service_id: number;
	start_time: string; // Expected as naive ISO-like string, e.g., "2024-07-30T10:00:00"
	end_time: string;   // Expected as naive ISO-like string, e.g., "2024-07-30T12:00:00"
	pet_ids: number[];
}

// Define the structure for the expected request body
interface MultiBookingRequest {
	bookings: BookingInput[];
}

// Define the structure for a successful booking result (for email summary)
interface SuccessfulBookingResult {
	id: number;
	serviceName: string;
	bookingDateFormatted: string;
	bookingTimeFormatted: string;
	petNames: string[];
	input: BookingInput;
}

// Define the structure for a failed booking attempt
interface FailedBookingResult {
	input: BookingInput;
	error: string;
}

// Helper function to format date/time (REVISED for naive parsing)
function formatBookingDateTime(naiveIsoString: string): { date: string, time: string, isoDay: number } {
	try {
		// Expecting "YYYY-MM-DDTHH:MM:SS"
		if (!naiveIsoString || naiveIsoString.length < 19 || !naiveIsoString.includes('T')) {
			throw new Error('Invalid naive ISO string format');
		}

		const datePart = naiveIsoString.substring(0, 10); // "YYYY-MM-DD"
		const timePart = naiveIsoString.substring(11, 19); // "HH:MM:SS"

		// To get the day of the week correctly *without* timezone influence,
		// we have to parse the date part manually or use a library designed for naive dates.
		// Using JS Date temporarily but forcing UTC interpretation of the DATE part ONLY to get day.
		const tempDate = new Date(datePart + 'T00:00:00Z'); // Treat date as UTC midnight
		if (isNaN(tempDate.getTime())) throw new Error('Invalid date part for day calculation');

		let isoDay = tempDate.getUTCDay(); // Get UTC day (0=Sun, 6=Sat)
		isoDay = isoDay === 0 ? 7 : isoDay; // Convert to ISO (1=Mon, 7=Sun)

		// Validate extracted parts basic format (optional but good practice)
		if (!/^\d{4}-\d{2}-\d{2}$/.test(datePart) || !/^\d{2}:\d{2}:\d{2}$/.test(timePart)) {
			throw new Error('Invalid date or time component format after parsing');
		}

		return { date: datePart, time: timePart, isoDay: isoDay };
	} catch {
		return { date: 'Invalid Date', time: 'Invalid Time', isoDay: 0 };
	}
}

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
		return NextResponse.json({ error: 'Client not found or error fetching it.' }, { status: 404 });
	}
	// Fetch profile info (first name) - CORRECTED QUERY
	const { data: profileData, error: profileError } = await supabase
		.from('profiles')
		.select('first_name')
		.eq('user_id', user.id) // Use user_id to join with profiles
		.single();
	if (profileError) {
		// Don't fail the request, just use a default name
	}

	const clientId = clientData.id;
	const defaultStaffId = clientData.default_staff_id;
	const clientFirstName = profileData?.first_name || 'Valued Customer';
	const clientEmail = user.email;

	// 2. Parse and Validate Input Array
	let bookingInputs: BookingInput[];
	try {
		// Expect an object with a 'bookings' array
		const body: MultiBookingRequest = await request.json();

		if (!body || !Array.isArray(body.bookings) || body.bookings.length === 0) {
			throw new Error('Request body must be an object containing a non-empty "bookings" array.');
		}
		bookingInputs = body.bookings;

		// Validate each booking input in the array
		for (const inputData of bookingInputs) {
			if (typeof inputData.service_id !== 'number' || isNaN(inputData.service_id) ||
				!inputData.start_time || typeof inputData.start_time !== 'string' ||
				!inputData.end_time || typeof inputData.end_time !== 'string' ||
				!Array.isArray(inputData.pet_ids) || inputData.pet_ids.length === 0) {
				throw new Error('Invalid booking object structure in array. Required fields: service_id (number), start_time (string), end_time (string), pet_ids (non-empty array).');
			}
			if (inputData.pet_ids.some((id) => typeof id !== 'number' || isNaN(id))) {
				throw new Error('Invalid pet_id found in a pet_ids array. All IDs must be numbers.');
			}
			if (isNaN(new Date(inputData.start_time).getTime()) || isNaN(new Date(inputData.end_time).getTime())) {
				throw new Error('Invalid start_time or end_time format in a booking object.');
			}
			if (new Date(inputData.start_time) >= new Date(inputData.end_time)) {
				throw new Error('Start time must be before end time in a booking object.');
			}
		}
	} catch (e) {
		const errorMessage = e instanceof Error ? e.message : 'Invalid request body format or content.';
		return NextResponse.json({ error: errorMessage }, { status: 400 });
	}

	// --- Process Bookings in a Loop ---
	const successfulBookings: SuccessfulBookingResult[] = [];
	const failedBookings: FailedBookingResult[] = [];

	for (const inputData of bookingInputs) {
		// Variables scoped to this loop iteration
		let serviceDetails: { id: number; name: string; } | null = null;
		let petNames: string[] = [];
		let booking_field_ids_for_insert: number[] = [];
		let assigned_staff_user_id: string | null = null;
		let assigned_vehicle_id: number | null = null;

		try {
			// 2.5 Validate Pet Ownership & Fetch Pet Names (for this booking's pets)
			const { data: ownedPetsData, error: petCheckError } = await supabaseAdmin
				.from('pets')
				.select('id, name, is_confirmed')
				.eq('client_id', clientId)
				.in('id', inputData.pet_ids);

			if (petCheckError) throw new Error(`Could not verify/fetch pets: ${petCheckError.message}`);
			if (!ownedPetsData || ownedPetsData.length !== inputData.pet_ids.length) {
				const foundIds = ownedPetsData?.map(p => p.id) || [];
				const missingIds = inputData.pet_ids.filter(id => !foundIds.includes(id));
				throw new Error(`Invalid pet selection: Pet(s) with ID(s) ${missingIds.join(', ')} not found or do not belong to this client.`);
			}
			const unconfirmedPets = ownedPetsData.filter(p => !p.is_confirmed);
			if (unconfirmedPets.length > 0) {
				throw new Error(`Pets ${unconfirmedPets.map(p => p.name).join(', ')} are not confirmed yet.`);
			}
			petNames = ownedPetsData.map(p => p.name);

			// 3. Fetch Service Details (for this booking's service)
			const { data: fetchedServiceDetails, error: serviceError } = await supabaseAdmin
				.from('services')
				.select('id, name')
				.eq('id', inputData.service_id)
				.single();
			if (serviceError || !fetchedServiceDetails) {
				throw new Error(`Service with ID ${inputData.service_id} not found.`);
			}
			serviceDetails = fetchedServiceDetails; // Assign to loop-scoped variable

			// --- Section 5 (Using REVISED helper) ---
			// 5a. Find rule using naive components
			const startComponents = formatBookingDateTime(inputData.start_time);
			const endComponents = formatBookingDateTime(inputData.end_time);
			if (startComponents.isoDay === 0 || endComponents.isoDay === 0) {
				throw new Error(`Failed to parse date/time components for ${inputData.start_time}`);
			}

			const requestedDate = startComponents.date;
			const requestedStartTime = startComponents.time;
			const requestedEndTime = endComponents.time;
			const requestedIsoDay = startComponents.isoDay;

			// Fetch rules (same as before)
			const { data: potentialRules, error: ruleFetchError } = await supabaseAdmin
				.from('service_availability')
				.select('*')
				.eq('service_id', inputData.service_id)
				.eq('is_active', true);

			if (ruleFetchError) throw new Error(`Error fetching rules: ${ruleFetchError.message}`);
			if (!potentialRules || potentialRules.length === 0) throw new Error('No active rules found.');

			// Find rule by comparing naive components
			const availabilityRule = potentialRules.find((rule) => {
				const dateOrDayMatch =
					(rule.specific_date && rule.specific_date === requestedDate) ||
					(!rule.specific_date && rule.days_of_week && rule.days_of_week.includes(requestedIsoDay));
				if (!dateOrDayMatch) return false;
				const timeMatch = requestedStartTime >= rule.start_time && requestedEndTime <= rule.end_time;
				return timeMatch;
			});

			if (!availabilityRule) {
				throw new Error('No matching availability rule found for the requested date/time.');
			}
			if (!availabilityRule.field_ids || availabilityRule.field_ids.length === 0) {
				throw new Error(`Rule ${availabilityRule.id} missing field_ids.`);
			}
			booking_field_ids_for_insert = availabilityRule.field_ids;

			// 5b. Capacity Checks (Adapted for naive time)
			const num_pets_requested = inputData.pet_ids.length;
			let max_effective_capacity: number | null = null;
			let current_booked_pet_count = 0;

			if (availabilityRule.use_staff_vehicle_capacity) {
				// ... (Staff details fetch is the same) ...
				if (!defaultStaffId) throw new Error('Service requires default staff, but none set for client.');
				const { data: staffDetails, error: staffError } = await supabaseAdmin
					.from('staff')
					.select('user_id, default_vehicle_id')
					.eq('id', defaultStaffId)
					.single();
				if (staffError || !staffDetails || !staffDetails.user_id || !staffDetails.default_vehicle_id) {
					throw new Error(`Failed to fetch details for staff ID: ${defaultStaffId}.`);
				}
				assigned_staff_user_id = staffDetails.user_id;
				assigned_vehicle_id = staffDetails.default_vehicle_id;

				// Check staff *schedule* availability using naive components
				// Assumes staff_availability table uses TIME for start/end_time, DATE for specific_date
				const { error: staffAvailError, count: staffAvailabilityCount } = await supabaseAdmin
					.from('staff_availability')
					.select('id', { count: 'exact', head: true })
					.eq('staff_id', defaultStaffId)
					.eq('is_available', true)
					// Compare rule times (HH:MM:SS) against staff schedule times (TIME type)
					.lte('start_time', requestedStartTime)
					.gte('end_time', requestedEndTime)
					// Compare rule date (YYYY-MM-DD) / day (1-7) against staff schedule date/day
					.or(`specific_date.eq.${requestedDate},and(specific_date.is.null,days_of_week.cs.{${requestedIsoDay}})`);

				if (staffAvailError) throw new Error(`Error checking staff schedule: ${staffAvailError.message}`);
				if (staffAvailabilityCount === 0) {
					throw new Error(`Assigned staff (ID: ${defaultStaffId}) is not scheduled as available.`);
				}

				// ... (Vehicle capacity fetch is the same) ...
				const { data: vehicleData, error: vehicleCapError } = await supabaseAdmin
					.from('vehicles')
					.select('pet_capacity')
					.eq('id', assigned_vehicle_id)
					.single();
				if (vehicleCapError || !vehicleData) throw new Error(`Failed to fetch capacity for vehicle ID: ${assigned_vehicle_id}.`);
				max_effective_capacity = vehicleData.pet_capacity ?? 0;

				// Check overlapping bookings (Query remains the same - uses original ISO-like strings)
				// Assumes Supabase/Postgres correctly compare these based on the TIMESTAMP WITHOUT TIME ZONE column type
				const { data: staffOverlaps, error: staffOverlapError } = await supabaseAdmin
					.from('bookings')
					.select('booking_pets(count)')
					.eq('assigned_staff_id', assigned_staff_user_id)
					.lt('start_time', inputData.end_time) // Use original string
					.gt('end_time', inputData.start_time) // Use original string
					.neq('status', 'cancelled');

				// ... (Overlap calculation is the same) ...
				if (staffOverlapError) throw new Error(`Error checking staff overlaps: ${staffOverlapError.message}`);
				current_booked_pet_count =
					staffOverlaps?.reduce((sum, booking) => sum + (booking.booking_pets[0]?.count || 0), 0) || 0;

			} else {
				// Field Capacity Check (same logic as before)
				max_effective_capacity = availabilityRule.max_pets_per_booking ?? null;
				current_booked_pet_count = 0;
			}

			// Final capacity check (same logic as before)
			if (max_effective_capacity !== null) {
				if (num_pets_requested > max_effective_capacity) {
					throw new Error(`Requested pets (${num_pets_requested}) exceeds max per booking (${max_effective_capacity}).`);
				}
				if (availabilityRule.use_staff_vehicle_capacity && (num_pets_requested + current_booked_pet_count) > max_effective_capacity) {
					throw new Error(`Booking exceeds staff/vehicle capacity (${max_effective_capacity}). Booked: ${current_booked_pet_count}, Req: ${num_pets_requested}.`);
				}
			}
			// --- END Section 5 ---

			// --- Section 6 (Database insertion remains the same) ---
			// 6a. Insert booking (using original naive ISO-like strings)
			const { data: bookingResult, error: bookingInsertError } = await supabaseAdmin
				.from('bookings')
				.insert({
					booking_field_ids: booking_field_ids_for_insert,
					start_time: inputData.start_time,
					end_time: inputData.end_time,
					service_type: serviceDetails.name,
					status: 'confirmed',
					is_paid: false,
					assigned_staff_id: assigned_staff_user_id,
					vehicle_id: assigned_vehicle_id,
				})
				.select('id')
				.single();

			if (bookingInsertError) throw new Error(`Booking insert failed: ${bookingInsertError.message}`);
			if (!bookingResult) throw new Error('Booking insert succeeded but no ID returned.');
			const newBookingId = bookingResult.id;

			// 6b & 6c: Insert booking_clients and booking_pets (remain the same)
			const { error: bookingClientInsertError } = await supabaseAdmin
				.from('booking_clients')
				.insert({ booking_id: newBookingId, client_id: clientId });
			if (bookingClientInsertError) throw new Error(`Booking client link failed: ${bookingClientInsertError.message}`);

			const petLinks = inputData.pet_ids.map((petId) => ({ booking_id: newBookingId, pet_id: petId }));
			const { error: bookingPetInsertError } = await supabaseAdmin
				.from('booking_pets')
				.insert(petLinks);
			if (bookingPetInsertError) throw new Error(`Booking pet link failed: ${bookingPetInsertError.message}`);

			// Add to successful results (Format for email using naive components)
			// Helper to format HH:MM:SS into HH:MM AM/PM
			const formatTime12hr = (timeString: string): string => {
				if (!timeString || timeString.length < 5) return 'Invalid Time';
				const hours = parseInt(timeString.substring(0, 2), 10);
				const minutes = timeString.substring(3, 5);
				const ampm = hours >= 12 ? 'PM' : 'AM';
				let hours12 = hours % 12;
				hours12 = hours12 ? hours12 : 12; // the hour '0' should be '12'
				return `${String(hours12).padStart(2, '0')}:${minutes} ${ampm}`;
			};

			// Helper to format YYYY-MM-DD into Full Date Style (e.g., Wednesday, 14 May 2025)
			const formatDateFull = (dateString: string): string => {
				try {
					// Create date object treating input as UTC date to avoid local shifts
					const date = new Date(dateString + 'T00:00:00Z');
					if (isNaN(date.getTime())) throw new Error();
					return date.toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
				} catch {
					return 'Invalid Date';
				}
			}

			successfulBookings.push({
				id: newBookingId,
				serviceName: serviceDetails.name,
				// Format using the reliable naive components extracted earlier
				bookingDateFormatted: formatDateFull(startComponents.date),
				bookingTimeFormatted: `${formatTime12hr(startComponents.time)} - ${formatTime12hr(endComponents.time)}`,
				petNames: petNames,
				input: inputData
			});

		} catch (e) {
			const errorMessage = e instanceof Error ? e.message : 'An unknown error occurred during booking processing.';
			failedBookings.push({
				input: inputData,
				error: errorMessage,
			});
		}
	} // End of loop through bookingInputs

	// --- Send Confirmation Email(s) (Logic remains the same, uses formatted data) ---
	if (successfulBookings.length > 0) {
		try {
			const adminEmail = process.env.RESEND_EMAIL;
			if (!adminEmail) {
				// Skipping admin notification(s).
			}

			// Single booking case
			if (successfulBookings.length === 1 && failedBookings.length === 0) {
				const booking = successfulBookings[0];
				if (adminEmail) {
					// Render BookingConfirmationAdmin (uses booking.*Formatted props)
					const adminHtml = await render(
						<BookingConfirmationAdmin
							clientName={clientFirstName}
							clientEmail={clientEmail}
							serviceName={booking.serviceName}
							bookingDate={booking.bookingDateFormatted}
							bookingTime={booking.bookingTimeFormatted}
							pets={booking.petNames}
						/>
					);
					// Send email
					sendEmail({
						to: adminEmail,
						subject: `New Booking: ${booking.serviceName} for ${clientFirstName}`,
						html: adminHtml,
						replyTo: adminEmail
					}).catch(() => {});
				}
				// Render BookingConfirmationClient (uses booking.*Formatted props)
				const clientHtml = await render(
					<BookingConfirmationClient
						clientName={clientFirstName}
						serviceName={booking.serviceName}
						bookingDate={booking.bookingDateFormatted}
						bookingTime={booking.bookingTimeFormatted}
						pets={booking.petNames}
					/>
				);
				// Send email
				sendEmail({
					to: clientEmail,
					subject: `Your Booking Confirmation for ${booking.serviceName}`,
					html: clientHtml,
					replyTo: process.env.RESEND_EMAIL
				}).catch(() => {});

			// Multiple bookings case
			} else if (successfulBookings.length > 1 || (successfulBookings.length === 1 && failedBookings.length > 0)) {
				// Simplified condition: Send summary if more than one success OR if mixed success/failure
				// Send summary email for 1 successful, 0 failed attempts.
				if (adminEmail) {
					// Render BookingSummaryAdmin (uses booking.*Formatted props)
					const adminSummaryHtml = await render(
						<BookingSummaryAdmin
							clientName={clientFirstName}
							clientEmail={clientEmail}
							bookings={successfulBookings.map(b => ({
								serviceName: b.serviceName,
								date: b.bookingDateFormatted,
								time: b.bookingTimeFormatted,
								pets: b.petNames.join(', '),
							}))}
							errors={failedBookings.map(f => ({
								input: f.input,
								error: f.error,
							}))}
						/>
					);
					// Send email
					sendEmail({
						to: adminEmail,
						subject: `Booking Summary for ${clientFirstName} (${successfulBookings.length} successful, ${failedBookings.length} failed)`,
						html: adminSummaryHtml,
						replyTo: adminEmail
					}).catch(() => {});
				}

				// Render BookingSummaryClient (uses booking.*Formatted props)
				const clientSummaryHtml = await render(
					<BookingSummaryClient
						clientName={clientFirstName}
						bookings={successfulBookings.map(b => ({
							serviceName: b.serviceName,
							date: b.bookingDateFormatted,
							time: b.bookingTimeFormatted,
							pets: b.petNames.join(', '),
						}))}
						// Optionally include failures for client if needed
					/>
				);
				// Send email
				sendEmail({
					to: clientEmail,
					subject: `Your Booking Summary (${successfulBookings.length} Bookings Confirmed)`,
					html: clientSummaryHtml,
					replyTo: process.env.RESEND_EMAIL
				}).catch(() => {});
			}

		} catch {
			// Error preparing or sending booking confirmation emails:
		}
	} // End if successfulBookings.length > 0

	// --- Construct Final Response (Remains the same) ---
	const status = failedBookings.length > 0 ? (successfulBookings.length > 0 ? 207 : 400) : 201;

	return NextResponse.json({
		message: status === 201 ? 'All bookings created successfully.' : (status === 207 ? 'Some bookings failed.' : 'All bookings failed.'),
		successfulBookings: successfulBookings.map(b => ({ id: b.id, serviceName: b.serviceName, start_time: b.input.start_time, end_time: b.input.end_time })), // Return IDs and key info
		failedBookings: failedBookings, // Include details of failures
	}, { status });
}

// Removed note about installing date-fns-tz
// Note: Ensure input start_time/end_time are consistently formatted naive strings (e.g., YYYY-MM-DDTHH:MM:SS)
// Note: Ensure service_availability and staff_availability times/dates are stored appropriately (TIME, DATE)
// Note: Ensure bookings table start_time/end_time columns are TIMESTAMP WITHOUT TIME ZONE