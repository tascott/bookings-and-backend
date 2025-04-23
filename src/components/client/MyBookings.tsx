'use client';

import { useState, useEffect, useCallback } from 'react';
import styles from "@/app/page.module.css"; // Or dedicated styles

// Type matching the API response structure from /api/my-bookings
type ClientBookingDetails = {
    booking_id: number;
    start_time: string;
    end_time: string;
    service_type: string | null;
    status: string;
    field_id: number;
    pets: { id: number; name: string }[];
}

export default function MyBookings() {
    const [bookings, setBookings] = useState<ClientBookingDetails[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Fetch client bookings
    const fetchMyBookings = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const response = await fetch('/api/my-bookings');
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `Failed to fetch bookings (HTTP ${response.status})`);
            }
            const data: ClientBookingDetails[] = await response.json();
            setBookings(data);
        } catch (e) {
            const errorMessage = e instanceof Error ? e.message : 'An unknown error occurred.';
            console.error("Fetch My Bookings Error:", e);
            setError(errorMessage);
            setBookings([]); // Clear bookings on error
        } finally {
            setIsLoading(false);
        }
    }, []);

    // Fetch on mount
    useEffect(() => {
        fetchMyBookings();
    }, [fetchMyBookings]);

    return (
        <section style={{ marginTop: '2rem', borderTop: '1px solid #eee', paddingTop: '2rem' }}>
            <h2>My Bookings</h2>

            {isLoading && <p>Loading your bookings...</p>}
            {error && <p style={{ color: 'red' }}>Error loading bookings: {error}</p>}

            {!isLoading && !error && bookings.length === 0 && (
                <p>You have no past or upcoming bookings.</p>
            )}

            {!isLoading && !error && bookings.length > 0 && (
                <div className={styles.bookingList}> {/* Reuse existing style or create new */}
                    {bookings.map(booking => (
                        <div key={booking.booking_id} className={styles.bookingCard} style={{ border: '1px solid #eee', padding: '1rem', marginBottom: '1rem', borderRadius: '4px' }}>
                            <p>
                                <strong>Service:</strong> {booking.service_type || 'N/A'} |
                                <strong>Status:</strong> {booking.status} |
                                <strong>Field ID:</strong> {booking.field_id} {/* Add field name lookup later if needed */}
                            </p>
                            <p>
                                <strong>From:</strong> {new Date(booking.start_time).toLocaleString()} |
                                <strong>To:</strong> {new Date(booking.end_time).toLocaleString()}
                            </p>
                            {booking.pets && booking.pets.length > 0 && (
                                <p>
                                    <strong>Pet(s):</strong> {booking.pets.map(p => p.name).join(', ')}
                                </p>
                            )}
                            {/* Add cancellation button/logic later? */}
                        </div>
                    ))}
                </div>
            )}
        </section>
    );
}