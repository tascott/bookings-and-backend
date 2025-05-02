'use client';

import { useState, useCallback, useEffect, ChangeEvent } from 'react';
import styles from "@/app/page.module.css"; // Adjust path as needed
import CalendarView, { CalendarEvent } from '@/components/shared/CalendarView'; // Import CalendarView
import { formatISO, parseISO, format, isSameDay, startOfWeek, endOfWeek, getDay as dateFnsGetDay, addDays } from 'date-fns'; // Import date-fns helpers and format, and startOfWeek, endOfWeek, getDay, addDays

// Define required types directly or import from a shared types file later
type Service = {
  id: number;
  name: string;
  description: string | null;
  created_at: string;
  requires_field_selection: boolean;
  default_price?: number | null; // Add price
}

// Updated to match actual API response structure from console log
type CalculatedSlot = {
    // These fields might still be useful if requires_field_selection is true,
    // but are not used in aggregation logic based on console logs.
    // Keep them commented or remove if definitely unused.
    // slot_field_id?: number;
    // slot_field_name?: string;

    // Fields actually used in aggregation, based on console log and required logic
    start_time: string;           // API key: start_time
    end_time: string;             // API key: end_time
    remaining_capacity: number;   // API key: remaining_capacity
    price_per_pet?: number | null; // API key: price_per_pet (optional)
    zero_capacity_reason?: string | null; // 'staff_full', 'no_staff', 'base_full', or null

    // Optional fields seen in the log, keep if needed elsewhere
    capacity_display?: string;
    field_ids?: number[];
    uses_staff_capacity?: boolean;
}

// Define a new type for the aggregated data used for display
type AggregatedSlot = {
    serviceId: number; // Keep service ID for potential use
    serviceName: string; // Need service name for display
    startTime: string; // ISO string
    endTime: string;   // ISO string
    totalRemainingCapacity: number;
    price_per_pet: number; // Use the lowest price found for this time block?
    uses_staff_capacity: boolean; // Indicates if capacity is staff-based
    zero_capacity_reason: string | null; // 'staff_full', 'no_staff', 'base_full', or null
    // Keep track of contributing fields/slots if needed for booking later?
    // contributingSlots: CalculatedSlot[];
}

// Define Pet type
type Pet = {
    id: number;
    client_id: number;
    name: string;
    breed?: string | null;
    size?: string | null;
    created_at?: string;
    is_confirmed?: boolean;
}

