'use client';

import { useState, useEffect, useCallback } from 'react';

// Type matching the API response structure from /api/my-bookings
type ClientBookingDetails = {
    booking_id: number;
    start_time: string;
    end_time: string;
    service_type: string | null;
    status: string;
    booking_field_ids?: number[];
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

    const now = new Date().getTime();
    const upcomingBookings = bookings.filter(b => new Date(b.end_time).getTime() > now);
    const pastBookings = bookings.filter(b => new Date(b.end_time).getTime() <= now);

    // Helper function to render a single booking card (to avoid repetition)
    const renderBookingCard = (booking: ClientBookingDetails) => (
        <div key={booking.booking_id} /* className={styles.bookingCard} - Use dashboard styles */ style={{ border: '1px solid #444', background: '#333', padding: '1rem', marginBottom: '1rem', borderRadius: '6px' }}>
             {/* Use specific classes for better targeting if needed */}
            <p>
                <strong>Service:</strong> {booking.service_type || 'N/A'} |
                <strong>Status:</strong> {booking.status} |
                <strong>Field(s):</strong> {booking.booking_field_ids && booking.booking_field_ids.length > 0 ? booking.booking_field_ids.join(', ') : 'N/A'}
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
            {/* Add cancellation button/logic later for upcoming? */}
        </div>
    );

    return (
        <section className="dashboard-section" style={{ marginTop: '2rem' }}>
            <h2>My Bookings</h2>

            {isLoading && <p>Loading your bookings...</p>}
            {error && <p className="error-message">Error loading bookings: {error}</p>}

            {!isLoading && !error && bookings.length === 0 && (
                <p>You have no past or upcoming bookings.</p>
            )}

            {!isLoading && !error && bookings.length > 0 && (
                <>
                    {/* Upcoming Bookings Section */}
                    {upcomingBookings.length > 0 && (
                        <div style={{ marginBottom: '2rem' }}>
                            <h3>Upcoming Bookings</h3>
                            <div /* className={styles.bookingList} */>
                                {upcomingBookings.map(renderBookingCard)}
                            </div>
                        </div>
                    )}

                    {/* Past Bookings Section */}
                    {pastBookings.length > 0 && (
                        <div>
                            <h3>Booking History</h3>
                            <div /* className={styles.bookingList} */>
                                {pastBookings.map(renderBookingCard)}
                            </div>
                        </div>
                    )}

                     {/* Message if only past/upcoming exist but total bookings > 0 */}
                     {upcomingBookings.length === 0 && pastBookings.length > 0 && (
                         <p>You have no upcoming bookings.</p>
                     )}
                     {pastBookings.length === 0 && upcomingBookings.length > 0 && (
                         <p>You have no past booking history.</p>
                     )}
                </>
            )}
        </section>
    );
}