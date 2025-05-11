'use client';

import React, { useState, useCallback, useEffect } from 'react';
import type { ChangeEvent } from 'react'; // Added ChangeEvent
import styles from '@/app/page.module.css'; // Adjust path as needed
import CalendarView, { CalendarEvent } from '@/components/shared/CalendarView'; // Import CalendarView
import Modal from '@/components/shared/Modal'; // Import Modal component
import { formatISO, isSameDay, startOfWeek, endOfWeek, getDay as dateFnsGetDay, addDays } from 'date-fns'; // Import date-fns helpers and format, and startOfWeek, endOfWeek, getDay, addDays
import { Service, Booking, Pet as SharedPet, CreateBookingPayload, AvailableSlot } from '@booking-and-accounts-monorepo/shared-types'; // Use SharedPet alias & added AvailableSlot
import { fetchMyBookingsAPI, createClientBookingAPI, fetchAvailableSlots } from '@booking-and-accounts-monorepo/api-services'; // Changed fetchMyBookings to fetchMyBookingsAPI
import { fetchUserPets } from '@booking-and-accounts-monorepo/api-services'; // Added pet service import

// --- Time/Date Formatting Helpers (Simplified) ---

// REMOVED Unused Helpers
// Formatter for time slots - Extract HH:mm
// const formatTime = (isoString: string): string => {
// 	if (!isoString || !isoString.includes('T')) return 'N/A';
// 	try {
// 		const timePart = isoString.split('T')[1];
// 		return timePart.substring(0, 5); // Get HH:mm
// 	} catch (e) {
// 		console.error("Error extracting time:", isoString, e);
// 		return 'Invalid Time';
// 	}
// };

// Simple date formatter for display - Extract YYYY-MM-DD
// const formatDate = (isoString: string): string => {
// 	if (!isoString || !isoString.includes('T')) return 'Invalid Date';
// 	try {
// 		return isoString.split('T')[0];
// 	} catch {
// 		return 'Invalid Date';
// 	}
// };

// --- End Helpers ---

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
	other_staff_potentially_available?: boolean; // New field from RPC
};

// Define a new type for the aggregated data used for display
type AggregatedSlot = {
	serviceId: number; // Keep service ID for potential use
	serviceName: string; // Need service name for display
	startTime: string; // ISO string
	endTime: string; // ISO string
	totalRemainingCapacity: number | null; // ENSURE THIS IS number | null
	price_per_pet: number; // Use the lowest price found for this time block?
	uses_staff_capacity: boolean; // Indicates if capacity is staff-based
	zero_capacity_reason: string | null; // 'staff_full', 'no_staff', 'base_full', or null
	other_staff_potentially_available?: boolean; // New field from RPC, matches AvailableSlot
	// Keep track of contributing fields/slots if needed for booking later?
	// contributingSlots: CalculatedSlot[];
	field_ids?: number[]; // Added field_ids based on CalculatedSlot
};

// Type definition based on /api/my-bookings response
// Removed unused ClientBookingDetails
// type ClientBookingDetails = {
// 	booking_id: number;
// 	start_time: string;
// 	end_time: string;
// 	service_type: string | null;
// 	status: string;
// 	field_id: number;
// 	pets: { id: number; name: string }[]; // Array of pets linked to this booking
// };

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

// --- Types Definition (moved here or import from shared types) ---

// Input structure for a single booking (matching API)
// Removed unused BookingInput
// interface BookingInput {
//     service_id: number;
//     start_time: string;
//     end_time: string;
//     pet_ids: number[];
// }