// Type definition based on /api/my-bookings response
type ClientBookingDetails = {
    booking_id: number;
    start_time: string;
    end_time: string;
    service_type: string | null;
    status: string;
    field_id: number;
    pets: { id: number; name: string }[]; // Array of pets linked to this booking
}

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
        const daysToAdd = dayOfWeek === 0 ? 1 : (7 - dayOfWeek + 1);
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
    const [isLoadingCalculatedSlots, setIsLoadingCalculatedSlots] = useState(false);

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
    const getServiceName = (id: number) => services.find(s => s.id === id)?.name || `Service ID ${id}`;

    // Basic formatter functions (replace with library or more robust logic if needed)
    const formatDateRange = (startStr: string, endStr: string): string => {
        try {
            const start = new Date(startStr);
            const end = new Date(endStr);
            // Example: "Wed, May 1, 10:00 AM - 12:00 PM (UTC)"
            const options: Intl.DateTimeFormatOptions = {
                timeZone: 'UTC', // Assuming API returns UTC
                weekday: 'short',
                month: 'short',
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
                hour12: true,
            };
            const endOptions: Intl.DateTimeFormatOptions = {
                timeZone: 'UTC',
                hour: 'numeric',
                minute: '2-digit',
                hour12: true,
            };
            return `${start.toLocaleString([], options)} - ${end.toLocaleString([], endOptions)}`;
        } catch (e) {
            console.error("Date formatting error:", e);
            return "Invalid Date Range";
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
        return clientBookings.some(booking => {
            // Ensure both strings are treated as UTC. Assume API might sometimes omit offset.
            const bookingStartTimeStr = booking.start_time.endsWith('+00:00') ? booking.start_time : booking.start_time + '+00:00';
            const slotStartTimeStr = slotStartTime.endsWith('+00:00') ? slotStartTime : slotStartTime + '+00:00';

            // Compare Date objects derived from standardized UTC strings
            if (new Date(bookingStartTimeStr).getTime() !== new Date(slotStartTimeStr).getTime()) {
                return false;
            }

            // Check if any pet in this booking is also in the selectedPetIds list
            const overlaps = booking.pets.some(bookedPet => {
                const isSelected = selectedPetIds.includes(bookedPet.id);
                return isSelected;
            });
            if (overlaps) {
                console.log(`Slot ${slotStartTime} is already booked by selected pet(s).`);
            }
            return overlaps;
        });
    };

    // Helper function to aggregate raw slots
    const aggregateSlots = (slots: CalculatedSlot[], serviceId: number): AggregatedSlot[] => {
        if (!slots || slots.length === 0) return [];

        const grouped: { [key: string]: { serviceId: number; serviceName: string; startTime: string; endTime: string; totalCapacity: number; price: number; uses_staff_capacity: boolean; zero_capacity_reason: string | null; } } = {};

        const currentServiceName = getServiceName(serviceId);

        slots.forEach(slot => {
            // Use the actual keys from the API response (now matching the type)
            const startTime = slot.start_time;
            const endTime = slot.end_time;
            const remainingCapacity = slot.remaining_capacity;
            const pricePerPet = slot.price_per_pet ?? 0;
            const usesStaffCapacity = slot.uses_staff_capacity ?? false;
            const zeroCapacityReason = slot.zero_capacity_reason ?? null;

            // Check if essential data is present
            if (!startTime || !endTime || typeof remainingCapacity !== 'number') {
                console.warn("Skipping slot due to missing/invalid data:", slot);
                return; // Skip this slot if essential data is missing
            }

            // Key based on service and time block
            const key = `${serviceId}-${startTime}-${endTime}`;

            if (!grouped[key]) {
                grouped[key] = {
                    serviceId: serviceId,
                    serviceName: currentServiceName,
                    startTime: startTime, // Use variable
                    endTime: endTime,     // Use variable
                    totalCapacity: 0,
                    price: pricePerPet, // Use variable, defaulting to 0 if missing
                    uses_staff_capacity: usesStaffCapacity, // Assume consistent within group
                    zero_capacity_reason: zeroCapacityReason, // Assume consistent for time slot
                };
            }
            // Add capacity. Ensure uses_staff_capacity is consistent if already grouped.
            grouped[key].totalCapacity += remainingCapacity;
            if (grouped[key].uses_staff_capacity !== usesStaffCapacity) {
                // This case shouldn't happen if API/DB logic is correct (all slots for one service/time rule use same capacity type)
                console.warn(`Inconsistent uses_staff_capacity flag within aggregated slot ${key}. Sticking with first value.`);
            }
        });

        // Convert grouped object back to an array
        return Object.values(grouped).map(group => ({
            serviceId: group.serviceId,
            serviceName: group.serviceName,
            startTime: group.startTime,
            endTime: group.endTime,
            totalRemainingCapacity: group.totalCapacity,
            price_per_pet: group.price, // Assign the stored price
            uses_staff_capacity: group.uses_staff_capacity,
            zero_capacity_reason: group.zero_capacity_reason,
        }));
    };

    const fetchClientBookings = async () => {
        setIsLoadingBookings(true);
        // Don't clear error here, let fetchCalculatedSlots handle slot errors
        try {
            const response = await fetch('/api/my-bookings');
            if (!response.ok) {
                console.error("Failed to fetch client bookings", response.status);
                // Don't throw, just set empty array and maybe log
                setClientBookings([]);
                return;
            }
            const data: ClientBookingDetails[] = await response.json();
            setClientBookings(data);
        } catch (e) {
            console.error("Error fetching client bookings:", e);
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

            // Process data to find unique dates with > 0 capacity
            const availableDates = new Set<string>();
            slotsData.forEach(slot => {
                if (slot.remaining_capacity > 0 && slot.start_time) {
                    try {
                        const datePart = slot.start_time.split('T')[0];
                        // Ensure the date is not in the past before adding
                        const slotDate = parseISO(datePart);
                        if (slotDate >= today) {
                           availableDates.add(datePart);
                        }
                    } catch (e) {
                        console.error("Error parsing slot start_time for availability check:", slot.start_time, e);
                    }
                }
            });

            // Map unique dates to dummy CalendarEvent objects
            const dummyEvents: CalendarEvent[] = Array.from(availableDates).map(dateStr => ({
                id: `available-${dateStr}`, // Unique ID for the marker
                title: 'Available',       // Simple text, could be hidden with CSS if needed
                start: parseISO(dateStr),  // Date object for the start
                end: parseISO(dateStr),    // Date object for the end
                allDay: true,             // Mark as all-day event
                resource: { type: 'availability-marker' } // Add resource type for potential styling/filtering
            }));

            setCalendarDisplayEvents(dummyEvents);
            console.log(`Created ${dummyEvents.length} availability markers for the calendar week.`);

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

        setSelectedPetIds(prevSelectedIds => {
            if (isChecked) {
                // Add ID if checked and not already present
                return prevSelectedIds.includes(petId) ? prevSelectedIds : [...prevSelectedIds, petId];
            } else {
                // Remove ID if unchecked
                return prevSelectedIds.filter(id => id !== petId);
            }
        });
    };

    // Handler for Slot Selection Toggle
    const handleSlotSelectionToggle = (slotKey: string) => {
        console.log('handleSlotSelectionToggle called with key:', slotKey); // Log entry
        setSelectedSlots(prevSelected => {
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
        const selectedService = services.find(s => s.id === parseInt(selectedServiceId, 10));
        const requiresFieldSelection = selectedService?.requires_field_selection ?? false;

        selectedSlots.forEach(slotKey => {
            let slotPrice = 0;
            if (requiresFieldSelection) {
                // Key is fieldId-startTime
                // NOTE: This part assumes field-specific booking is implemented differently
                // and might need adjustment based on how field IDs are stored/retrieved.
                // For now, let's assume the key directly relates to a raw slot if needed.
                const startTime = slotKey.includes('-') ? slotKey.split('-')[1] : slotKey; // Assume key might just be startTime now
                const slot = rawCalculatedSlots.find(s => {
                    // If key is just startTime and we pick *any* raw slot matching:
                    return s.start_time === startTime;
                });
                slotPrice = slot?.price_per_pet ?? 0;
            } else {
                // Key is startTime
                 const startTime = slotKey;
                 const slot = aggregatedSlots.find(s => s.startTime === startTime);
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

        console.log("Booking for date:", selectedBookingDate.toLocaleDateString());
        console.log("Booking selected slots (startTimes):", selectedSlots);
        console.log("Booking for pets:", selectedPetIds);

        setIsLoadingBookings(true); // Use the dedicated booking loading state

        let bookingSuccess = true;
        const bookingResults = [];

        // Iterate through each selected slot (identified by startTime string)
        for (const slotKey of selectedSlots) {
            const startTime = slotKey;
            // Find the corresponding aggregated slot details from state
            const slotDetails = aggregatedSlots.find(s => s.startTime === startTime);

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
                end_time: slotDetails.endTime,     // Use the found end time
                pet_ids: selectedPetIds,
                // Note: The API should handle field assignment based on service/time/capacity
                // date: selectedBookingDate.toISOString().split('T')[0] // Pass date if API needs it explicitly
            };

            console.log("Sending booking payload:", payload);

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
            const failedSlots = bookingResults.filter(r => !r.success);
            setError(`Failed to book ${failedSlots.length} slot(s). Errors: ${failedSlots.map(f => `Slot starting ${new Date(f.slot ?? '').toLocaleTimeString()}: ${f.error}`).join('; ')}`);
            // Consider only clearing *failed* slots from selection?
        }
    };

    // Fetch Calculated Slots FOR THE SELECTED DATE
    const fetchCalculatedSlotsForDate = useCallback(async (serviceId: string, date: Date) => {
        if (!serviceId || !date) {
            setRawCalculatedSlots([]);
            setAggregatedSlots([]);
            return;
        }

        setIsLoadingCalculatedSlots(true);
        setError(null);
        setRawCalculatedSlots([]);
        setAggregatedSlots([]);
        setSelectedSlots(new Set()); // Clear selections when date changes

        // Format the date correctly as YYYY-MM-DD based on its local representation
        const dateString = format(date, 'yyyy-MM-dd');
        console.log(`Fetching slots for date string: ${dateString}`); // Add log

        try {
            // Fetch slots only for the specific selected date
            const response = await fetch(`/api/available-slots?service_id=${serviceId}&start_date=${dateString}&end_date=${dateString}`);

            if (!response.ok) {
                let errorMsg = 'Failed to fetch available slots';
                try {
                    const errorData = await response.json();
                    errorMsg = errorData.error || errorMsg;
                } catch (jsonError: unknown) {
                    // Ignore if response is not JSON, log the unknown error
                    console.warn('Failed to parse error response as JSON:', jsonError);
                }
                throw new Error(errorMsg);
            }

            const data: CalculatedSlot[] = await response.json();
            console.log(`Raw calculated slots for ${dateString}:`, data);
            setRawCalculatedSlots(data);
            const serviceNum = parseInt(serviceId, 10);
            const aggregated = aggregateSlots(data, serviceNum);
            console.log(`Aggregated slots for ${dateString}:`, aggregated);
            setAggregatedSlots(aggregated);

        } catch (e) {
            const errorMessage = e instanceof Error ? e.message : 'An unknown error occurred';
            console.error("Slot fetching error:", errorMessage);
            setError(errorMessage);
        } finally {
            setIsLoadingCalculatedSlots(false);
        }
    }, [aggregateSlots]); // Include dependencies like aggregateSlots

    // === Calendar Interaction Handlers ===
    const handleCalendarDayClick = (slotInfo: { start: Date; end: Date }) => {
        // Create a NEW Date object to avoid mutating the one from the event
        const clickedDate = new Date(slotInfo.start);
        clickedDate.setHours(0, 0, 0, 0); // Modify the copy

        // Prevent selecting today or past dates
        if (clickedDate < today) { // Allow selecting today if needed, but original logic prevented it
            alert("Bookings must be made for a future date.");
            return;
        }

        console.log('Calendar day selected:', clickedDate);
        setSelectedBookingDate(clickedDate);

        if (selectedServiceId) {
            fetchCalculatedSlotsForDate(selectedServiceId, clickedDate);
        } else {
             setRawCalculatedSlots([]);
             setAggregatedSlots([]);
             setError("Please select a service first.");
        }
    };

    // NEW Handler for Calendar Navigation
    const handleCalendarNavigate = (newDate: Date) => {
        console.log("Calendar navigating to:", newDate);
        setCalendarViewDate(newDate); // Update the view date state
        // Fetching is handled by the useEffect watching calendarViewDate
    };

    // === Helper function for calendar day styling ===
    const dayPropGetter = useCallback((date: Date) => {
        // Check if this date has an availability marker
        // const dateStr = format(date, 'yyyy-MM-dd'); // Removed unused variable
        const hasAvailability = calendarDisplayEvents.some(event =>
            // Use type assertion to access resource properties
            (event.resource as { type?: string })?.type === 'availability-marker' &&
            isSameDay(event.start as Date, date)
        );

        if (hasAvailability) {
            return {
                style: {
                    backgroundColor: 'rgba(60, 179, 113, 0.2)', // Lighter green background
                    borderRadius: '2px',
                }
            };
        }
        return {};
    }, [calendarDisplayEvents]);

    return (
        <div className={styles.container}>
            <h2 className={styles.title}>Create New Booking</h2>

            {/* Service Selection */}
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
                        // Fetch availability for new service immediately
                        // fetchCalendarAvailability(e.target.value, calendarViewDate); // This is handled by useEffect
                    }}
                    required
                    className={styles.input}
                >
                    <option value="">-- Select a Service --</option>
                    {services.map(service => (
                        <option key={service.id} value={service.id}>
                            {service.name}
                        </option>
                    ))}
                </select>
            </div>

            {/* Pet Selection - Moved Up, Render only if service is selected */}
            {selectedServiceId && (
                <div className={styles.formGroup}>
                    <label>Select Pets:</label>
                    {isLoadingPets ? (
                        <p>Loading pets...</p>
                    ) : pets.length > 0 ? (
                        <ul className={styles.list}>
                            {pets.map(pet => (
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
            )}

            {/* Moved Up: Selected Date Display */}
            {selectedServiceId && selectedPetIds.length > 0 && selectedBookingDate && (
                 <div className={styles.formGroup}>
                    <p>Selected Date: <strong>{selectedBookingDate.toLocaleDateString()}</strong></p>
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
                            {aggregatedSlots.map(slot => {
                                const slotKey = `${slot.startTime}`;
                                const isSelected = selectedSlots.has(slotKey);
                                const petCount = selectedPetIds.length;
                                const insufficientCapacity = slot.totalRemainingCapacity < petCount;
                                const isBookedBySelection = isSlotBookedBySelectedPets(slot.startTime);
                                const isDisabled = insufficientCapacity || isBookedBySelection || slot.totalRemainingCapacity === 0;

                                console.log(`Mapping slot with key: ${slotKey}`, {isDisabled, isSelected, slot});

                                // Simplified return for debugging
                                return (
                                    <li
                                        key={slotKey}
                                        style={{
                                            padding: '10px',
                                            border: '1px solid #555',
                                            marginBottom: '5px',
                                            cursor: isDisabled ? 'not-allowed' : 'pointer',
                                            backgroundColor: isSelected ? '#003366' : (isDisabled ? '#333' : '#222'),
                                            opacity: isDisabled ? 0.6 : 1
                                        }}
                                        onClick={() => {
                                            if (!isDisabled) {
                                                handleSlotSelectionToggle(slotKey);
                                            }
                                        }}
                                    >
                                        {formatDateRange(slot.startTime, slot.endTime)} - Capacity: {slot.totalRemainingCapacity} {isSelected ? '(Selected)' : ''}
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
                        events={[]}
                        onSelectSlot={handleCalendarDayClick}
                        onSelectEvent={() => {}}
                        views={['week']}
                        defaultView='week'
                        onNavigate={handleCalendarNavigate}
                        date={calendarViewDate}
                        dayPropGetter={dayPropGetter}
                    />
                </div>
            )}

            {/* Booking Summary and Action - Ensure this is outside other conditionals */}
            {selectedSlots.size > 0 && selectedPetIds.length > 0 && (
                <div className={styles.formGroup}>
                   <h3>Booking Summary</h3>
                   <p>Selected Date: {selectedBookingDate?.toLocaleDateString()}</p>
                   <p>Selected Pets: {pets.filter(p => selectedPetIds.includes(p.id)).map(p => p.name).join(', ')}</p>
                   <p>Selected Slots:</p>
                   <ul className={styles.listCompact}>
                       {Array.from(selectedSlots).map(slotKey => {
                           const slot = aggregatedSlots.find(s => s.startTime === slotKey);
                           return (
                               <li key={slotKey}>
                                   {slot ? `${formatDateRange(slot.startTime, slot.endTime)} @ ${formatPrice(slot.price_per_pet)}/pet` : `Slot details not found`}
                               </li>
                           );
                       })}
                   </ul>

                   <p>Total Price: <strong>{formatPrice(calculateTotalPrice())}</strong></p>
                   {/* Ensure button and closing tags are correct */}
                   <button
                       onClick={handleBookSelectedSlots}
                       disabled={isLoadingCalculatedSlots || isLoadingBookings}
                       className={`${styles.button} ${styles.primary}`}
                   >
                       {isLoadingBookings ? 'Booking...' : 'Book Selected Slots'}
                   </button>
                </div> // Closing tag for styles.formGroup
            )}

        </div> // Closing tag for styles.container
    ); // Closing tag for return statement
} // Closing tag for function component