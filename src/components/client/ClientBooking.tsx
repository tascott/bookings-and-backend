'use client';

import { useState } from 'react';
import styles from "@/app/page.module.css"; // Adjust path as needed

// Define required types directly or import from a shared types file later
type Service = {
  id: number;
  name: string;
  description: string | null;
  created_at: string;
  requires_field_selection: boolean;
}

type CalculatedSlot = {
    slot_field_id: number;
    slot_field_name: string;
    slot_start_time: string;
    slot_end_time: string;
    slot_remaining_capacity: number;
}

// Define a new type for the aggregated data used for display
type AggregatedSlot = {
    serviceId: number; // Keep service ID for potential use
    serviceName: string; // Need service name for display
    startTime: string; // ISO string
    endTime: string;   // ISO string
    totalRemainingCapacity: number;
    // Keep track of contributing fields/slots if needed for booking later?
    // contributingSlots: CalculatedSlot[];
}

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

    // Define helper here to be accessible throughout the component
    const getServiceName = (id: number) => services.find(s => s.id === id)?.name || `Service ID ${id}`;

    // Helper function to aggregate raw slots
    const aggregateSlots = (slots: CalculatedSlot[], serviceId: number): AggregatedSlot[] => {
        if (!slots || slots.length === 0) return [];

        const grouped: { [key: string]: { serviceId: number; serviceName: string; startTime: string; endTime: string; totalCapacity: number } } = {};

        // Use the helper defined outside
        const currentServiceName = getServiceName(serviceId);

        slots.forEach(slot => {
            // Key based on service and time block
            const key = `${serviceId}-${slot.slot_start_time}-${slot.slot_end_time}`;

            if (!grouped[key]) {
                grouped[key] = {
                    serviceId: serviceId,
                    serviceName: currentServiceName, // Use looked-up name
                    startTime: slot.slot_start_time,
                    endTime: slot.slot_end_time,
                    totalCapacity: 0,
                };
            }
            grouped[key].totalCapacity += slot.slot_remaining_capacity;
        });

        // Convert grouped object back to an array
        return Object.values(grouped).map(group => ({
            serviceId: group.serviceId,
            serviceName: group.serviceName,
            startTime: group.startTime,
            endTime: group.endTime,
            totalRemainingCapacity: group.totalCapacity,
        }));
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
            setRawCalculatedSlots(data); // Always store raw data

            // Aggregate the data for display ONLY IF service doesn't require field selection
            if (!selectedService.requires_field_selection) {
                const aggregated = aggregateSlots(data, serviceIdNum);
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

    // TODO: Implement booking handler
    // const handleBookSlot = async (slot: CalculatedSlot) => { ... }

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
                            onChange={(e) => setSelectedServiceId(e.target.value)}
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
                <button
                    onClick={fetchCalculatedSlots}
                    disabled={!selectedServiceId || !selectedStartDate || !selectedEndDate || isLoadingCalculatedSlots}
                    style={{ marginTop: '1rem' }}
                >
                    {isLoadingCalculatedSlots ? 'Finding Slots...' : 'Find Slots'}
                </button>
            </div>

            {/* Display Area - Shows calculated slots conditionally */}
            <div className={styles.slotResultsArea}>
                <h3>Available Slots</h3>
                {isLoadingCalculatedSlots ? (
                    <p>Loading slots...</p>
                ) : error ? (
                    <p style={{ color: 'red' }}>Error: {error}</p>
                ) : /* Check which mode to display */ (
                    (() => {
                        const serviceIdNum = parseInt(selectedServiceId, 10);
                        const selectedService = services.find(s => s.id === serviceIdNum);
                        const showAggregated = selectedService && !selectedService.requires_field_selection;

                        // Determine which array to map over
                        const slotsToDisplay = showAggregated ? aggregatedSlots : rawCalculatedSlots;
                        const noSlotsFound = slotsToDisplay.length === 0 && !isLoadingCalculatedSlots; // Check after deciding which list to use

                        if (noSlotsFound && selectedServiceId) { // Only show 'no slots' if a search was actually performed
                             return <p>No available slots found for the selected criteria. Try different dates or services.</p>;
                        } else if (!selectedServiceId) {
                             return <p>Select a service and date range to find slots.</p>; // Initial state
                        }

                        return (
                            <div className={styles.calculatedSlotsList}>
                                {showAggregated
                                    ? /* Render Aggregated Slots */
                                      aggregatedSlots.map((aggSlot, index) => (
                                        <div key={`agg-${aggSlot.serviceId}-${aggSlot.startTime}-${index}`} className={styles.calculatedSlotCard} style={{ border: '1px solid #eee', padding: '0.8rem', marginBottom: '0.8rem', borderRadius: '4px' }}>
                                            <p><strong>Service:</strong> {aggSlot.serviceName}</p>
                                            <p>
                                                <strong>Start:</strong> {new Date(aggSlot.startTime).toLocaleString([], { timeZone: 'UTC', dateStyle: 'short', timeStyle: 'short' })} |
                                                <strong> End:</strong> {new Date(aggSlot.endTime).toLocaleString([], { timeZone: 'UTC', timeStyle: 'short' })}
                                            </p>
                                            <p><strong>Total Remaining Capacity:</strong> {aggSlot.totalRemainingCapacity}</p>
                                            <button
                                                // onClick={() => handleBookSlotAggregated(aggSlot)} // Need specific booking handler
                                                style={{ marginTop: '0.5rem' }}
                                            >
                                                Book Now
                                            </button>
                                        </div>
                                    ))
                                    : /* Render Per-Field Slots */
                                      rawCalculatedSlots.map((slot, index) => {
                                        // Find the service name for this slot's service ID (needed if mixing results)
                                        // Although in this logic branch, all slots *should* belong to the selectedServiceId
                                        const serviceName = getServiceName(parseInt(selectedServiceId, 10)) || `Service ID ${selectedServiceId}`;
                                        return (
                                            <div key={`field-${slot.slot_field_id}-${slot.slot_start_time}-${index}`} className={styles.calculatedSlotCard} style={{ border: '1px solid #eee', padding: '0.8rem', marginBottom: '0.8rem', borderRadius: '4px' }}>
                                                {/* Add Service Name */}
                                                <p><strong>Service:</strong> {serviceName}</p>
                                                {/* Display field name prominently */}
                                                <p><strong>Field:</strong> {slot.slot_field_name || `ID: ${slot.slot_field_id}`}</p>
                                                <p>
                                                    <strong>Start:</strong> {new Date(slot.slot_start_time).toLocaleString([], { timeZone: 'UTC', dateStyle: 'short', timeStyle: 'short' })} |
                                                    <strong> End:</strong> {new Date(slot.slot_end_time).toLocaleString([], { timeZone: 'UTC', timeStyle: 'short' })}
                                                </p>
                                                {/* Show individual field capacity */}
                                                <p><strong>Remaining Capacity:</strong> {slot.slot_remaining_capacity}</p>
                                                <button
                                                    // onClick={() => handleBookSlotField(slot)} // Need specific booking handler
                                                    style={{ marginTop: '0.5rem' }}
                                                >
                                                    Book This Field
                                                </button>
                                            </div>
                                        );
                                    })
                                }
                            </div>
                        );
                    })()
                )}
            </div>
        </section>
    );
}