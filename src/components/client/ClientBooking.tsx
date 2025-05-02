'use client';

import { useState, useCallback, useEffect, ChangeEvent } from 'react';
import styles from '@/app/page.module.css'; // Adjust path as needed
import CalendarView, { CalendarEvent } from '@/components/shared/CalendarView'; // Import CalendarView
import { formatISO, isSameDay, startOfWeek, endOfWeek, getDay as dateFnsGetDay, addDays } from 'date-fns'; // Import date-fns helpers and format, and startOfWeek, endOfWeek, getDay, addDays

// Define required types directly or import from a shared types file later
type Service = {
	id: number;
	name: string;
	description: string | null;
	created_at: string;
	requires_field_selection: boolean;
	default_price?: number | null; // Add price
};

// Updated to match actual API response structure from console log
type CalculatedSlot = {
	// These fields might still be useful if requires_field_selection is true,
	// but are not used in aggregation logic based on console logs.
	// Keep them commented or remove if definitely unused.
	// slot_field_id?: number;
	// slot_field_name?: string;

	// Fields actually used in aggregation, based on console log and required logic
	start_time: string; // API key: start_time
	end_time: string; // API key: end_time
	remaining_capacity: number; // API key: remaining_capacity
	price_per_pet?: number | null; // API key: price_per_pet (optional)
	zero_capacity_reason?: string | null; // 'staff_full', 'no_staff', 'base_full', or null

	// Optional fields seen in the log, keep if needed elsewhere
	capacity_display?: string;
	field_ids?: number[];
	uses_staff_capacity?: boolean;
};

// Define a new type for the aggregated data used for display
type AggregatedSlot = {
	serviceId: number; // Keep service ID for potential use
	serviceName: string; // Need service name for display
	startTime: string; // ISO string
	endTime: string; // ISO string
	totalRemainingCapacity: number;
	price_per_pet: number; // Use the lowest price found for this time block?
	uses_staff_capacity: boolean; // Indicates if capacity is staff-based
	zero_capacity_reason: string | null; // 'staff_full', 'no_staff', 'base_full', or null
	// Keep track of contributing fields/slots if needed for booking later?
	// contributingSlots: CalculatedSlot[];
};

// Define Pet type
type Pet = {
	id: number;
	client_id: number;
	name: string;
	breed?: string | null;
	size?: string | null;
	created_at?: string;
	is_confirmed?: boolean;
};

// Type definition based on /api/my-bookings response
type ClientBookingDetails = {
	booking_id: number;
	start_time: string;
	end_time: string;
	service_type: string | null;
	status: string;
	field_id: number;
	pets: { id: number; name: string }[]; // Array of pets linked to this booking
};

// Define props for the component
interface ClientBookingProps {
	services: Service[];
	// Add other shared props if needed, e.g., error state handlers
}

// Function to get the initial date for the calendar view
const getInitialCalendarDate = (): Date => {
	const today = new Date();
	const dayOfWeek = dateFnsGetDay(today); // Sunday = 0, Monday = 1, ..., Saturday = 6

	// If today is Friday (5), Saturday (6), or Sunday (0)
	if (dayOfWeek === 5 || dayOfWeek === 6 || dayOfWeek === 0) {
		// Calculate days until next Monday
		const daysToAdd = dayOfWeek === 0 ? 1 : 7 - dayOfWeek + 1;
		return addDays(today, daysToAdd);
	}
	// Otherwise, start the view on the current week/day
	return today;
};