// Type for the API response when booking
// Removed unused BookingApiResponse
// interface BookingApiResponse {
//     message: string;
//     successfulBookings?: { id: number; serviceName: string; start_time: string; end_time: string }[];
//     failedBookings?: { input: BookingInput; error: string }[];
//     error?: string; // Optional top-level error
// }

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
	const [isLoadingCalculatedSlots, setIsLoadingCalculatedSlots] = useState(false);

	// State for pets
	const [pets, setPets] = useState<SharedPet[]>([]);
	const [isLoadingPets, setIsLoadingPets] = useState(true);
	const [selectedPetIds, setSelectedPetIds] = useState<number[]>([]);

	// State for slots and selections
	const [selectedSlots, setSelectedSlots] = useState<Set<string>>(new Set()); // Use Set for easy add/remove

	const [myBookings, setMyBookings] = useState<Booking[]>([]); // State for bookings
	const [, setLoadingMyBookings] = useState(false); // loadingMyBookings removed, setter kept

	// State for Calendar Events (visual markers)
	const [calendarDisplayEvents, setCalendarDisplayEvents] = useState<CalendarEvent[]>([]); // Add setter back
	const [isLoadingCalendarDisplay, setIsLoadingCalendarDisplay] = useState(false); // Re-added state and setter

	// State for current calendar view range - use helper function for initial state
	const [calendarViewDate, setCalendarViewDate] = useState<Date>(getInitialCalendarDate());

	// NEW: State for booking success message
	const [bookingSuccessMessage, setBookingSuccessMessage] = useState<string | null>(null);

	// --- State for Enquiry Modal ---
	const [isEnquiryModalOpen, setIsEnquiryModalOpen] = useState(false);
	const [enquirySlot, setEnquirySlot] = useState<AggregatedSlot | null>(null);
	// -----------------------------

	// Define helper here to be accessible throughout the component
	const getServiceName = useCallback(
		(id: number) => services.find((s) => s.id === id)?.name || `Service ID ${id}`,
		[services] // Add services as a dependency
	);

	// Basic formatter functions
	// Revert formatDateRange to use London time for display consistency with calendar visual
	const formatDateRange = (startStr: string, endStr: string): string => {
		try {
			const start = new Date(startStr);
			const end = new Date(endStr);
			// Use Europe/London timezone for display
			const optionsDate: Intl.DateTimeFormatOptions = {
				timeZone: 'Europe/London',
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
			};
            const optionsTime: Intl.DateTimeFormatOptions = {
				timeZone: 'Europe/London',
				hour: '2-digit',
				minute: '2-digit',
				hour12: false, // Use 24-hour format HH:mm
			};
            // Format like: YYYY-MM-DD HH:mm - HH:mm
            const startDateStr = start.toLocaleDateString('en-CA', optionsDate); // en-CA gives YYYY-MM-DD
            const startTimeStr = start.toLocaleTimeString('en-GB', optionsTime); // en-GB gives HH:mm
            const endTimeStr = end.toLocaleTimeString('en-GB', optionsTime); // en-GB gives HH:mm

			return `${startDateStr} ${startTimeStr} - ${endTimeStr}`;
		} catch (_e) { // Changed to _e to indicate it's unused intentionally
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
		if (selectedPetIds.length === 0 || myBookings.length === 0) {
			return false;
		}
		return myBookings.some((booking) => {
			const bookingStartTimeStr = booking.start_time.endsWith('+00:00') ? booking.start_time : booking.start_time + '+00:00';
			const slotUTCTimestamp = new Date(slotStartTime).getTime();
			const bookingUTCTimestamp = new Date(bookingStartTimeStr).getTime();

            // Check if times match and if booking.pets (now defined) overlaps with selectedPetIds
			return slotUTCTimestamp === bookingUTCTimestamp &&
                   booking.pets?.some(pet => selectedPetIds.includes(pet.id)); // Added optional chaining
		});
	};

	// Moved loadMyBookings outside of useEffect and wrapped with useCallback
	const loadMyBookings = useCallback(async () => {
		setLoadingMyBookings(true);
		try {
			const data = await fetchMyBookingsAPI(''); // Use service function
			setMyBookings(data);
		} catch (e) {
			console.error("Failed to fetch existing bookings:", e);
			setError('Failed to load your bookings. Please try again.'); // Set an error message for the user
		} finally {
			setLoadingMyBookings(false);
		}
	}, [setMyBookings, setLoadingMyBookings, setError]); // Add dependencies for useCallback

	// Fetch existing bookings to check for conflicts (consider if this is still needed or handled differently)
	useEffect(() => {
		loadMyBookings();
	}, [loadMyBookings]); // useEffect now depends on the memoized loadMyBookings

	// Effect to clear success message after a few seconds
	useEffect(() => {
		if (bookingSuccessMessage) {
			const timer = setTimeout(() => {
				setBookingSuccessMessage(null);
			}, 5000); // Clear after 5 seconds
			return () => clearTimeout(timer);
		}
	}, [bookingSuccessMessage]);

	// Fetch pets on mount
	const fetchPets = async () => {
		setIsLoadingPets(true);
		try {
			const data = await fetchUserPets(); // Use service function
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

	useEffect(() => {
		fetchPets();
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

		try {
			const slotsData: AvailableSlot[] = await fetchAvailableSlots({ serviceId, startDate: startDateStr, endDate: endDateStr });

			// Create a set of start times for the user's existing bookings for quick lookup
			// Normalizing to ISO string for reliable comparison
			const userBookedStartTimes = new Set(
				myBookings.map(b => new Date(b.start_time).toISOString())
			);

			// Map slots to CalendarEvent objects, excluding those already booked by the user
			const slotEvents: CalendarEvent[] = slotsData
				.filter(slot => {
					// Exclude if this slot's start time is in the user's existing bookings
					const isAlreadyBookedByUser = userBookedStartTimes.has(new Date(slot.start_time).toISOString());
					if (isAlreadyBookedByUser) {
						return false; // Do not create a green/yellow event for this
					}
					// Keep slots with >0 capacity or if other staff might be available (for enquiry)
					return (slot.remaining_capacity > 0 || slot.other_staff_potentially_available === true) && slot.start_time;
				})
				.map((slot) => {
					const start = new Date(slot.start_time);
					const isPotentiallyEnquire = slot.remaining_capacity === 0 && slot.other_staff_potentially_available === true;
					return {
						id: slot.start_time, // Use the raw string as the ID
						// Modify title for enquire state
						title: isPotentiallyEnquire ? 'Enquire' : `Available (${slot.remaining_capacity} spots)`,
						start,
						end: new Date(slot.end_time),
						allDay: false,
						resource: {
							type: 'availability-slot',
							capacity: slot.remaining_capacity,
							price: slot.price_per_pet,
							rawStartTime: slot.start_time, // Store the original string key
							// We don't necessarily need the other_staff flag in the *event resource*
							// as eventStyleGetter will look it up in aggregatedSlots
						},
					} as CalendarEvent;
				});

			// Also populate aggregatedSlots for lookup, using the raw startTime
			// Note: Mapping AvailableSlot to AggregatedSlot. These types are similar.
			// Consider unifying them or placing CalculatedSlot in shared types if it's more general.
			const aggregatedData: AggregatedSlot[] = slotsData.map((slot) => ({
				serviceId: parseInt(serviceId, 10),
				serviceName: getServiceName(parseInt(serviceId, 10)),
				startTime: slot.start_time, // Use the exact string from API
				endTime: slot.end_time,
				totalRemainingCapacity: slot.remaining_capacity, // This is now number | null, matching AggregatedSlot type
				price_per_pet: slot.price_per_pet ?? 0,
				uses_staff_capacity: slot.uses_staff_capacity ?? false,
				zero_capacity_reason: slot.zero_capacity_reason ?? null,
				other_staff_potentially_available: slot.other_staff_potentially_available ?? false,
				field_ids: slot.field_ids,
			}));
			setAggregatedSlots(aggregatedData);

			// Combine available slots with user's existing bookings for calendar display
			const existingBookingEvents: CalendarEvent[] = myBookings.map(booking => ({
				id: booking.id
					? `booking-${booking.id}`
					: `booking-${booking.start_time}-${booking.end_time}`,
				title: booking.service && booking.service.name // Check for nested service name first
					? `Booked: ${booking.service.name}`
					: typeof booking.service_id === 'number'
						? `Booked: ${getServiceName(booking.service_id)}`
						: 'Booked', // Fallback to just 'Booked'
				start: new Date(booking.start_time),
				end: new Date(booking.end_time),
				allDay: false,
				resource: { type: 'existing-booking', bookingId: booking.id }
			}));

			setCalendarDisplayEvents([...slotEvents, ...existingBookingEvents]);
		} catch (e) {
			const message = e instanceof Error ? e.message : 'Failed to load calendar availability';
			setError(message);
			setCalendarDisplayEvents([]);
		} finally {
			setIsLoadingCalendarDisplay(false);
		}
	}, [getServiceName, setIsLoadingCalendarDisplay, setError, myBookings]); // Add myBookings to dependencies

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

	// Handler for Slot Selection Toggle (Only for bookable slots)
	const handleSlotSelectionToggle = (slotKey: string) => {
		setSelectedSlots((prevSelected) => {
			const newSelected = new Set(prevSelected);
			if (newSelected.has(slotKey)) {
				newSelected.delete(slotKey);
			} else {
				newSelected.add(slotKey);
			}
			return newSelected;
		});
		// Also set the date when a *bookable* slot is toggled
		const slot = aggregatedSlots.find((s) => s.startTime === slotKey);
		if (slot) {
			const slotDate = new Date(slot.startTime);
			slotDate.setHours(0, 0, 0, 0);
			setSelectedBookingDate(slotDate);
		}
	};

	// New helper to check if a slot is generally booked by the user (any of their pets)
	const isSlotBookedByUser = useCallback((slotStartTime: string): boolean => {
		if (myBookings.length === 0) {
			return false;
		}
		const slotStartTimestamp = new Date(slotStartTime).getTime();
		return myBookings.some((booking) => {
			const bookingStartTimestamp = new Date(booking.start_time).getTime();
			// Consider also checking booking.service_id if relevant for your logic
			return bookingStartTimestamp === slotStartTimestamp;
		});
	}, [myBookings]);

	// Calculate Total Price
	const calculateTotalPrice = () => {
		if (selectedSlots.size === 0 || selectedPetIds.length === 0) {
			return 0;
		}

		let total = 0;
		// const selectedService = services.find((s) => s.id === parseInt(selectedServiceId, 10));
		// const requiresFieldSelection = selectedService?.requires_field_selection ?? false;

		selectedSlots.forEach((slotKey) => {
			let slotPrice = 0;
			// Always find the slot in aggregatedSlots as selectedSlots keys are derived from them
			const slot = aggregatedSlots.find(
				(s) => `${formatISO(new Date(s.startTime))}-${s.serviceId}` === slotKey
			);
			slotPrice = slot?.price_per_pet ?? 0;
			total += slotPrice;
		});

		return total * selectedPetIds.length;
	};

	// Handle Booking Submission
	const handleBookSelectedSlots = async () => {
		if (selectedPetIds.length === 0) {
			setError('Please select at least one pet.');
			return;
		}
		if (selectedSlots.size === 0) {
			setError('Please select at least one slot to book.');
			return;
		}

		const bookingPayloads: CreateBookingPayload[] = [];
		selectedSlots.forEach((slotKey) => {
			const slot = aggregatedSlots.find(
				(s) => `${formatISO(new Date(s.startTime))}-${s.serviceId}` === slotKey
			);
			if (slot) {
				bookingPayloads.push({
					service_id: slot.serviceId,
					start_time: slot.startTime,
					end_time: slot.endTime,
					pet_ids: selectedPetIds,
					field_ids: slot.field_ids || [], // Ensure field_ids is an array
				});
			}
		});

		if (bookingPayloads.length === 0) {
			setError('Could not find details for the selected slots.');
			return;
		}

		// Optimistically update UI or show loading state
		// setLoading(true); // You'll need a new state for this if you want fine-grained loading for booking
		setError(null);
		// setSuccessMessage(null); // Removed as per previous refactoring

		try {
			await createClientBookingAPI('', bookingPayloads); // Pass empty string for apiBaseUrl as web app calls its own backend
			// setSuccessMessage(result.message); // Removed
			setBookingSuccessMessage('Booking successful! Your booking has been confirmed.'); // Set success message
			setSelectedSlots(new Set()); // Clear selection on success
			// Refresh bookings list
			await loadMyBookings(); // Now correctly calls the accessible function
		} catch (e: unknown) {
			console.error('Booking failed:', e);
			if (e instanceof Error) {
				setError(e.message);
			} else {
				setError('An unexpected error occurred during booking.');
			}
		} finally {
			// setLoading(false);
		}
	};

	// === Calendar Interaction Handlers ===
	const handleCalendarNavigate = (newDate: Date) => {
		setCalendarViewDate(newDate); // Update the view date state
		setSelectedSlots(new Set()); // Clear previous selections
		setSelectedBookingDate(null); // Clear the displayed selected date
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
			const resource = event.resource as { type?: string; capacity?: number; rawStartTime?: string; bookingId?: number };

			if (resource?.type === 'existing-booking') {
				// Style for client's existing bookings
				return {
					style: {
						backgroundColor: 'rgba(255, 0, 0, 0.7)', // Red for booked
						borderRadius: '4px',
						border: '1px solid #cc0000',
						color: 'white',
						padding: '2px 5px',
						fontSize: '0.9em',
						cursor: 'not-allowed',
					},
				};
			}

			if (resource?.type === 'availability-slot' && resource.rawStartTime) {
				const slotKey = resource.rawStartTime;
				const isBooked = isSlotBookedBySelectedPets(slotKey);
				// Find the matching aggregated slot to check the other_staff flag
				const aggSlot = aggregatedSlots.find((s) => s.startTime === slotKey);
				const isPotentiallyEnquire = aggSlot?.totalRemainingCapacity === 0 && aggSlot?.other_staff_potentially_available === true;

				if (isBooked) {
					// Style for already booked by this client/pets
					return {
						style: {
							backgroundColor: 'rgba(100, 100, 100, 0.7)', // Greyed out
							borderRadius: '4px',
							border: '1px solid #666',
							color: '#ccc',
							padding: '2px 5px',
							fontSize: '0.9em',
							cursor: 'not-allowed',
						},
					};
				} else if (isPotentiallyEnquire) {
					// Style for Enquiry slots
					return {
						style: {
							backgroundColor: 'rgba(204, 153, 0, 0.7)', // Muted yellow/orange
							borderRadius: '4px',
							border: '1px solid #b38600',
							color: 'white',
							padding: '2px 5px',
							fontSize: '0.9em',
							cursor: 'pointer', // Allow clicking to enquire
						},
					};
				} else {
					// Default style for available slots
					return {
						style: {
							backgroundColor: 'rgba(60, 179, 113, 0.7)', // Green
							borderRadius: '4px',
							border: '1px solid #2e8b57',
							color: 'white',
							padding: '2px 5px',
							fontSize: '0.9em',
							cursor: 'pointer',
						},
					};
				}
			}
			return {}; // Default empty style
		},
		[isSlotBookedBySelectedPets, aggregatedSlots] // Add aggregatedSlots dependency
	);

	// --- Update handleEnquiryClick to open modal ---
	const handleEnquiryClick = (slot: AggregatedSlot) => {
		setEnquirySlot(slot); // Store the slot details for the modal
		setIsEnquiryModalOpen(true); // Open the modal
	};
	// --------------------------------------------

	// --- Update onSelectEvent logic ---
	const handleEventClick = (event: CalendarEvent) => {
		const resource = event.resource as { type?: string; rawStartTime?: string; bookingId?: number }; // Ensure bookingId is in type

		// If it's an existing booking, do nothing on click
		if (resource?.type === 'existing-booking') {
			return;
		}

		if (resource?.type === 'availability-slot' && resource.rawStartTime) {
			const rawStartTimeKey = resource.rawStartTime; // This is just the ISO string

			const aggSlot = aggregatedSlots.find((s) => s.startTime === rawStartTimeKey);
			if (!aggSlot) {
				console.warn("Aggregated slot not found for calendar event click:", rawStartTimeKey);
				return;
			}

			// Check if booked by user first
			if (isSlotBookedBySelectedPets(rawStartTimeKey)) { // isSlotBookedBySelectedPets uses raw start time
				return; // Do nothing if already booked by this user
			}

			// Check if it's an enquiry slot
			const isEnquiry = aggSlot.totalRemainingCapacity === 0 && aggSlot.other_staff_potentially_available === true;
			if (isEnquiry) {
				handleEnquiryClick(aggSlot); // Trigger enquiry modal
			} else if (aggSlot.totalRemainingCapacity > 0) {
				// It's a normally bookable slot, toggle selection using the composite key
				const compositeSlotKey = `${formatISO(new Date(aggSlot.startTime))}-${aggSlot.serviceId}`;
				handleSlotSelectionToggle(compositeSlotKey);
			}
		}
	};
	// ----------------------------------

	// --- Slot Aggregation Logic ---
	// This function needs to be defined or imported if it's complex.
	// For now, assuming a simplified version or it's correctly implemented elsewhere.
	const aggregateSlotsByTimeAndService = (
		slots: AvailableSlot[],
		serviceId: number,
		serviceName: string
	): AggregatedSlot[] => {
		const groupedByTime = new Map<string, AvailableSlot[]>();

		slots.forEach((slot) => {
			const key = `${slot.start_time}_${slot.end_time}`; // Group by start and end time
			if (!groupedByTime.has(key)) {
				groupedByTime.set(key, []);
			}
			groupedByTime.get(key)!.push(slot);
		});

		return Array.from(groupedByTime.entries()).map(([timeKey, group]) => {
			// Calculate total capacity: if any slot in group has null, total is null (unlimited). Otherwise, sum.
			let calculatedTotalCapacity: number | null = 0;
			let someCapacityIsNull = false;
			for (const slot of group) {
				if (slot.remaining_capacity === null) {
					someCapacityIsNull = true;
					break;
				}
				calculatedTotalCapacity += slot.remaining_capacity;
			}
			if (someCapacityIsNull) {
				calculatedTotalCapacity = null;
			}

			// If all slots had 0 capacity, and some were null (treated as 0 above for summing numbers),
			// but the intent of null is 'unlimited', this needs refinement.
			// For now: sum numbers; if any was null, result is null.

			const representativeSlot = group[0]; // All slots in a group share start/end time

			// Determine if any slot in the group has other_staff_potentially_available
			const anyOtherStaffAvailable = group.some(s => s.other_staff_potentially_available === true);

			return {
				serviceId: serviceId,
				serviceName: serviceName,
				startTime: representativeSlot.start_time,
				endTime: representativeSlot.end_time,
				totalRemainingCapacity: calculatedTotalCapacity,
				price_per_pet: representativeSlot.price_per_pet ?? 0, // Use first slot's price or default
				uses_staff_capacity: representativeSlot.uses_staff_capacity ?? false,
				zero_capacity_reason: representativeSlot.zero_capacity_reason ?? null,
				other_staff_potentially_available: anyOtherStaffAvailable,
				field_ids: representativeSlot.field_ids,
			};
		});
	};

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

			{/* Available Slots Display (now shows for the visible week once loaded) */}
			{selectedServiceId && selectedPetIds.length > 0 && (
				<div className={styles.formGroup}>
					<label>
						Available Slots for Week of {formatISO(startOfWeek(calendarViewDate, { weekStartsOn: 1 }), { representation: 'date' })}:
					</label>
					{error && <p className={styles.error}>{error}</p>}
					{bookingSuccessMessage && <p className={styles.successMessage}>{bookingSuccessMessage}</p>}
					{aggregatedSlots.length > 0 ? (
						<ul className={styles.list}>
							{aggregatedSlots
								.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()) // Sort slots chronologically
								.map((slot) => {
									// Use composite key for selection to match booking logic
									const slotKey = `${formatISO(new Date(slot.startTime))}-${slot.serviceId}`;
									const isSelected = selectedSlots.has(slotKey);
									const petCount = selectedPetIds.length;

									// --- Updated Disable/Enquire/Booked Checks ---
									const isGenerallyBookedByUser = isSlotBookedByUser(slot.startTime);
									const isBookedByCurrentSelection = isSlotBookedBySelectedPets(slot.startTime); // Checks for currently selected pets
									const isFull = slot.totalRemainingCapacity === 0;
									const insufficientCapacity = slot.totalRemainingCapacity !== null && slot.totalRemainingCapacity < petCount;
									const isEnquiryOnly = isFull && slot.other_staff_potentially_available === true && !isGenerallyBookedByUser && !isBookedByCurrentSelection;

									// Slot is truly disabled if generally booked by user, or booked by current selection, or (full/insufficient capacity AND not an enquiry case)
									const isDisabled = isGenerallyBookedByUser || isBookedByCurrentSelection || ((isFull || insufficientCapacity) && !isEnquiryOnly);
									// --- End Updated Checks ---

									let slotTextSuffix = isSelected ? ' (Selected)' : '';
									const listItemStyle = {
										padding: '10px',
										border: '1px solid #555',
										marginBottom: '5px',
										cursor: 'default', // Default cursor
										backgroundColor: isSelected ? '#003366' : '#222',
										opacity: 1,
									};

									if (isGenerallyBookedByUser) {
										listItemStyle.backgroundColor = '#D32F2F'; // More distinct red for booked
										listItemStyle.cursor = 'not-allowed';
										listItemStyle.opacity = 0.7;
										slotTextSuffix = ' (Booked)';
									} else if (isEnquiryOnly) {
										listItemStyle.backgroundColor = '#4a4a2a'; // Enquiry color (e.g., muted yellow/orange)
										listItemStyle.cursor = 'pointer';
										slotTextSuffix = ' (Enquire)';
									} else if (isDisabled) { // This now covers isBookedByCurrentSelection or capacity issues
										listItemStyle.opacity = 0.6;
										listItemStyle.backgroundColor = '#333';
										listItemStyle.cursor = 'not-allowed';
										if (isBookedByCurrentSelection) {
											slotTextSuffix = ' (Booked for Selected Pets)';
										} else {
											slotTextSuffix = isFull ? ' (Full)' : ' (Insufficient Capacity)';
										}
									} else {
										// Default available slot cursor
										listItemStyle.cursor = 'pointer';
									}

									return (
										<li
											key={slotKey}
											style={listItemStyle}
											onClick={() => {
												if (isGenerallyBookedByUser) { // Prevent action if generally booked
													return;
												}
												if (isEnquiryOnly) {
													handleEnquiryClick(slot);
												} else if (!isDisabled) { // isDisabled will be true if booked by current selection or capacity issues
													// When clicking on the list item, use the same composite key
													handleSlotSelectionToggle(slotKey);
												}
											}}
										>
											{formatDateRange(slot.startTime, slot.endTime)} - Capacity: {slot.totalRemainingCapacity === null ? 'Unlimited' : slot.totalRemainingCapacity}
											{slotTextSuffix}
										</li>
									);
								})}
						</ul>
					) : (
						// Show message only if not loading and no error
						!isLoadingCalendarDisplay && !error && <p>No available slots found for this week and service.</p>
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
						onSelectEvent={handleEventClick}
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
							const slot = aggregatedSlots.find((s) => `${formatISO(new Date(s.startTime))}-${s.serviceId}` === slotKey);
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
						disabled={isLoadingCalculatedSlots || isLoadingCalendarDisplay}
						className={`${styles.button} ${styles.primary}`}
					>
						{isLoadingCalendarDisplay ? 'Booking...' : 'Book Selected Slots'}
					</button>
				</div>
			)}

			{/* --- Render Enquiry Modal --- */}
			<Modal isOpen={isEnquiryModalOpen} onClose={() => setIsEnquiryModalOpen(false)} title="Enquire About Slot">
				{enquirySlot && (
					<div>
						<p>
							The slot on <strong>{formatDateRange(enquirySlot.startTime, enquirySlot.endTime)}</strong> is currently full for your
							usual staff member.
						</p>
						<p>However, another staff member may be available. Please contact us to enquire about booking this specific slot:</p>
						<ul>
							{/* Replace with actual contact details */}
							<li>Phone: [Your Phone Number]</li>
							<li>Email: [Your Email Address]</li>
						</ul>
						<button
							onClick={() => setIsEnquiryModalOpen(false)}
							className={`${styles.button} ${styles.secondary}`}
							style={{ marginTop: '1rem' }}
						>
							Close
						</button>
					</div>
				)}
			</Modal>
			{/* -------------------------- */}
		</div>
	);
}
