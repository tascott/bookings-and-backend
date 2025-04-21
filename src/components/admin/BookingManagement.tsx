'use client';

import styles from "@/app/page.module.css"; // Adjust path as needed

// Define types (or import from shared location)
type Booking = {
  id: number;
  field_id: number;
  start_time: string;
  end_time: string;
  service_type: string | null;
  status: string;
  max_capacity: number | null;
}

type Site = {
  id: number;
  name: string;
  // Add other fields if needed by helpers passed down
}

type Field = {
  id: number;
  site_id: number;
  name: string | null;
  // Add other fields if needed
}

// Define props for the component
interface BookingManagementProps {
    role: string | null; // Role of the current user (admin or staff)
    bookings: Booking[];
    isLoadingBookings: boolean;
    sites: Site[]; // Needed for form dropdown grouping
    fields: Field[]; // Needed for form dropdown options
    error: string | null;
    handleAddBooking: (event: React.FormEvent<HTMLFormElement>) => Promise<void>;
    addBookingFormRef: React.RefObject<HTMLFormElement | null>;
    getFieldsForSite: (siteId: number) => Field[]; // Helper for dropdown
}

export default function BookingManagement({
    role,
    bookings,
    isLoadingBookings,
    sites,
    fields,
    error,
    handleAddBooking,
    addBookingFormRef,
    getFieldsForSite
}: BookingManagementProps) {

    // No local state needed currently

    return (
        <section style={{ marginTop: '2rem', borderTop: '1px solid #eee', paddingTop: '2rem' }}>
            <h2>Booking Management ({role})</h2>
            {/* Display error passed via props - consider filtering if error is specific */}
            {/* {error && error.includes('booking') && <p style={{ color: 'red' }}>Error: {error}</p>} */}

            {/* Add New Booking Form */}
            <form ref={addBookingFormRef} onSubmit={handleAddBooking} style={{ marginBottom: '1.5rem', padding: '1rem', border: '1px solid #ddd', borderRadius: '4px' }}>
                <h3>Add New Booking</h3>
                {fields.length === 0 ? (
                    <p>No fields available. Please add fields via Site Management first.</p>
                ) : (
                    <>
                        <div>
                            <label htmlFor="bookingFieldId">Field:</label>
                            <select id="bookingFieldId" name="bookingFieldId" required>
                                <option value="">-- Select a Field --</option>
                                {/* Group fields by site for better UX */}
                                {sites.map(site => (
                                    <optgroup key={site.id} label={site.name}>
                                        {getFieldsForSite(site.id).map(field => (
                                            <option key={field.id} value={field.id}>
                                                {field.name || `Field ID ${field.id}`}
                                            </option>
                                        ))}
                                    </optgroup>
                                ))}
                            </select>
                        </div>
                        <div style={{ marginTop: '0.5rem' }}>
                            <label htmlFor="bookingStartTime">Start Time:</label>
                            <input type="datetime-local" id="bookingStartTime" name="bookingStartTime" required />
                        </div>
                        <div style={{ marginTop: '0.5rem' }}>
                            <label htmlFor="bookingEndTime">End Time:</label>
                            <input type="datetime-local" id="bookingEndTime" name="bookingEndTime" required />
                        </div>
                        <div style={{ marginTop: '0.5rem' }}>
                            <label htmlFor="bookingServiceType">Service Type:</label>
                            <input type="text" id="bookingServiceType" name="bookingServiceType" placeholder="e.g., dog daycare, private rental" />
                        </div>
                        <div style={{ marginTop: '0.5rem' }}>
                            <label htmlFor="bookingMaxCapacity">Max Capacity (Optional):</label>
                            <input type="number" id="bookingMaxCapacity" name="bookingMaxCapacity" min="0" />
                        </div>
                        <button type="submit" style={{ marginTop: '1rem' }}>Add Booking</button>
                    </>
                )}
            </form>

            {/* Display Existing Bookings */}
            <h3>Existing Bookings</h3>
            {isLoadingBookings ? (
                <p>Loading bookings...</p>
            ) : error && bookings.length === 0 ? ( // Show fetch error if loading failed
                <p style={{ color: 'red' }}>Error loading bookings: {error}</p>
            ) : bookings.length === 0 ? (
                <p>No bookings found.</p>
            ) : (
                <div className={styles.bookingList}> {/* Use a class for styling */}
                    {bookings.map(booking => (
                        <div key={booking.id} className={styles.bookingCard} style={{ border: '1px solid #eee', padding: '0.8rem', marginBottom: '0.8rem', borderRadius: '4px' }}>
                            <p>
                                <strong>Field ID:</strong> {booking.field_id} |
                                <strong>Service:</strong> {booking.service_type || 'N/A'} |
                                <strong>Status:</strong> {booking.status}
                            </p>
                            <p>
                                <strong>From:</strong> {new Date(booking.start_time).toLocaleString()} |
                                <strong>To:</strong> {new Date(booking.end_time).toLocaleString()}
                            </p>
                            {booking.max_capacity !== null && (
                                <p><strong>Max Capacity:</strong> {booking.max_capacity}</p>
                            )}
                            {/* Add buttons for Edit/Cancel later? */}
                        </div>
                    ))}
                </div>
            )}
             {/* Display global error if needed and not displayed above */}
             {error && bookings.length > 0 && <p style={{ color: 'red', marginTop: '1rem' }}>Error: {error}</p>}
        </section>
    );
}