'use client';

import { useState } from 'react';
import styles from "@/app/page.module.css"; // Adjust path as needed

// Define required types directly or import from a shared types file later
type Service = {
  id: number;
  name: string;
  description: string | null;
  created_at: string;
}

type CalculatedSlot = {
    slot_field_id: number;
    slot_field_name: string;
    slot_start_time: string;
    slot_end_time: string;
    slot_remaining_capacity: number;
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
    // State for the calculated slots
    const [calculatedSlots, setCalculatedSlots] = useState<CalculatedSlot[]>([]);
    const [isLoadingCalculatedSlots, setIsLoadingCalculatedSlots] = useState(false);

    // --- Fetch Calculated Slots from API ---
    const fetchCalculatedSlots = async () => {
        if (!selectedServiceId || !selectedStartDate || !selectedEndDate) {
            setError('Please select a service and date range.');
            return;
        }
        setIsLoadingCalculatedSlots(true);
        setCalculatedSlots([]); // Clear previous results
        setError(null);

        try {
            const queryParams = new URLSearchParams({
                service_id: selectedServiceId,
                start_date: selectedStartDate,
                end_date: selectedEndDate,
            });
            // Assuming API route is correct from root
            const response = await fetch(`/api/available-slots?${queryParams.toString()}`);

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `Failed to fetch slots (HTTP ${response.status})`);
            }

            const data: CalculatedSlot[] = await response.json();
            setCalculatedSlots(data);

        } catch (e) {
            const errorMessage = e instanceof Error ? e.message : 'Failed to load available slots.';
            setError(errorMessage);
            setCalculatedSlots([]); // Ensure slots are cleared on error
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

            {/* Display Area - Shows calculated slots */}
            <div className={styles.slotResultsArea}>
                <h3>Available Slots</h3>
                {isLoadingCalculatedSlots ? (
                    <p>Loading slots...</p>
                ) : error ? (
                    <p style={{ color: 'red' }}>Error: {error}</p>
                ) : calculatedSlots.length === 0 ? (
                    <p>No available slots found for the selected criteria. Try different dates or services.</p>
                ) : (
                    <div className={styles.calculatedSlotsList}>
                        {calculatedSlots.map((slot, index) => (
                            <div key={`${slot.slot_field_id}-${slot.slot_start_time}-${index}`} className={styles.calculatedSlotCard} style={{ border: '1px solid #eee', padding: '0.8rem', marginBottom: '0.8rem', borderRadius: '4px' }}>
                                <p><strong>Field:</strong> {slot.slot_field_name || `ID: ${slot.slot_field_id}`}</p>
                                <p>
                                    <strong>Start:</strong> {new Date(slot.slot_start_time).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })} |
                                    <strong> End:</strong> {new Date(slot.slot_end_time).toLocaleString([], { timeStyle: 'short' })}
                                </p>
                                <p><strong>Remaining Capacity:</strong> {slot.slot_remaining_capacity}</p>
                                <button
                                    // onClick={() => handleBookSlot(slot)}
                                    style={{ marginTop: '0.5rem' }}
                                >
                                    Book Now
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </section>
    );
}