export default function ClientBooking({ services }: ClientBookingProps) {
	const [error, setError] = useState<string | null>(null); // Local error state for this component

	// State for slot search inputs
	const today = new Date();
	today.setHours(0, 0, 0, 0); // Set to start of today
	// const todayISO = today.toISOString().split('T')[0]; // For comparisons -> No longer needed

	// NEW State for single selected date from Calendar
	const [selectedBookingDate, setSelectedBookingDate] = useState<Date | null>(null);

	const [selectedServiceId, setSelectedServiceId] = useState<string>('');
	// State for the raw calculated slots from API (for the selected date)
	const [rawCalculatedSlots, setRawCalculatedSlots] = useState<CalculatedSlot[]>([]);
	// State for the aggregated slots for display (for the selected date)
	const [aggregatedSlots, setAggregatedSlots] = useState<AggregatedSlot[]>([]);
	const [isLoadingCalculatedSlots] = useState(false);

	// State for pets
	const [pets, setPets] = useState<Pet[]>([]);
	const [isLoadingPets, setIsLoadingPets] = useState(true);
	const [selectedPetIds, setSelectedPetIds] = useState<number[]>([]);

	// State for slots and selections
	const [selectedSlots, setSelectedSlots] = useState<Set<string>>(new Set()); // Use Set for easy add/remove

	const [clientBookings, setClientBookings] = useState<ClientBookingDetails[]>([]);
	const [isLoadingBookings, setIsLoadingBookings] = useState(false);

	// State for Calendar Events (visual markers)
	const [calendarDisplayEvents, setCalendarDisplayEvents] = useState<CalendarEvent[]>([]); // Add setter back
	const [isLoadingCalendarDisplay, setIsLoadingCalendarDisplay] = useState(false);

	// State for current calendar view range - use helper function for initial state
	const [calendarViewDate, setCalendarViewDate] = useState<Date>(getInitialCalendarDate());

	// Define helper here to be accessible throughout the component
	const getServiceName = (id: number) => services.find((s) => s.id === id)?.name || `Service ID ${id}`;

	// Basic formatter functions (replace with library or more robust logic if needed)
	const formatDateRange = (startStr: string, endStr: string): string => {
		try {
			const start = new Date(startStr);
			const end = new Date(endStr);
			// Use Europe/London timezone for display
			const options: Intl.DateTimeFormatOptions = {
				timeZone: 'Europe/London',
				weekday: 'short',
				month: 'short',
				day: 'numeric',
				hour: 'numeric',
				minute: '2-digit',
				hour12: true,
			};
			const endOptions: Intl.DateTimeFormatOptions = {
				timeZone: 'Europe/London',
				hour: 'numeric',
				minute: '2-digit',
				hour12: true,
			};
			return `${start.toLocaleString([], options)} - ${end.toLocaleString([], endOptions)}`;
		} catch (e) {
			console.error('Date formatting error:', e);
			return 'Invalid Date Range';
		}
	};

	const formatPrice = (price: number | null | undefined): string => {
		// Handle null/undefined, default to 0
		const numPrice = price ?? 0;
		// Example: £15.00
		return `£${numPrice.toFixed(2)}`;
	};

	const isSlotBookedBySelectedPets = (slotStartTime: string): boolean => {
		if (selectedPetIds.length === 0 || clientBookings.length === 0) {
			return false;
		}

		// Check if there is ANY booking for this client that:
		// 1. Matches the slot's start time.
		// 2. Includes AT LEAST ONE of the currently selected pets.
		return clientBookings.some((booking) => {
			// Ensure both strings are treated as UTC. Assume API might sometimes omit offset.
			const bookingStartTimeStr = booking.start_time.endsWith('+00:00') ? booking.start_time : booking.start_time + '+00:00';
			const slotStartTimeStr = slotStartTime.endsWith('+00:00') ? slotStartTime : slotStartTime + '+00:00';

			// Compare Date objects derived from standardized UTC strings
			if (new Date(bookingStartTimeStr).getTime() !== new Date(slotStartTimeStr).getTime()) {
				return false;
			}

			// Check if any pet in this booking is also in the selectedPetIds list
			const overlaps = booking.pets.some((bookedPet) => {
				const isSelected = selectedPetIds.includes(bookedPet.id);
				return isSelected;
			});
			if (overlaps) {
				console.log(`Slot ${slotStartTime} is already booked by selected pet(s).`);
			}
			return overlaps;
		});
	};

	const fetchClientBookings = async () => {
		setIsLoadingBookings(true);
		// Don't clear error here, let fetchCalculatedSlots handle slot errors
		try {
			const response = await fetch('/api/my-bookings');
			if (!response.ok) {
				console.error('Failed to fetch client bookings', response.status);
				// Don't throw, just set empty array and maybe log
				setClientBookings([]);
				return;
			}
			const data: ClientBookingDetails[] = await response.json();
			setClientBookings(data);
		} catch (e) {
			console.error('Error fetching client bookings:', e);
			setClientBookings([]); // Set empty on error
		} finally {
			setIsLoadingBookings(false);
		}
	};

	// Fetch pets on mount
	useEffect(() => {
		const fetchPets = async () => {
			setIsLoadingPets(true);
			try {
				const response = await fetch('/api/pets'); // Assuming GET /api/pets fetches the current client's pets
				if (!response.ok) throw new Error('Failed to fetch pets');
				const data: Pet[] = await response.json();
				setPets(data);
				// Select all pets by default
				setSelectedPetIds(data.map((pet) => pet.id));
			} catch (e) {
				setError(e instanceof Error ? e.message : 'Failed to load pets');
				setPets([]); // Clear pets on error
			} finally {
				setIsLoadingPets(false);
			}
		};
		fetchPets();
	}, []);

	// Fetch existing client bookings on mount
	useEffect(() => {
		fetchClientBookings();
	}, []);

	// Fetch calendar availability for the current view (now week)
	const fetchCalendarAvailability = useCallback(async (serviceId: string, viewDate: Date) => {
		if (!serviceId) {
			setCalendarDisplayEvents([]); // Clear markers if no service selected
			return;
		}
		setIsLoadingCalendarDisplay(true);
		setError(null); // Clear previous errors specific to this fetch

		// Calculate start/end of the week based on viewDate, explicitly starting on Monday
		const weekOptions = { weekStartsOn: 1 as const }; // Explicitly start week on Monday (1)
		const viewStart = startOfWeek(viewDate, weekOptions);
		const viewEnd = endOfWeek(viewDate, weekOptions);
		const startDateStr = formatISO(viewStart, { representation: 'date' });
		const endDateStr = formatISO(viewEnd, { representation: 'date' });

		console.log(`Fetching calendar availability for service ${serviceId} from ${startDateStr} to ${endDateStr} (Week View)`);

		try {
			const response = await fetch(`/api/available-slots?service_id=${serviceId}&start_date=${startDateStr}&end_date=${endDateStr}`);
			if (!response.ok) {
				let errorMsg = 'Failed to fetch calendar availability';
				try {
					const errorData = await response.json();
					errorMsg = errorData.error || errorMsg;
				} catch (jsonError: unknown) {
					console.warn('Failed to parse calendar availability error response as JSON:', jsonError);
				}
				throw new Error(errorMsg);
			}

			const slotsData: CalculatedSlot[] = await response.json();
			console.log('[fetchCalendarAvailability] Raw slots data from API:', slotsData);

			// Map slots to CalendarEvent objects
			const slotEvents: CalendarEvent[] = slotsData
				.filter((slot) => slot.remaining_capacity > 0 && slot.start_time)
				.map((slot) => {
					const start = new Date(slot.start_time);
					return {
						id: slot.start_time, // Use the raw string as the ID
						title: `Available (${slot.remaining_capacity} spots)`,
						start,
						end: new Date(slot.end_time),
						allDay: false,
						resource: {
							type: 'availability-slot',
							capacity: slot.remaining_capacity,
							price: slot.price_per_pet,
							rawStartTime: slot.start_time, // Store the original string key
						},
					} as CalendarEvent;
				});

			// Also populate aggregatedSlots for lookup, using the raw startTime
			const aggregatedData: AggregatedSlot[] = slotsData.map((slot) => ({
				serviceId: parseInt(serviceId, 10),
				serviceName: getServiceName(parseInt(serviceId, 10)),
				startTime: slot.start_time, // Use the exact string from API
				endTime: slot.end_time,
				totalRemainingCapacity: slot.remaining_capacity,
				price_per_pet: slot.price_per_pet ?? 0,
				uses_staff_capacity: slot.uses_staff_capacity ?? false,
				zero_capacity_reason: slot.zero_capacity_reason ?? null,
			}));
			console.log('[fetchCalendarAvailability] Aggregated slots for lookup:', aggregatedData);
			setAggregatedSlots(aggregatedData);

			setCalendarDisplayEvents(slotEvents);
			console.log(`Created ${slotEvents.length} availability slots for the calendar week.`);
		} catch (e) {
			const message = e instanceof Error ? e.message : 'Failed to load calendar availability';
			console.error(message, e);
			setError(message); // Set component error state
			setCalendarDisplayEvents([]); // Clear markers on error
		} finally {
			setIsLoadingCalendarDisplay(false);
		}
	}, []); // Dependency array remains empty as params are passed

	// Trigger fetchCalendarAvailability when service or view date changes
	useEffect(() => {
		fetchCalendarAvailability(selectedServiceId, calendarViewDate);
	}, [selectedServiceId, calendarViewDate, fetchCalendarAvailability]);

	// Handler for Pet Selection Change
	const handlePetSelectionChange = (event: ChangeEvent<HTMLInputElement>) => {
		const petId = parseInt(event.target.value, 10);
		const isChecked = event.target.checked;

		setSelectedPetIds((prevSelectedIds) => {
			if (isChecked) {
				// Add ID if checked and not already present
				return prevSelectedIds.includes(petId) ? prevSelectedIds : [...prevSelectedIds, petId];
			} else {
				// Remove ID if unchecked
				return prevSelectedIds.filter((id) => id !== petId);
			}
		});
	};

	// Handler for Slot Selection Toggle
	const handleSlotSelectionToggle = (slotKey: string) => {
		console.log('[handleSlotSelectionToggle] Toggling key:', slotKey);
		setSelectedSlots((prevSelected) => {
			const newSelected = new Set(prevSelected);
			if (newSelected.has(slotKey)) {
				newSelected.delete(slotKey);
			} else {
				newSelected.add(slotKey);
			}
			return newSelected;
		});
	};

	// Calculate Total Price
	const calculateTotalPrice = () => {
		if (selectedSlots.size === 0 || selectedPetIds.length === 0) {
			return 0;
		}

		let total = 0;
		const selectedService = services.find((s) => s.id === parseInt(selectedServiceId, 10));
		const requiresFieldSelection = selectedService?.requires_field_selection ?? false;

		selectedSlots.forEach((slotKey) => {
			let slotPrice = 0;
			if (requiresFieldSelection) {
				// Key is fieldId-startTime
				// NOTE: This part assumes field-specific booking is implemented differently
				// and might need adjustment based on how field IDs are stored/retrieved.
				// For now, let's assume the key directly relates to a raw slot if needed.
				const startTime = slotKey.includes('-') ? slotKey.split('-')[1] : slotKey; // Assume key might just be startTime now
				const slot = rawCalculatedSlots.find((s) => {
					// If key is just startTime and we pick *any* raw slot matching:
					return s.start_time === startTime;
				});
				slotPrice = slot?.price_per_pet ?? 0;
			} else {
				// Key is startTime
				const startTime = slotKey;
				const slot = aggregatedSlots.find((s) => s.startTime === startTime);
				slotPrice = slot?.price_per_pet ?? 0;
			}
			total += slotPrice;
		});

		return total * selectedPetIds.length;
	};

	// Handle Booking Submission
	const handleBookSelectedSlots = async () => {
		setError(null); // Clear previous errors
		// Validate essential selections
		if (!selectedBookingDate || selectedSlots.size === 0 || selectedPetIds.length === 0 || !selectedServiceId) {
			alert('Please select a date, a service, at least one pet, and at least one time slot.');
			return;
		}

		console.log('Booking for date:', selectedBookingDate.toLocaleDateString());
		console.log('Booking selected slots (startTimes):', selectedSlots);
		console.log('Booking for pets:', selectedPetIds);

		setIsLoadingBookings(true); // Use the dedicated booking loading state

		let bookingSuccess = true;
		const bookingResults = [];

		// Iterate through each selected slot (identified by startTime string)
		for (const slotKey of selectedSlots) {
			const startTime = slotKey;
			// Find the corresponding aggregated slot details from state
			const slotDetails = aggregatedSlots.find((s) => s.startTime === startTime);

			if (!slotDetails) {
				console.error(`Could not find details for selected slot key: ${slotKey}`);
				bookingResults.push({ slot: slotKey, success: false, error: 'Slot details not found internally.' });
				bookingSuccess = false;
				continue; // Skip to next slot
			}

			// Construct the payload for the API
			const payload = {
				service_id: parseInt(selectedServiceId, 10),
				start_time: slotDetails.startTime, // Use the found start time
				end_time: slotDetails.endTime, // Use the found end time
				pet_ids: selectedPetIds,
				// Note: The API should handle field assignment based on service/time/capacity
				// date: selectedBookingDate.toISOString().split('T')[0] // Pass date if API needs it explicitly
			};

			console.log('Sending booking payload:', payload);

			try {
				const response = await fetch('/api/client-booking', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(payload),
				});

				if (!response.ok) {
					let errorData = { error: `Booking failed (HTTP ${response.status})` };
					try {
						errorData = await response.json();
					} catch (jsonError) {
						// Log the error if parsing JSON fails
						console.warn('Could not parse booking error response as JSON:', jsonError);
					}
					throw new Error(errorData.error || `Booking failed (HTTP ${response.status})`);
				}
				const result = await response.json();
				bookingResults.push({ slot: slotKey, success: true, data: result });
			} catch (e) {
				const message = e instanceof Error ? e.message : 'Unknown booking error occurred.';
				console.error(`Error booking slot ${slotKey}:`, e);
				bookingResults.push({ slot: slotKey, success: false, error: message });
				bookingSuccess = false;
				// Decide if we should stop on first error or try all slots
				// break; // Uncomment to stop on first error
			}
		} // End loop through selectedSlots

		setIsLoadingBookings(false);

		if (bookingSuccess) {
			alert('All selected slots booked successfully!'); // Simple feedback for now
			setSelectedSlots(new Set()); // Clear selection on success
			setSelectedBookingDate(null); // Clear selected date
			setRawCalculatedSlots([]); // Clear results
			setAggregatedSlots([]); // Clear aggregated results
			fetchClientBookings(); // Refresh the list of client's bookings
			// Optionally refetch calendar availability if needed
		} else {
			// Provide more detailed error feedback
			const failedSlots = bookingResults.filter((r) => !r.success);
			setError(
				`Failed to book ${failedSlots.length} slot(s). Errors: ${failedSlots
					.map((f) => `Slot starting ${new Date(f.slot ?? '').toLocaleTimeString()}: ${f.error}`)
					.join('; ')}`
			);
			// Consider only clearing *failed* slots from selection?
		}
	};

	// === Calendar Interaction Handlers ===
	const handleCalendarNavigate = (newDate: Date) => {
		console.log('Calendar navigating to:', newDate);
		setCalendarViewDate(newDate); // Update the view date state
		// Fetching is handled by the useEffect watching calendarViewDate
	};

	// === Helper function for calendar day styling ===
	const dayPropGetter = useCallback(
		(date: Date) => {
			// Check if this date has any available slots
			const hasSlots = calendarDisplayEvents.some(
				(event) => (event.resource as { type?: string })?.type === 'availability-slot' && isSameDay(event.start as Date, date)
			);

			if (hasSlots) {
				return {
					style: {
						backgroundColor: 'rgba(60, 179, 113, 0.1)', // Very light green background for days with slots
						borderRadius: '2px',
					},
				};
			}
			return {};
		},
		[calendarDisplayEvents]
	);

	// Add custom event styling
	const eventStyleGetter = useCallback(
		(event: CalendarEvent) => {
			const resource = event.resource as { type?: string; capacity?: number; rawStartTime?: string };
			if (resource?.type === 'availability-slot' && resource.rawStartTime) {
				const isBooked = isSlotBookedBySelectedPets(resource.rawStartTime);
				if (isBooked) {
					return {
						style: {
							backgroundColor: 'rgba(100, 100, 100, 0.7)', // Greyed out for booked by selection
							borderRadius: '4px',
							border: '1px solid #666',
							color: '#ccc',
							padding: '2px 5px',
							fontSize: '0.9em',
							cursor: 'not-allowed', // Add not-allowed cursor
						},
					};
				}
				// Default style for available slots
				return {
					style: {
						backgroundColor: 'rgba(60, 179, 113, 0.7)', // Green for available
						borderRadius: '4px',
						border: '1px solid #2e8b57',
						color: 'white',
						padding: '2px 5px',
						fontSize: '0.9em',
					},
				};
			}
			return {};
		},
		[isSlotBookedBySelectedPets]
	); // Add dependency

	return (
		<div className={styles.container}>
			<h2 className={styles.title}>Create New Booking</h2>

			{/* Pet Selection - Always at the top */}
			<div className={styles.formGroup}>
				<label>Select Pets:</label>
				{isLoadingPets ? (
					<p>Loading pets...</p>
				) : pets.length > 0 ? (
					<ul className={styles.list}>
						{pets.map((pet) => (
							<li key={pet.id} className={styles.listItemCompact}>
								<label>
									<input
										type="checkbox"
										value={pet.id}
										checked={selectedPetIds.includes(pet.id)}
										onChange={handlePetSelectionChange}
										style={{ marginRight: '8px' }}
									/>
									{pet.name} ({pet.breed})
								</label>
							</li>
						))}
					</ul>
				) : (
					<p>You have no pets registered. Please add pets in the &apos;My Pets&apos; section.</p>
				)}
			</div>

			{/* Service Selection - Immediately after pet selection */}
			<div className={styles.formGroup}>
				<label htmlFor="service-select">Select Service:</label>
				<select
					id="service-select"
					value={selectedServiceId}
					onChange={(e) => {
						setSelectedServiceId(e.target.value);
						setSelectedBookingDate(null);
						setRawCalculatedSlots([]);
						setAggregatedSlots([]);
						setSelectedSlots(new Set());
						setError(null);
					}}
					required
					className={styles.input}
				>
					<option value="">-- Select a Service --</option>
					{services.map((service) => (
						<option key={service.id} value={service.id}>
							{service.name}
						</option>
					))}
				</select>
			</div>

			{/* Moved Up: Selected Date Display */}
			{selectedServiceId && selectedPetIds.length > 0 && selectedBookingDate && (
				<div className={styles.formGroup}>
					<p>
						Selected Date: <strong>{selectedBookingDate.toLocaleDateString()}</strong>
					</p>
				</div>
			)}

			{/* Moved Up: Available Slots Display (for the selected date) */}
			{selectedServiceId && selectedPetIds.length > 0 && selectedBookingDate && (
				<div className={styles.formGroup}>
					<label>Available Slots for {selectedBookingDate.toLocaleDateString()}:</label>
					{isLoadingCalculatedSlots && <p>Loading slots...</p>}
					{error && <p className={styles.error}>{error}</p>}
					{!isLoadingCalculatedSlots && aggregatedSlots.length > 0 && (
						<ul className={styles.list}>
							{aggregatedSlots.map((slot) => {
								const slotKey = `${slot.startTime}`;
								const isSelected = selectedSlots.has(slotKey);
								const petCount = selectedPetIds.length;
								const insufficientCapacity = slot.totalRemainingCapacity < petCount;
								const isFull = slot.totalRemainingCapacity === 0;
								const isBookedBySelection = isSlotBookedBySelectedPets(slot.startTime);
								const isDisabledByCapacity = isFull || insufficientCapacity;
								const isDisabled = isDisabledByCapacity || isBookedBySelection;
								let slotTextSuffix = isSelected ? ' (Selected)' : '';
								// Use const for style object
								const listItemStyle = {
									padding: '10px',
									border: '1px solid #555',
									marginBottom: '5px',
									cursor: isDisabled ? 'not-allowed' : 'pointer',
									backgroundColor: isSelected ? '#003366' : '#222',
									opacity: 1,
								};

								if (isDisabled) {
									listItemStyle.opacity = 0.6;
									listItemStyle.backgroundColor = '#333';
									if (isBookedBySelection) {
										slotTextSuffix = ' (Already Booked)';
									} else if (isDisabledByCapacity) {
										slotTextSuffix = isFull ? ' (Full)' : ' (Insufficient Capacity)';
									}
								}

								return (
									<li
										key={slotKey}
										style={listItemStyle}
										// Ensure onClick only triggers if !isDisabled
										onClick={() => {
											if (!isDisabled) {
												handleSlotSelectionToggle(slotKey);
											}
										}}
									>
										{formatDateRange(slot.startTime, slot.endTime)} - Capacity: {slot.totalRemainingCapacity}
										{slotTextSuffix}
									</li>
								);
							})}
						</ul>
					)}
					{!isLoadingCalculatedSlots && aggregatedSlots.length === 0 && !error && (
						<p>No available slots found for this date and service.</p>
					)}
				</div>
			)}

			{/* Date Selection Calendar - Render only if service AND pets are selected */}
			{selectedServiceId && selectedPetIds.length > 0 && (
				<div className={styles.formGroup}>
					<label>Select Date:</label>
					{isLoadingCalendarDisplay && <p>Loading available dates...</p>}
					{/* Display general errors only when not loading specific slots */}
					{error && !isLoadingCalculatedSlots && <p className={styles.error}>{error}</p>}
					<CalendarView
						events={calendarDisplayEvents}
						onSelectSlot={undefined}
						onSelectEvent={(event) => {
							const resource = event.resource as { type?: string; rawStartTime?: string };
							if (resource?.type === 'availability-slot') {
								const slotKey = resource.rawStartTime;
								console.log('[onSelectEvent] Event clicked, using slotKey:', slotKey);
								if (slotKey) {
									handleSlotSelectionToggle(slotKey);
									// Also set the selected date when a slot event is clicked
									const slotDate = new Date(event.start);
									slotDate.setHours(0, 0, 0, 0); // Ensure it's just the date part
									console.log('[onSelectEvent] Setting selectedBookingDate:', slotDate);
									setSelectedBookingDate(slotDate);
								} else {
									console.warn('[onSelectEvent] Clicked event is missing rawStartTime in resource:', event);
								}
							}
						}}
						views={['week']}
						defaultView="week"
						onNavigate={handleCalendarNavigate}
						date={calendarViewDate}
						dayPropGetter={dayPropGetter}
						eventStyleGetter={eventStyleGetter}
					/>
				</div>
			)}

			{/* Booking Summary and Action - Ensure this is outside other conditionals */}
			{selectedSlots.size > 0 && selectedPetIds.length > 0 && (
				<div className={styles.formGroup}>
					<h3>Booking Summary</h3>
					<p>Selected Date: {selectedBookingDate?.toLocaleDateString()}</p>
					<p>
						Selected Pets:{' '}
						{pets
							.filter((p) => selectedPetIds.includes(p.id))
							.map((p) => p.name)
							.join(', ')}
					</p>
					<p>Selected Slots:</p>
					<ul className={styles.listCompact}>
						{Array.from(selectedSlots).map((slotKey) => {
							console.log('[Booking Summary] Looking up slotKey:', slotKey);
							console.log(
								'[Booking Summary] Available aggregatedSlots keys:',
								aggregatedSlots.map((s) => s.startTime)
							);
							const slot = aggregatedSlots.find((s) => s.startTime === slotKey);
							console.log('[Booking Summary] Found slot:', slot);
							return (
								<li key={slotKey}>
									{
										slot
											? `${formatDateRange(slot.startTime, slot.endTime)} @ ${formatPrice(slot.price_per_pet)}/pet`
											: `Slot details not found for key: ${slotKey}` // Add key to error msg
									}
								</li>
							);
						})}
					</ul>
					<p>
						Total Price: <strong>{formatPrice(calculateTotalPrice())}</strong>
					</p>
					<button
						onClick={handleBookSelectedSlots}
						disabled={isLoadingCalculatedSlots || isLoadingBookings}
						className={`${styles.button} ${styles.primary}`}
					>
						{isLoadingBookings ? 'Booking...' : 'Book Selected Slots'}
					</button>
				</div>
			)}
		</div>
	);
}
