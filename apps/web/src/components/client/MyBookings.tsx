'use client';

import { useState, useEffect } from 'react';
import { Booking } from '@booking-and-accounts-monorepo/shared-types';
import { fetchMyBookings } from '@booking-and-accounts-monorepo/api-services';

export default function MyBookings() {
    const [bookings, setBookings] = useState<Booking[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const loadBookings = async () => {
            setIsLoading(true);
            setError(null);
            try {
                const data = await fetchMyBookings();
                setBookings(data);
            } catch (e) {
                setError(e instanceof Error ? e.message : 'Failed to load bookings');
            } finally {
                setIsLoading(false);
            }
        };
        loadBookings();
    }, []);

    const now = new Date().getTime();
    const upcomingBookings = bookings.filter(b => new Date(b.end_time).getTime() > now);
    const pastBookings = bookings.filter(b => new Date(b.end_time).getTime() <= now);

    const renderBookingCard = (booking: Booking) => (
        <div key={booking.id} style={{ border: '1px solid #444', background: '#333', padding: '1rem', marginBottom: '1rem', borderRadius: '6px' }}>
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
        </div>
    );

    return (
        <section className="dashboard-section" style={{ marginTop: '2rem' }}>
            {isLoading && <p>Loading your bookings...</p>}
            {error && <p className="error-message">Error loading bookings: {error}</p>}

            {!isLoading && !error && bookings.length === 0 && (
                <p>You have no past or upcoming bookings.</p>
            )}

            {!isLoading && !error && bookings.length > 0 && (
                <>
                    {upcomingBookings.length > 0 && (
                        <div style={{ marginBottom: '2rem' }}>
                            <h3>Upcoming Bookings</h3>
                            <div>
                                {upcomingBookings.map(booking => renderBookingCard(booking))}
                            </div>
                        </div>
                    )}

                    {pastBookings.length > 0 && (
                        <div>
                            <h3>Booking History</h3>
                            <div>
                                {pastBookings.map(booking => renderBookingCard(booking))}
                            </div>
                        </div>
                    )}

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