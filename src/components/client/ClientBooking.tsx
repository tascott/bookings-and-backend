'use client';

import { useState, useCallback, useEffect, ChangeEvent } from 'react';
import styles from "@/app/page.module.css"; // Adjust path as needed

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

// Type for the payload sent to the booking API
/* // Removed unused type for now
interface BookingPayload {
    service_id: number;
    start_time: string;
    end_time: string;
    field_id?: number;
    pet_ids: number[]; // Added selected pet IDs
}
*/

// Define props for the component
interface ClientBookingProps {
    services: Service[];
    // Add other shared props if needed, e.g., error state handlers
}

export default function ClientBooking({ services }: ClientBookingProps) {
    const [error, setError] = useState<string | null>(null); // Local error state for this component

    // State for slot search inputs
    const today = new Date().toISOString().split('T')[0];
    const nextWeekDate = new Date();
    nextWeekDate.setDate(nextWeekDate.getDate() + 7);
    const nextWeek = nextWeekDate.toISOString().split('T')[0];

    const [selectedServiceId, setSelectedServiceId] = useState<string>('');
    const [selectedStartDate, setSelectedStartDate] = useState<string>(today);
    const [selectedEndDate, setSelectedEndDate] = useState<string>(nextWeek);
    // State for the raw calculated slots from API
    const [rawCalculatedSlots, setRawCalculatedSlots] = useState<CalculatedSlot[]>([]);
    // State for the aggregated slots for display
    const [aggregatedSlots, setAggregatedSlots] = useState<AggregatedSlot[]>([]);
    const [isLoadingCalculatedSlots, setIsLoadingCalculatedSlots] = useState(false);

    // State for pets
    const [pets, setPets] = useState<Pet[]>([]);
    const [isLoadingPets, setIsLoadingPets] = useState(true);
    const [selectedPetIds, setSelectedPetIds] = useState<number[]>([]);

    // State for slots and selections
    const [selectedSlots, setSelectedSlots] = useState<Set<string>>(new Set()); // Use Set for easy add/remove, key = `${startTime}` or `${fieldId}-${startTime}`

    // Define helper here to be accessible throughout the component
    const getServiceName = (id: number) => services.find(s => s.id === id)?.name || `Service ID ${id}`;

    // --- MODIFICATION START ---
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
    // --- MODIFICATION END ---

    // Helper function to aggregate raw slots
    const aggregateSlots = (slots: CalculatedSlot[], serviceId: number): AggregatedSlot[] => {
        if (!slots || slots.length === 0) return [];

        const grouped: { [key: string]: { serviceId: number; serviceName: string; startTime: string; endTime: string; totalCapacity: number; price: number } } = {};

        const currentServiceName = getServiceName(serviceId);

        slots.forEach(slot => {
            // Use the actual keys from the API response (now matching the type)
            const startTime = slot.start_time;
            const endTime = slot.end_time;
            const remainingCapacity = slot.remaining_capacity;
            // Use the optional price_per_pet from the type, default to 0.
            const pricePerPet = slot.price_per_pet ?? 0;

            // --- MODIFICATION: Log individual slot price ---
            console.log(`Raw slot time: ${startTime}, Price from API: ${slot.price_per_pet}, Used price: ${pricePerPet}`);

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
                    price: pricePerPet // Use variable, defaulting to 0 if missing
                };
            }
            grouped[key].totalCapacity += remainingCapacity;
        });

        // Convert grouped object back to an array
        return Object.values(grouped).map(group => ({
            serviceId: group.serviceId,
            serviceName: group.serviceName,
            startTime: group.startTime,
            endTime: group.endTime,
            totalRemainingCapacity: group.totalCapacity,
            price_per_pet: group.price // Assign the stored price
        }));
    };

    // --- Fetch Pets ---
    const fetchPets = useCallback(async () => {
        // Don't reset error here, let fetchCalculatedSlots handle its errors
        setIsLoadingPets(true);
        try {
            const response = await fetch('/api/pets');
            if (!response.ok) {
                // Don't throw here, just log and set empty pets
                console.error(`Failed to fetch pets (HTTP ${response.status})`);
                setPets([]);
                setSelectedPetIds([]);
                return;
            }
            const data: Pet[] = await response.json();
            setPets(data);
            // Default select all confirmed pets
            const confirmedPetIds = data
                .filter(pet => pet.is_confirmed)
                .map(pet => pet.id);
            setSelectedPetIds(confirmedPetIds);
        } catch (e) {
            console.error("Fetch Pets Error:", e);
            setPets([]);
            setSelectedPetIds([]);
            // Set error state? Or rely on booking error display?
        } finally {
            setIsLoadingPets(false);
        }
    }, []);

    useEffect(() => {
        fetchPets();
    }, [fetchPets]);

    // --- Pet Selection Handler ---
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

    // --- Slot Selection Handler ---
    const handleSlotSelectionToggle = (slotKey: string) => {
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

    // --- Calculate Total Price ---
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

    const totalPrice = calculateTotalPrice();

    // --- Book Selected Slots Handler ---
    const handleBookSelectedSlots = async () => {
        setError(null); // Clear previous errors

        if (selectedSlots.size === 0) {
            setError('Please select at least one slot.');
            return;
        }
        if (selectedPetIds.length === 0) {
            setError('Please select at least one pet.');
            return;
        }
        if (!selectedServiceId) {
            setError('Internal error: Service ID not found.');
            return;
        }

        console.log("Booking selected slots:", selectedSlots);
        console.log("Booking for pets:", selectedPetIds);

        setIsLoadingCalculatedSlots(true); // Reuse loading state or add a new one?

        let bookingSuccess = true;
        const bookingResults = [];

        for (const slotKey of selectedSlots) {
            // The slotKey is the start_time string from AggregatedSlot
            const startTime = slotKey;
            // Find the corresponding aggregated slot to get end_time and service_id
            const slotDetails = aggregatedSlots.find(s => s.startTime === startTime);

            if (!slotDetails) {
                console.error(`Could not find details for selected slot key: ${slotKey}`);
                bookingResults.push({ slot: slotKey, success: false, error: 'Slot details not found.' });
                bookingSuccess = false;
                continue; // Skip to next slot
            }

            const payload = {
                service_id: parseInt(selectedServiceId, 10), // Ensure service ID is an integer
                start_time: slotDetails.startTime,
                end_time: slotDetails.endTime,
                pet_ids: selectedPetIds,
                // Field ID might not be needed if API handles allocation based on service/time/capacity
            };

            try {
                const response = await fetch('/api/client-booking', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                });

                if (!response.ok) {
                    const errorData = await response.json();
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

        setIsLoadingCalculatedSlots(false);

        if (bookingSuccess) {
            alert('All selected slots booked successfully!'); // Simple feedback for now
            setSelectedSlots(new Set()); // Clear selection on success
            setRawCalculatedSlots([]); // Clear results
            setAggregatedSlots([]); // Clear aggregated results
            // Optionally refetch slots or redirect
        } else {
            // Provide more detailed error feedback
            const failedSlots = bookingResults.filter(r => !r.success);
            setError(`Failed to book ${failedSlots.length} slot(s). Please try again or contact support. Errors: ${failedSlots.map(f => `Slot ${f.slot?.substring(11, 16)}: ${f.error}`).join(', ')}`);
        }
    };

    // --- Fetch Calculated Slots from API ---
    const fetchCalculatedSlots = async () => {
        const serviceIdNum = parseInt(selectedServiceId, 10);
        if (!selectedServiceId || !selectedStartDate || !selectedEndDate || isNaN(serviceIdNum)) {
            setError('Please select a valid service and date range.');
            return;
        }
        setIsLoadingCalculatedSlots(true);
        setRawCalculatedSlots([]); // Clear previous raw results
        setAggregatedSlots([]); // Clear previous aggregated results
        setError(null);

        // Find the selected service details to check the flag
        const selectedService = services.find(s => s.id === serviceIdNum);
        if (!selectedService) {
            setError('Selected service details not found.');
            setIsLoadingCalculatedSlots(false);
            return;
        }

        try {
            const queryParams = new URLSearchParams({
                service_id: selectedServiceId,
                start_date: selectedStartDate,
                end_date: selectedEndDate,
            });
            const response = await fetch(`/api/available-slots?${queryParams.toString()}`);

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `Failed to fetch slots (HTTP ${response.status})`);
            }

            const data: CalculatedSlot[] = await response.json();
            console.log("Raw data from /api/available-slots:", data); // Log raw data
            setRawCalculatedSlots(data); // Always store raw data

            // Aggregate the data for display ONLY IF service doesn't require field selection
            if (!selectedService.requires_field_selection) {
                const aggregated = aggregateSlots(data, serviceIdNum);
                console.log("Aggregated data:", aggregated); // Log aggregated data
                setAggregatedSlots(aggregated);
            } else {
                setAggregatedSlots([]); // Ensure aggregated is empty if showing raw
            }

        } catch (e) {
            const errorMessage = e instanceof Error ? e.message : 'Failed to load available slots.';
            setError(errorMessage);
            setRawCalculatedSlots([]); // Clear raw slots on error
            setAggregatedSlots([]); // Clear aggregated slots too
        } finally {
            setIsLoadingCalculatedSlots(false);
        }
    };
    // -------------------------------------

    return (
        <section style={{ marginTop: '2rem', borderTop: '1px solid #eee', paddingTop: '2rem' }}>
            <h2>Available Services & Times</h2>

            {/* Slot Search Form */}
            <div style={{ marginBottom: '1.5rem', padding: '1rem', border: '1px solid #ddd', borderRadius: '4px' }}>
                <h3>Find Available Slots</h3>
                {services.length === 0 ? (
                    <p>Loading services...</p>
                ) : (
                    <div>
                        <label htmlFor="clientServiceSelect">Service:</label>
                        <select
                            id="clientServiceSelect"
                            value={selectedServiceId}
                            onChange={(e) => { setSelectedServiceId(e.target.value); setRawCalculatedSlots([]); setAggregatedSlots([]); setSelectedSlots(new Set()); }}
                            required
                            style={{ marginRight: '1rem' }}
                        >
                            <option value="">-- Select a Service --</option>
                            {services.map(service => (
                                <option key={service.id} value={service.id}>{service.name}</option>
                            ))}
                        </select>
                    </div>
                )}
                <div style={{ marginTop: '0.5rem' }}>
                    <label htmlFor="clientStartDate">From:</label>
                    <input
                        type="date"
                        id="clientStartDate"
                        value={selectedStartDate}
                        onChange={(e) => setSelectedStartDate(e.target.value)}
                        min={today}
                        required
                        style={{ marginRight: '1rem' }}
                    />
                    <label htmlFor="clientEndDate">To:</label>
                    <input
                        type="date"
                        id="clientEndDate"
                        value={selectedEndDate}
                        onChange={(e) => setSelectedEndDate(e.target.value)}
                        min={selectedStartDate}
                        required
                        style={{ marginRight: '1rem' }}
                    />
                </div>

                {/* --- Pet Selection Section --- */}
                <div style={{ marginTop: '1rem', borderTop: '1px dashed #ccc', paddingTop: '1rem' }}>
                    <h4>Select Pet(s) for Booking</h4>
                    {isLoadingPets ? (
                        <p>Loading your pets...</p>
                    ) : pets.length === 0 ? (
                        <p>You have no pets registered. Please add pets in the "My Pets" section.</p>
                    ) : (
                        <div>
                            {pets.map(pet => (
                                <div key={pet.id} style={{ marginBottom: '0.25rem' }}>
                                    <input
                                        type="checkbox"
                                        id={`pet-${pet.id}`}
                                        value={pet.id}
                                        checked={selectedPetIds.includes(pet.id)}
                                        onChange={handlePetSelectionChange}
                                        style={{ marginRight: '0.5rem' }}
                                        disabled={!pet.is_confirmed}
                                    />
                                    <label
                                        htmlFor={`pet-${pet.id}`}
                                        style={{
                                            color: pet.is_confirmed ? 'white' : '#999',
                                            fontStyle: pet.is_confirmed ? 'normal' : 'italic'
                                        }}
                                    >
                                        {pet.name} {pet.breed ? `(${pet.breed})` : ''}
                                        {!pet.is_confirmed && ' - Awaiting confirmation'}
                                    </label>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
                {/* -------------------------- */}

                <button
                    onClick={fetchCalculatedSlots}
                    disabled={isLoadingCalculatedSlots || !selectedServiceId || !selectedStartDate || !selectedEndDate}
                    style={{ marginTop: '1rem' }}
                >
                    {isLoadingCalculatedSlots ? 'Searching...' : 'Find Slots'}
                </button>
            </div>

            {/* Display Error Messages */}
            {error && <p style={{ color: 'red', marginTop: '1rem' }}>Error: {error}</p>}

            {/* Results Section */}
            <div style={{ marginTop: '1.5rem' }}>
                {isLoadingCalculatedSlots ? (
                    <p>Loading available slots...</p>
                ) : (
                    <>
                        <h3>Available Slots</h3>
                        {(() => {
                            // Find the selected service details again for the flag
                            const selectedService = services.find(s => s.id === parseInt(selectedServiceId || '0', 10));

                            // Case 1: Service requires field selection - Render Raw Slots
                            if (selectedService?.requires_field_selection) {
                                if (rawCalculatedSlots.length === 0) {
                                    return <p>No specific field slots found for the selected criteria. Try different dates or services.</p>;
                                }
                                // Render raw slots grouped by field? Or just list? Let's list for now.
                                // TODO: Improve rendering for field-specific slots if needed
                                return (
                                    <div>
                                        {rawCalculatedSlots.map((slot, index) => (
                                            <div key={`${slot.start_time}-${index}`} style={{ border: '1px solid #444', padding: '10px', marginBottom: '10px', borderRadius: '4px' }}>
                                                {/* Display relevant info from raw slot */}
                                                {/* --- MODIFICATION: Removed slot_field_name as it's not in type --- */}
                                                {/* <p><strong>Field:</strong> {slot.slot_field_name || 'N/A'}</p> */}
                                                <p><strong>Time:</strong> {formatDateRange(slot.start_time, slot.end_time)}</p>
                                                <p><strong>Capacity:</strong> {slot.remaining_capacity}</p>
                                                <p><strong>Price:</strong> {formatPrice(slot.price_per_pet ?? selectedService.default_price ?? 0)}</p>
                                                {/* Add selection mechanism if needed */}
                                            </div>
                                        ))}
                                    </div>
                                );
                            }
                            // Case 2: Service does NOT require field selection - Render Aggregated Slots
                            else {
                                if (aggregatedSlots.length === 0) {
                                    return <p>No available slots found for the selected criteria. Try different dates or services.</p>;
                                }
                                return (
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem' }}>
                                        {aggregatedSlots.map((slot) => {
                                            const slotKey = slot.startTime; // Key for selection when not field-specific
                                            const isSelected = selectedSlots.has(slotKey);
                                            return (
                                                <div
                                                    key={slotKey}
                                                    style={{
                                                        border: `2px solid ${isSelected ? '#00aaff' : '#555'}`,
                                                        padding: '1rem',
                                                        borderRadius: '4px',
                                                        cursor: slot.totalRemainingCapacity > 0 ? 'pointer' : 'not-allowed',
                                                        opacity: slot.totalRemainingCapacity > 0 ? 1 : 0.6,
                                                        background: isSelected ? '#003366' : '#333'
                                                    }}
                                                    onClick={() => slot.totalRemainingCapacity > 0 && handleSlotSelectionToggle(slotKey)}
                                                >
                                                    {/* <p><strong>Service:</strong> {slot.serviceName}</p> */}
                                                    <p><strong>Time:</strong> {formatDateRange(slot.startTime, slot.endTime)}</p>
                                                    <p><strong>Total Remaining Capacity:</strong> {slot.totalRemainingCapacity}</p>
                                                    <p><strong>Price per Pet:</strong> {formatPrice(slot.price_per_pet)}</p>
                                                    {isSelected && <p style={{ color: '#00aaff', fontWeight: 'bold' }}>Selected</p>}
                                                </div>
                                            );
                                        })}
                                    </div>
                                );
                            }
                        })()}
                    </>
                )}
            </div>

            {/* Total Price and Booking Button */}
            {(rawCalculatedSlots.length > 0 || aggregatedSlots.length > 0) && (
                <div className={styles.bookingSummary}>
                     <p><strong>Selected Pets:</strong> {selectedPetIds.length}</p>
                     <p><strong>Selected Slots:</strong> {selectedSlots.size}</p>
                     <p><strong>Total Price:</strong> £{(totalPrice ?? 0).toFixed(2)}</p>
                     <button
                        onClick={handleBookSelectedSlots}
                        disabled={selectedSlots.size === 0 || selectedPetIds.length === 0}
                        className={styles.mainBookButton}
                    >
                        Book Selected Slots
                    </button>
                </div>
            )}
        </section>
    );
}