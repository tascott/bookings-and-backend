'use client';

import { useState, useCallback, FormEvent } from 'react';
import styles from "@/app/page.module.css"; // Adjust path as needed
import TabNavigation from '@/components/TabNavigation'; // Import TabNavigation

// Define types (or import from shared location)
type Booking = {
  id: number;
  field_id: number;
  start_time: string;
  end_time: string;
  service_type: string | null;
  status: string;
  max_capacity: number | null;
  is_paid: boolean;
  // Add fields returned by the updated API
  client_id?: number | null;
  client_name?: string | null;
  pet_names?: string[]; // Added pet names from API
  created_at?: string; // Assuming API returns this now
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
    refetchBookings: () => Promise<void>;
    handleToggleBookingPaidStatus: (bookingId: number, currentStatus: boolean) => Promise<void>;
}

// Helper function to format ISO string for datetime-local input
// YYYY-MM-DDTHH:mm
const formatDateTimeLocal = (isoString: string | null | undefined): string => {
    if (!isoString) return '';
    try {
        const date = new Date(isoString);
        // Adjust for timezone offset to display correctly in local time input
        const timezoneOffset = date.getTimezoneOffset() * 60000; // offset in milliseconds
        const localDate = new Date(date.getTime() - timezoneOffset);
        return localDate.toISOString().slice(0, 16);
    } catch (e) {
        console.error("Error formatting date:", e);
        return '';
    }
};

