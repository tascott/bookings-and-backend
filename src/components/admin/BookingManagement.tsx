'use client';

import { useState, useCallback, FormEvent, ChangeEvent } from 'react';
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

    return (
        <section style={{ marginTop: '2rem', borderTop: '1px solid #eee', paddingTop: '2rem' }}>
            <h2>Booking Management ({role})</h2>

            {/* Display Local Error (e.g., update/delete error) */}
            {localError && <p style={{ color: 'red' }}>Operation Error: {localError}</p>}

             {/* Display Parent Error (e.g., initial load error) - only if no local error */}
            {parentError && !localError && !isLoadingBookings && bookings.length === 0 &&
                <p style={{ color: 'red' }}>Error loading bookings: {parentError}</p>
            }

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
            ) : bookings.length === 0 && !parentError ? (
                <p>No bookings found.</p>
            ) : bookings.length > 0 ? (
                <div className={styles.bookingListContainer}>
                    <table className={styles.bookingTable}><thead>
                            <tr>
                                <th>ID</th>
                                <th>Client</th>
                                <th>Pet(s)</th>
                                <th>Field</th>
                                <th>Start Time</th>
                                <th>End Time</th>
                                <th>Service</th>
                                <th>Status</th>
                                <th>Paid</th>
                                <th>Actions</th>
                            </tr>
                        </thead><tbody>
                            {bookings.map(booking => (
                                <tr key={booking.id}>
                                    <td>{booking.id}</td>
                                    <td>{booking.client_name || 'N/A'} (ID: {booking.client_id || 'N/A'})</td>
                                    <td>{booking.pet_names?.join(', ') || 'N/A'}</td>
                                    <td>{fields.find(f => f.id === booking.field_id)?.name || `ID ${booking.field_id}`}</td>
                                    <td>{formatDateTimeLocal(booking.start_time)}</td>
                                    <td>{formatDateTimeLocal(booking.end_time)}</td>
                                    <td>{booking.service_type || 'N/A'}</td>
                                    <td>{booking.status}</td>
                                    <td><input
                                            type="checkbox"
                                            checked={booking.is_paid}
                                            onChange={() => handleToggleBookingPaidStatus(booking.id, booking.is_paid)}
                                            title={booking.is_paid ? 'Mark as Unpaid' : 'Mark as Paid'}
                                            disabled={isSubmitting}
                                        /><span style={{ marginLeft: '4px' }}>{booking.is_paid ? 'Yes' : 'No'}</span></td>
                                    <td><button onClick={() => handleEditBookingClick(booking)} disabled={isSubmitting} style={{ marginRight: '0.5rem' }}>Edit</button><button onClick={() => handleDeleteBooking(booking.id)} disabled={isSubmitting} style={{ color: 'red' }}>Delete</button></td>
                                </tr>
                            ))}
                        </tbody></table>
                </div>
            ) : null}

            {/* Edit Booking Modal */}
            {editingBooking && (
                <div className={styles.editBookingModal}>
                    <div className={styles.editBookingModalContent}>
                        <h4>Editing Booking ID: {editingBooking.id}</h4>
                        <form onSubmit={handleUpdateBookingSubmit}>
                            <div style={{ marginBottom: '0.5rem' }}>
                                <label htmlFor={`editBookingFieldId-${editingBooking.id}`}>Field:</label>
                                <select
                                    id={`editBookingFieldId-${editingBooking.id}`}
                                    value={editFormFieldId}
                                    onChange={(e: ChangeEvent<HTMLSelectElement>) => setEditFormFieldId(e.target.value)}
                                    required
                                    style={{ marginLeft: '0.5rem' }}
                                >
                                    {sites.map(site => (
                                        <optgroup key={`edit-site-${site.id}`} label={site.name}>
                                            {getFieldsForSite(site.id).map(field => (
                                                <option key={`edit-field-${field.id}`} value={field.id}>
                                                    {field.name || `Field ID ${field.id}`}
                                                </option>
                                            ))}
                                        </optgroup>
                                    ))}
                                </select>
                            </div>
                            <div style={{ marginBottom: '0.5rem' }}>
                                <label htmlFor={`editBookingStartTime-${editingBooking.id}`}>Start Time:</label>
                                <input
                                    type="datetime-local"
                                    id={`editBookingStartTime-${editingBooking.id}`}
                                    value={editFormStartTime}
                                    onChange={(e: ChangeEvent<HTMLInputElement>) => setEditFormStartTime(e.target.value)}
                                    required
                                    style={{ marginLeft: '0.5rem' }}
                                />
                            </div>
                            <div style={{ marginBottom: '0.5rem' }}>
                                <label htmlFor={`editBookingEndTime-${editingBooking.id}`}>End Time:</label>
                                <input
                                    type="datetime-local"
                                    id={`editBookingEndTime-${editingBooking.id}`}
                                    value={editFormEndTime}
                                    onChange={(e: ChangeEvent<HTMLInputElement>) => setEditFormEndTime(e.target.value)}
                                    required
                                    style={{ marginLeft: '0.5rem' }}
                                />
                            </div>
                            <div style={{ marginBottom: '0.5rem' }}>
                                <label htmlFor={`editBookingServiceType-${editingBooking.id}`}>Service Type:</label>
                                <input
                                    type="text"
                                    id={`editBookingServiceType-${editingBooking.id}`}
                                    value={editFormServiceType}
                                    onChange={(e) => setEditFormServiceType(e.target.value)}
                                    style={{ marginLeft: '0.5rem' }}
                                />
                            </div>
                            <div style={{ marginBottom: '0.5rem' }}>
                                <label htmlFor={`editBookingStatus-${editingBooking.id}`}>Status:</label>
                                <input
                                    type="text"
                                    id={`editBookingStatus-${editingBooking.id}`}
                                    value={editFormStatus}
                                    onChange={(e: ChangeEvent<HTMLInputElement>) => setEditFormStatus(e.target.value)}
                                    style={{ marginLeft: '0.5rem' }}
                                />
                            </div>
                            <div style={{ marginBottom: '0.5rem' }}>
                                <label htmlFor={`editBookingMaxCapacity-${editingBooking.id}`}>Max Capacity:</label>
                                <input
                                    type="number"
                                    id={`editBookingMaxCapacity-${editingBooking.id}`}
                                    value={editFormMaxCapacity}
                                    onChange={(e: ChangeEvent<HTMLInputElement>) => setEditFormMaxCapacity(e.target.value)}
                                    min="0"
                                    style={{ marginLeft: '0.5rem' }}
                                />
                            </div>
                            <div style={{ marginTop: '1rem' }}>
                                <button type="submit" disabled={isSubmitting} style={{ marginRight: '0.5rem' }}>
                                    {isSubmitting ? 'Saving...' : 'Save Changes'}
                                </button>
                                <button type="button" onClick={handleCancelEditBooking} disabled={isSubmitting}>
                                    Cancel
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </section>
    );
}