export default function BookingManagement({
    role,
    bookings,
    isLoadingBookings,
    sites,
    fields,
    error: parentError,
    handleAddBooking,
    addBookingFormRef,
    getFieldsForSite,
    refetchBookings,
    handleToggleBookingPaidStatus
}: BookingManagementProps) {

    // State for local operations (edit/delete errors)
    const [localError, setLocalError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false); // General submitting state

    // State for editing a booking
    const [editingBooking, setEditingBooking] = useState<Booking | null>(null);
    const [editFormFieldId, setEditFormFieldId] = useState<string>('');
    const [editFormStartTime, setEditFormStartTime] = useState<string>('');
    const [editFormEndTime, setEditFormEndTime] = useState<string>('');
    const [editFormServiceType, setEditFormServiceType] = useState<string>('');
    const [editFormStatus, setEditFormStatus] = useState<string>('');
    const [editFormMaxCapacity, setEditFormMaxCapacity] = useState<string>('');

    // --- Edit Booking Handlers ---
    const handleEditBookingClick = useCallback((booking: Booking) => {
        setEditingBooking(booking);
        setEditFormFieldId(String(booking.field_id));
        setEditFormStartTime(formatDateTimeLocal(booking.start_time));
        setEditFormEndTime(formatDateTimeLocal(booking.end_time));
        setEditFormServiceType(booking.service_type || '');
        setEditFormStatus(booking.status || '');
        setEditFormMaxCapacity(booking.max_capacity !== null ? String(booking.max_capacity) : '');
        setLocalError(null);
    }, []);

    const handleCancelEditBooking = useCallback(() => {
        setEditingBooking(null);
    }, []);

    const handleUpdateBookingSubmit = useCallback(async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!editingBooking) return;

        setIsSubmitting(true);
        setLocalError(null);

        // Construct payload with only the fields being updated (match PUT API)
        const payload = {
            field_id: editFormFieldId,
            start_time: editFormStartTime ? new Date(editFormStartTime).toISOString() : undefined,
            end_time: editFormEndTime ? new Date(editFormEndTime).toISOString() : undefined,
            service_type: editFormServiceType || undefined,
            status: editFormStatus || undefined,
            max_capacity: editFormMaxCapacity === '' ? null : parseInt(editFormMaxCapacity, 10),
        };

        // Basic validation
        if (!payload.field_id || !payload.start_time || !payload.end_time) {
            setLocalError('Field, Start Time, and End Time are required during update.');
            setIsSubmitting(false);
            return;
        }
         if (new Date(payload.end_time) <= new Date(payload.start_time)) {
            setLocalError('End time must be after start time.');
             setIsSubmitting(false);
            return;
        }
         if (payload.max_capacity !== null && (isNaN(payload.max_capacity))) {
             setLocalError('Invalid Max Capacity value.');
             setIsSubmitting(false);
            return;
        }

        try {
            const response = await fetch(`/api/bookings/${editingBooking.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `Failed to update booking (HTTP ${response.status})`);
            }

            // Success - clear editing state and refetch list via prop function
            setEditingBooking(null);
            await refetchBookings();

        } catch (e) {
            const errorMessage = e instanceof Error ? e.message : 'An unknown error occurred.';
            console.error("Update Booking Error:", e);
            setLocalError(errorMessage);
        } finally {
            setIsSubmitting(false);
        }
    }, [editingBooking, editFormFieldId, editFormStartTime, editFormEndTime, editFormServiceType, editFormStatus, editFormMaxCapacity, refetchBookings]);

     // --- Delete Booking Handler ---
    const handleDeleteBooking = useCallback(async (bookingId: number) => {
        if (!window.confirm("Are you sure you want to delete this booking? This action cannot be undone.")) {
            return;
        }

        setIsSubmitting(true); // Use general submitting state or a specific deleting state?
        setLocalError(null);

        try {
            const response = await fetch(`/api/bookings/${bookingId}`, {
                method: 'DELETE',
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `Failed to delete booking (HTTP ${response.status})`);
            }

            // Success - refetch list via prop function
            await refetchBookings();

        } catch (e) {
            const errorMessage = e instanceof Error ? e.message : 'An unknown error occurred.';
            console.error("Delete Booking Error:", e);
            setLocalError(errorMessage); // Show error locally
        } finally {
            setIsSubmitting(false);
        }
    }, [refetchBookings]);

    // Define view content separately
    const viewBookingsContent = (
        <>
            <h3>Existing Bookings</h3>
             {localError && <p style={{ color: 'red' }}>Operation Error: {localError}</p>}
            {isLoadingBookings ? (
                <p>Loading bookings...</p>
            ) : parentError && !localError && bookings.length === 0 ? (
                <p style={{ color: 'red' }}>Error loading bookings: {parentError}</p>
            ) : bookings.length === 0 ? (
                <p>No bookings found.</p>
            ) : (
                <div className={styles.userList}>
                    <div className={`${styles.userCardHeader} ${role !== 'admin' ? styles.userCardHeaderStaff : ''}`}>
                        <div>Client</div>
                        <div>Pet(s)</div>
                        <div>Service</div>
                        <div>Field</div>
                        <div>Time</div>
                        {role === 'admin' && <> {/* Admin only columns */}
                            <div>Status</div>
                            <div>Paid</div>
                            <div className={styles.userAction}>Actions</div>
                        </>}
                    </div>
                    {bookings.map((booking) => (
                        <div key={booking.id} className={`${styles.userCard} ${role !== 'admin' ? styles.userCardStaff : ''}`}>
                            <div>{booking.client_name || (booking.client_id ? `Client ID ${booking.client_id}` : 'N/A')}</div>
                            <div>{booking.pet_names?.join(', ') || 'N/A'}</div>
                            <div>{booking.service_type || 'N/A'}</div>
                            <div>{fields.find(f => f.id === booking.field_id)?.name || `Field ID ${booking.field_id}`}</div>
                            <div>
                                {formatDateTimeLocal(booking.start_time).replace('T', ' ')} -
                                {formatDateTimeLocal(booking.end_time).replace('T', ' ')}
                            </div>
                             {role === 'admin' && <> {/* Admin only columns */}
                                <div>{booking.status}</div>
                                <div>
                                    <button
                                        onClick={() => handleToggleBookingPaidStatus(booking.id, booking.is_paid)}
                                        className={`button small ${booking.is_paid ? 'success' : 'secondary'}`}
                                        disabled={isSubmitting}
                                    >
                                        {booking.is_paid ? 'Paid' : 'Mark Paid'}
                                    </button>
                                </div>
                                <div className={styles.userAction}>
                                    <button onClick={() => handleEditBookingClick(booking)} className="button secondary small" style={{ marginRight: '0.5rem' }} disabled={isSubmitting}>Edit</button>
                                    <button onClick={() => handleDeleteBooking(booking.id)} className="button danger small" disabled={isSubmitting}>Delete</button>
                                </div>
                            </>}
                        </div>
                    ))}
                </div>
            )}
        </>
    );

    // Define add content separately
    const addBookingContent = (
        <>
             <form ref={addBookingFormRef} onSubmit={handleAddBooking} style={{ padding: '1rem', border: '1px solid #ddd', borderRadius: '4px' }}>
                <h3>Add New Booking</h3>
                {fields.length === 0 ? (
                    <p>No fields available. Please add fields via Site Management first.</p>
                ) : (
                    <>
                        <div>
                            <label htmlFor="bookingFieldId">Field:</label>
                            <select id="bookingFieldId" name="bookingFieldId" required className="input">
                                <option value="">-- Select a Field --</option>
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
                            <input type="datetime-local" id="bookingStartTime" name="bookingStartTime" required className="input"/>
                        </div>
                        <div style={{ marginTop: '0.5rem' }}>
                            <label htmlFor="bookingEndTime">End Time:</label>
                            <input type="datetime-local" id="bookingEndTime" name="bookingEndTime" required className="input"/>
                        </div>
                        <div style={{ marginTop: '0.5rem' }}>
                            <label htmlFor="bookingServiceType">Service Type:</label>
                            <input type="text" id="bookingServiceType" name="bookingServiceType" placeholder="e.g., dog daycare, private rental" className="input"/>
                        </div>
                        <div style={{ marginTop: '0.5rem' }}>
                            <label htmlFor="bookingMaxCapacity">Max Capacity (Optional):</label>
                            <input type="number" id="bookingMaxCapacity" name="bookingMaxCapacity" min="0" className="input"/>
                        </div>
                        <button type="submit" style={{ marginTop: '1rem' }} className="button primary">Add Booking</button>
                    </>
                )}
            </form>
        </>
    );

    // Define Tabs for Admin
    const adminTabs = [
        { id: 'view', label: 'View Bookings', content: viewBookingsContent },
        { id: 'add', label: 'Add New Booking', content: addBookingContent },
    ];

    return (
        <section>
             {/* Conditionally render header only for admin */}
            {role === 'admin' && <h2>Booking Management ({role})</h2>}

             {/* Render Tabs for Admin, directly render View content for Staff */}
            {role === 'admin' ? (
                <TabNavigation tabs={adminTabs} />
            ) : (
                viewBookingsContent // Directly render the view content if not admin
            )}

            {/* Keep Edit Form/Modal outside tabs/conditional rendering */}
            {editingBooking && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
                    <div style={{ background: '#2a2a2e', padding: '2rem', borderRadius: 8, color: '#fff', width: '90%', maxWidth: '500px' }}>
                        <h3>Edit Booking ID: {editingBooking.id}</h3>
                        {localError && <p style={{ color: '#f87171' }}>{localError}</p>}
                        <form onSubmit={handleUpdateBookingSubmit}>
                             <div style={{ marginBottom: '1rem' }}>
                                <label>Field:</label>
                                <select value={editFormFieldId} onChange={(e) => setEditFormFieldId(e.target.value)} required className="input">
                                    <option value="">-- Select Field --</option>
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
                            <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
                                <div style={{flex: 1}}>
                                    <label>Start Time:</label>
                                    <input type="datetime-local" value={editFormStartTime} onChange={(e) => setEditFormStartTime(e.target.value)} required className="input" />
                                </div>
                                <div style={{flex: 1}}>
                                    <label>End Time:</label>
                                    <input type="datetime-local" value={editFormEndTime} onChange={(e) => setEditFormEndTime(e.target.value)} required className="input" />
                                </div>
                            </div>
                             <div style={{ marginBottom: '1rem' }}>
                                <label>Service Type:</label>
                                <input type="text" value={editFormServiceType} onChange={(e) => setEditFormServiceType(e.target.value)} className="input" />
                            </div>
                             <div style={{ marginBottom: '1rem' }}>
                                <label>Status:</label>
                                <input type="text" value={editFormStatus} onChange={(e) => setEditFormStatus(e.target.value)} className="input" />
                            </div>
                             <div style={{ marginBottom: '1rem' }}>
                                <label>Max Capacity (Optional):</label>
                                <input type="number" value={editFormMaxCapacity} onChange={(e) => setEditFormMaxCapacity(e.target.value)} min="0" className="input" />
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1.5rem' }}>
                                <button type="button" onClick={handleCancelEditBooking} className="button secondary" disabled={isSubmitting}>Cancel</button>
                                <button type="submit" className="button primary" disabled={isSubmitting}>{isSubmitting ? 'Saving...' : 'Save Changes'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </section>
    );
}