'use client';

import React, { useState, useCallback, FormEvent, useMemo } from 'react';
import styles from "@/app/page.module.css"; // Adjust path as needed
import TabNavigation from '@/components/TabNavigation'; // Import TabNavigation
// import { format } from 'date-fns'; // REMOVED unused format import
// Import necessary types
import { Booking, Pet, Service } from '@/types'; // Removed unused Site, Field imports

// Define CalculatedSlot type locally (as it's not in global types)
// Based on structure returned by /api/available-slots
type CalculatedSlot = {
    start_time: string;           // ISO string
    end_time: string;             // ISO string
    remaining_capacity: number | null;
    price_per_pet?: number | null;
    zero_capacity_reason?: string | null; // 'staff_full', 'no_staff', or null (removed 'base_full')
    uses_staff_capacity?: boolean;
    field_ids?: number[];
    capacity_display?: string; // Optional display string from API
}

// Define props for the component
interface BookingManagementProps {
    role: string | null; // Role of the current user (admin or staff)
    bookings: Booking[];
    isLoadingBookings: boolean;
    services: Service[];
    error: string | null;
    refetchBookings: () => Promise<void>;
    handleToggleBookingPaidStatus: (bookingId: number, currentStatus: boolean) => Promise<void>;
}

// Helper function to format ISO string for datetime-local input
// YYYY-MM-DDTHH:mm
const formatDateTimeLocal = (isoString: string | null | undefined): string => {
    if (!isoString) return '';
    try {
        // For naive timestamps (like \'2025-05-05T10:00:00\'),
        // we can directly take the first 16 characters.
        // No timezone offset adjustment needed.
        // const date = new Date(isoString);
        // const timezoneOffset = date.getTimezoneOffset() * 60000; // offset in milliseconds
        // const localDate = new Date(date.getTime() - timezoneOffset);
        // return localDate.toISOString().slice(0, 16);
        if (isoString.length >= 16) {
            return isoString.slice(0, 16); // Returns \'YYYY-MM-DDTHH:mm\'
        } else {
            console.warn("Malformed ISO string for datetime-local input:", isoString);
            return '';
        }
    } catch (e) {
        console.error("Error formatting naive date for input:", isoString, e);
        return '';
    }
};

// Simple date formatter for display - Extract YYYY-MM-DD
const formatDate = (isoString: string): string => {
    if (!isoString || !isoString.includes('T')) return 'Invalid Date';
    try {
        return isoString.split('T')[0];
    } catch {
        return 'Invalid Date';
    }
};

// Formatter for time slots - Extract HH:mm
const formatTime = (isoString: string): string => {
    if (!isoString || !isoString.includes('T')) return 'N/A';
    try {
        // Extract HH:mm part after 'T'
        const timePart = isoString.split('T')[1];
        return timePart.substring(0, 5); // Get HH:mm
    } catch (e) {
        console.error("Error extracting time:", isoString, e);
        return 'Invalid Time';
    }
};

// Helper to create a consistent time slot key
// const getTimeSlotKey = (booking: Booking): string => {
//    return `${formatTime(booking.start_time)} - ${formatTime(booking.end_time)}`;
// };
// Removing date part from key as this component often shows multiple dates
// Or keep it if grouping should be per day+slot?
// For now, assume grouping is just by time HH:mm-HH:mm within the displayed list
const getTimeSlotKey = (booking: Booking): string => {
    return `${formatTime(booking.start_time)} - ${formatTime(booking.end_time)}`;
};

export default function BookingManagement({
    role,
    bookings,
    isLoadingBookings,
    services,
    error: parentError,
    refetchBookings,
    handleToggleBookingPaidStatus
}: BookingManagementProps) {

    // State for local operations (edit/delete errors)
    const [localError, setLocalError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false); // General submitting state

    // State for editing a booking
    const [editingBooking, setEditingBooking] = useState<Booking | null>(null);
    const [editFormStartTime, setEditFormStartTime] = useState<string>('');
    const [editFormEndTime, setEditFormEndTime] = useState<string>('');
    const [editFormServiceType, setEditFormServiceType] = useState<string>('');
    const [editFormStatus, setEditFormStatus] = useState<string>('');

    // --- NEW State for Admin Booking Creation ---
    const [clientSearchTerm, setClientSearchTerm] = useState('');
    const [isSearchingClients, setIsSearchingClients] = useState(false);
    const [clientSearchResults, setClientSearchResults] = useState<{ id: number; first_name: string | null; last_name: string | null; email: string }[]>([]);
    const [selectedClient, setSelectedClient] = useState<{ id: number; first_name: string | null; last_name: string | null; email: string } | null>(null);
    const [isLoadingClientPets, setIsLoadingClientPets] = useState(false);
    const [clientPets, setClientPets] = useState<Pet[]>([]);
    const [selectedPetIds, setSelectedPetIds] = useState<Set<number>>(new Set());
    const [selectedServiceId, setSelectedServiceId] = useState<string>('');
    const today = new Date().toISOString().split('T')[0];
    const nextWeekDate = new Date();
    nextWeekDate.setDate(nextWeekDate.getDate() + 7);
    const nextWeek = nextWeekDate.toISOString().split('T')[0];
    const [selectedStartDate, setSelectedStartDate] = useState<string>(today);
    const [selectedEndDate, setSelectedEndDate] = useState<string>(nextWeek);
    const [isLoadingSlots, setIsLoadingSlots] = useState(false);
    const [availableSlots, setAvailableSlots] = useState<CalculatedSlot[]>([]);
    const [selectedSlots, setSelectedSlots] = useState<Set<string>>(new Set()); // Key = startTime string
    const [addBookingError, setAddBookingError] = useState<string | null>(null);
    const [isCreatingBooking, setIsCreatingBooking] = useState(false);
    // --- END NEW State ---

    // --- Group Bookings for Display ---
    const groupedBookings = useMemo(() => {
        const groups = new Map<string, Booking[]>();
        bookings // Use the bookings prop directly
            // Sort primarily by date, then by time slot key
            .sort((a, b) => {
                const dateA = new Date(a.start_time).getTime();
                const dateB = new Date(b.start_time).getTime();
                if (dateA !== dateB) {
                    return dateA - dateB;
                }
                // If dates are same, sort by time slot key (lexicographically)
                return getTimeSlotKey(a).localeCompare(getTimeSlotKey(b));
            })
            .forEach(booking => {
                const key = getTimeSlotKey(booking);
                if (!groups.has(key)) {
                    groups.set(key, []);
                }
                groups.get(key)?.push(booking);
            });
        return groups;
    }, [bookings]); // Recalculate only when bookings prop changes

    // --- Edit Booking Handlers ---
    const handleEditBookingClick = useCallback((booking: Booking) => {
        setEditingBooking(booking);
        setEditFormStartTime(formatDateTimeLocal(booking.start_time));
        setEditFormEndTime(formatDateTimeLocal(booking.end_time));
        setEditFormServiceType(booking.service_type || '');
        setEditFormStatus(booking.status || '');
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
            start_time: editFormStartTime ? new Date(editFormStartTime).toISOString() : undefined,
            end_time: editFormEndTime ? new Date(editFormEndTime).toISOString() : undefined,
            service_type: editFormServiceType || undefined,
            status: editFormStatus || undefined,
        };

        // Basic validation
        if (!payload.start_time || !payload.end_time) {
            setLocalError('Start Time and End Time are required during update.');
            setIsSubmitting(false);
            return;
        }
         if (new Date(payload.end_time) <= new Date(payload.start_time)) {
            setLocalError('End time must be after start time.');
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
    }, [editingBooking, editFormStartTime, editFormEndTime, editFormServiceType, editFormStatus, refetchBookings]);

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

    // --- NEW Admin Booking Creation Handlers ---
    const handleClientSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const term = event.target.value;
        setClientSearchTerm(term);
        setClientSearchResults([]); // Clear previous results
        setSelectedClient(null); // Clear selected client
        setClientPets([]); // Clear pets
        setSelectedPetIds(new Set()); // Clear pet selection
        setAddBookingError(null); // Clear errors

        if (term.length >= 2) {
            fetchClients(term);
        }
    };

    const fetchClients = useCallback(async (term: string) => {
        setIsSearchingClients(true);
        setAddBookingError(null);
        try {
            const response = await fetch(`/api/clients?search=${encodeURIComponent(term)}&limit=10`);
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to search clients');
            }
            const data = await response.json();
            setClientSearchResults(data.clients || []);
        } catch (e) {
            setAddBookingError(e instanceof Error ? e.message : 'Client search failed');
            setClientSearchResults([]);
        } finally {
            setIsSearchingClients(false);
        }
    }, []);

    const handleSelectClient = (client: { id: number; first_name: string | null; last_name: string | null; email: string }) => {
        setSelectedClient(client);
        setClientSearchTerm(''); // Clear search term
        setClientSearchResults([]); // Hide results dropdown
        fetchClientPets(client.id);
        // Clear subsequent selections
        setSelectedPetIds(new Set());
        setSelectedServiceId('');
        setAvailableSlots([]);
        setSelectedSlots(new Set());
    };

    const fetchClientPets = useCallback(async (clientId: number) => {
        setIsLoadingClientPets(true);
        setClientPets([]);
        setSelectedPetIds(new Set());
        setAddBookingError(null);
        try {
            const response = await fetch(`/api/clients/${clientId}/pets`);
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to fetch pets');
            }
            const data: Pet[] = await response.json();
            setClientPets(data); // Removed filtering by is_active
        } catch (e) {
            setAddBookingError(e instanceof Error ? e.message : 'Failed to fetch pets');
            setClientPets([]);
        } finally {
            setIsLoadingClientPets(false);
        }
    }, []);

    const handlePetSelectionChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const petId = parseInt(event.target.value, 10);
        const isChecked = event.target.checked;

        setSelectedPetIds(prev => {
            const newSet = new Set(prev);
            if (isChecked) {
                newSet.add(petId);
            } else {
                newSet.delete(petId);
            }
            return newSet;
        });
    };

    const handleServiceChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
        setSelectedServiceId(event.target.value);
        setAvailableSlots([]); // Clear slots when service changes
        setSelectedSlots(new Set());
    };

    // TODO: Implement fetchAvailableSlotsForAdmin
    const fetchAvailableSlotsForAdmin = useCallback(async () => {
         if (!selectedServiceId || !selectedStartDate || !selectedEndDate) {
            setAddBookingError('Please select a service and date range first.');
            return;
        }
        setIsLoadingSlots(true);
        setAvailableSlots([]);
        setSelectedSlots(new Set());
        setAddBookingError(null);

        try {
            const queryParams = new URLSearchParams({
                service_id: selectedServiceId,
                start_date: selectedStartDate,
                end_date: selectedEndDate,
                // We might omit client_default_staff_id here for admin view
                // Or the API/RPC needs modification to handle an admin context
            });
            const response = await fetch(`/api/available-slots?${queryParams.toString()}`);
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to fetch slots');
            }
            const data: CalculatedSlot[] = await response.json();
            setAvailableSlots(data);
        } catch (e) {
            setAddBookingError(e instanceof Error ? e.message : 'Failed to load slots');
            setAvailableSlots([]);
        } finally {
            setIsLoadingSlots(false);
        }
    }, [selectedServiceId, selectedStartDate, selectedEndDate]);

    // TODO: Implement handleSlotSelectionToggleForAdmin - DONE (simplified to single select)
    const handleSlotSelectionToggleForAdmin = (slotKey: string) => {
        setSelectedSlots(prev => {
            const newSet = new Set(prev);
            // Allow selecting only one slot at a time for now
            if (newSet.has(slotKey)) {
                newSet.clear(); // Deselect if clicking the same one
            } else {
                newSet.clear();
                newSet.add(slotKey);
            }
            return newSet;
        });
    };

    // TODO: Implement handleAdminBookingSubmit - DONE
    const handleAdminBookingSubmit = async () => {
        if (!selectedClient || selectedPetIds.size === 0 || !selectedServiceId || selectedSlots.size === 0) {
            setAddBookingError('Please select a client, pet(s), service, and a time slot.');
            return;
        }

        const slotStartTime = selectedSlots.values().next().value; // Get the single selected slot key
        const slotDetails = availableSlots.find(s => s.start_time === slotStartTime);

        if (!slotDetails) {
            setAddBookingError('Selected slot details not found. Please fetch slots again.');
            return;
        }

        setIsCreatingBooking(true);
        setAddBookingError(null);

        const payload = {
            client_id: selectedClient.id,
            pet_ids: Array.from(selectedPetIds),
            service_id: parseInt(selectedServiceId, 10),
            start_time: slotDetails.start_time,
            end_time: slotDetails.end_time,
        };

        try {
            // Call the new API endpoint
            const response = await fetch('/api/admin-booking', { // NEW ENDPOINT
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Admin booking failed');
            }

            alert('Booking created successfully!'); // Simple confirmation
            // Reset form state
            setClientSearchTerm('');
            setSelectedClient(null);
            setClientPets([]);
            setSelectedPetIds(new Set());
            setSelectedServiceId('');
            setAvailableSlots([]);
            setSelectedSlots(new Set());
            await refetchBookings(); // Refetch the main booking list

        } catch (e) {
            setAddBookingError(e instanceof Error ? e.message : 'Failed to create booking');
        } finally {
            setIsCreatingBooking(false);
        }
    };
    // --- END NEW Admin Handlers ---

    // --- Define Tab Content ---

    // Content for the Existing Bookings view
    const existingBookingsView = (
        <div className={styles.tableContainer}>
            {parentError && <p className={styles.errorText}>Error loading bookings: {parentError}</p>}
            {localError && <p className={styles.errorText}>Error: {localError}</p>}
            {isLoadingBookings ? (
                <p>Loading bookings...</p>
            ) : groupedBookings.size === 0 ? (
                <p>No bookings found{role === 'staff' ? ' for today' : ''}.</p> // Clarify for staff view
            ) : (
                <table className={styles.table}>
                    <thead>
                        <tr>
                            {/* Add Date column if role is admin, as multiple dates might show */}
                            {role === 'admin' && <th>Date</th>}
                            <th>Client</th>
                            <th>Pet(s)</th>
                            <th>Service</th>
                            <th>Time Slot</th>
                            <th>Status</th>
                            <th>Paid</th>
                            {role === 'admin' && <th>Notes</th>}
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {/* Iterate through grouped bookings */}
                        {Array.from(groupedBookings.entries()).map(([timeSlot, bookingsInGroup]) => (
                            <React.Fragment key={timeSlot}>
                                {/* Separator row shows only the Time Slot */}
                                <tr className={styles.timeSlotSeparator}>
                                     {/* Adjust colspan dynamically */}
                                    <td colSpan={role === 'admin' ? 9 : 8}>
                                        <strong>{timeSlot}</strong>
                                    </td>
                                </tr>
                                {bookingsInGroup.map(booking => (
                                    <tr key={booking.id}>
                                        {/* Conditionally show Date column for admin */}
                                        {role === 'admin' && <td>{formatDate(booking.start_time)}</td>}
                                        <td>{booking.client_name || 'N/A'}</td>
                                        <td>{booking.pet_names?.join(', ') || 'N/A'}</td>
                                        <td>{booking.service_type || 'N/A'}</td>
                                        <td>{timeSlot}</td>
                                        <td>{booking.status || 'N/A'}</td>
                                        <td>
                                            <input
                                                type="checkbox"
                                                checked={!!booking.is_paid}
                                                onChange={() => handleToggleBookingPaidStatus(booking.id, !!booking.is_paid)}
                                                disabled={isSubmitting}
                                            />
                                        </td>
                                        {role === 'admin' && <td>{booking.assignment_notes || '-'}</td>}
                                        <td>
                                            {role === 'admin' ? (
                                                <>
                                                    <button
                                                        onClick={() => handleEditBookingClick(booking)}
                                                        className={`${styles.button} ${styles.buttonSmall} ${styles.buttonSecondary}`}
                                                        disabled={isSubmitting}
                                                    >
                                                        Edit
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteBooking(booking.id)}
                                                        className={`${styles.button} ${styles.buttonSmall} ${styles.buttonDanger}`}
                                                        disabled={isSubmitting}
                                                    >
                                                        Delete
                                                    </button>
                                                </>
                                            ) : (
                                                // Staff view: Placeholder button (was alert, now just text or disabled)
                                                 <button
                                                    className={`${styles.button} ${styles.buttonSmall} ${styles.buttonSecondary}`}
                                                    onClick={() => alert(`Details for booking ${booking.id}`)} // Keep alert for now
                                                    disabled={isSubmitting} // Keep disabled state consistent
                                                 >
                                                     Details
                                                 </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </React.Fragment>
                        ))}
                    </tbody>
                </table>
            )}
        </div>
    );

    // Content for the Add Booking view (Admin only)
    const addBookingView = (
        <div className={styles.formSection}>
            <h3>Create New Booking (Admin)</h3>
            {addBookingError && <p className={styles.errorText}>{addBookingError}</p>}

            {/* 1. Client Selection */}
            {/* ... (existing client search input and results display) ... */}
             <div style={{ marginBottom: '1.5rem', position: 'relative' }}>
                 <label htmlFor="clientSearch">Search Client (Name/Email):</label>
                 <input
                     type="text"
                     id="clientSearch"
                     value={clientSearchTerm}
                     onChange={handleClientSearchChange}
                     placeholder="Enter 2+ characters..."
                     className={styles.input}
                     disabled={!!selectedClient}
                 />
                 {isSearchingClients && <p>Searching...</p>}
                 {clientSearchResults.length > 0 && (
                     <ul className={styles.searchResultsList}>
                         {clientSearchResults.map(client => (
                             <li key={client.id} onClick={() => handleSelectClient(client)}>
                                 {client.first_name} {client.last_name} ({client.email})
                             </li>
                         ))}
                     </ul>
                 )}
                 {selectedClient && (
                     <div className={styles.selectedItemBox}>
                         Selected: <strong>{[selectedClient.first_name, selectedClient.last_name].filter(Boolean).join(' ') || selectedClient.email}</strong>
                         <button onClick={() => { setSelectedClient(null); setClientPets([]); setSelectedPetIds(new Set()); setAvailableSlots([]); setSelectedSlots(new Set()); }} className={`${styles.button} ${styles.buttonSmall} ${styles.buttonDanger}`} style={{ marginLeft: '1rem' }}>Change</button>
                     </div>
                 )}
             </div>

            {/* 2. Pet Selection */}
            {selectedClient && (
                 <div style={{ marginBottom: '1.5rem' }}>
                     <label>Select Pet(s):</label>
                     {isLoadingClientPets ? (
                         <p>Loading pets...</p>
                     ) : clientPets.length > 0 ? (
                         <div className={styles.checkboxGroupContainer}>
                             {clientPets.map(pet => (
                                 <label key={pet.id} className={styles.checkboxLabel}>
                                     <input
                                             type="checkbox"
                                         value={pet.id}
                                         checked={selectedPetIds.has(pet.id)}
                                         onChange={handlePetSelectionChange}
                                         style={{ marginRight: '0.5rem' }}
                                     />
                                     {pet.name}
                                 </label>
                             ))}
                         </div>
                     ) : (
                         <p>This client has no active pets.</p>
                     )}
                 </div>
             )}

            {/* 3. Service & Date Selection */}
            {selectedClient && (
                 <div style={{ marginBottom: '1.5rem', display: 'flex', gap: '1rem', alignItems: 'flex-end' }}>
                     <div style={{ flex: 2 }}>
                         <label htmlFor="adminBookingService">Select Service:</label>
                                 <select
                             id="adminBookingService"
                             value={selectedServiceId}
                             onChange={handleServiceChange}
                                     required
                             className={styles.input}
                             disabled={selectedPetIds.size === 0}
                         >
                             <option value="">-- Select Service --</option>
                             {services.map(service => (
                                 <option key={service.id} value={service.id}>{service.name}</option>
                                     ))}
                                 </select>
                             </div>
                     <div style={{ flex: 1 }}>
                         <label htmlFor="adminBookingStartDate">Start Date:</label>
                                 <input
                             type="date"
                             id="adminBookingStartDate"
                             value={selectedStartDate}
                             onChange={e => setSelectedStartDate(e.target.value)}
                                     required
                             className={styles.input}
                             disabled={!selectedServiceId}
                                 />
                             </div>
                     <div style={{ flex: 1 }}>
                         <label htmlFor="adminBookingEndDate">End Date:</label>
                                 <input
                             type="date"
                             id="adminBookingEndDate"
                             value={selectedEndDate}
                             onChange={e => setSelectedEndDate(e.target.value)}
                                     required
                             className={styles.input}
                             disabled={!selectedServiceId}
                                 />
                             </div>
                      <button
                         type="button"
                         onClick={fetchAvailableSlotsForAdmin}
                         disabled={isLoadingSlots || !selectedServiceId || !selectedStartDate || !selectedEndDate}
                         className={`${styles.button} ${styles.buttonPrimary}`}
                     >
                         {isLoadingSlots ? 'Finding Slots...' : 'Find Slots'}
                     </button>
                 </div>
              )}

            {/* 4. Slot Display & Selection */}
             {availableSlots.length > 0 && (
                 <div style={{ marginBottom: '1.5rem' }}>
                     <h4>Available Slots (Admin View)</h4>
                     <p className={styles.subtleText}>Select a slot to book. Availability status shown is for clients (you can override).</p>
                     <div className={styles.slotSelectionContainer}>
                         {availableSlots.map((slot) => {
                             const slotKey = slot.start_time;
                             const isSelected = selectedSlots.has(slotKey);
                            // ... (slot status logic)
                             const isUnavailable = slot.zero_capacity_reason === 'no_staff';
                             const isFull = slot.zero_capacity_reason === 'staff_full' || slot.remaining_capacity === 0; // Consider 0 capacity as full too
                             const isAvailableClient = !isUnavailable && !isFull;

                             return (
                                 <div
                                     key={slotKey}
                                     className={`${styles.slotCard} ${isSelected ? styles.slotCardSelected : ''} ${!isAvailableClient ? styles.slotCardUnavailable : ''}`}
                                     onClick={() => handleSlotSelectionToggleForAdmin(slotKey)}
                                 >
                                     <p><strong>Time:</strong> {formatDate(slot.start_time)} {formatTime(slot.start_time)} - {formatTime(slot.end_time)}</p>
                                     <p><strong>Client Status:</strong>
                                         {isAvailableClient ? <span style={{ color: 'lightgreen' }}> Available ({slot.capacity_display ?? slot.remaining_capacity ?? 'Unlimited'})</span>
                                         : isFull ? <span style={{ color: 'orange' }}> Fully Booked</span>
                                         : isUnavailable ? <span style={{ color: '#aaa' }}> No Staff/Unavailable</span>
                                         : ' Unknown'}
                                     </p>
                                     <p className={styles.subtleText}>Fields: {slot.field_ids?.join(', ') || 'N/A'}</p>
                                     {isSelected && <p style={{ color: '#00aaff', fontWeight: 'bold' }}>SELECTED</p>}
                             </div>
                             );
                         })}
                             </div>
                             </div>
              )}

            {/* 5. Booking Action Button */}
            {selectedSlots.size > 0 && selectedClient && selectedPetIds.size > 0 && (
                 <div style={{ marginTop: '2rem', textAlign: 'center' }}>
                      <button
                         type="button"
                         onClick={handleAdminBookingSubmit}
                         disabled={isCreatingBooking}
                         className={`${styles.button} ${styles.buttonPrimary} ${styles.buttonLarge}`}
                     >
                         {isCreatingBooking ? 'Creating Booking...'
                          : `Book Slot for ${[selectedClient.first_name, selectedClient.last_name].filter(Boolean).join(' ') || selectedClient.email}`
                         }
                                 </button>
                 </div>
              )}
        </div>
    );

    // Define Tabs for Admin navigation - Content is required by TabNavigation
    const adminTabs = [
        { id: 'existing', label: 'Existing Bookings', content: existingBookingsView },
        { id: 'add', label: 'Create Booking', content: addBookingView },
    ];

    // --- Component Render ---
    return (
        <div className={styles.managementSection}>
            {editingBooking ? (
                // --- Edit Booking Form Modal/Overlay ---
                 <div className={styles.editFormContainer}>
                     <h3>Edit Booking #{editingBooking.id}</h3>
                     {localError && <p className={styles.errorText}>Error: {localError}</p>}
                     <form onSubmit={handleUpdateBookingSubmit}>
                         {/* Add form fields for editing: Start Time, End Time, Service Type, Status */}
                         <div className={styles.formField}>
                             <label htmlFor="editStartTime">Start Time:</label>
                             <input
                                 type="datetime-local"
                                 id="editStartTime"
                                 value={editFormStartTime}
                                 onChange={(e) => setEditFormStartTime(e.target.value)}
                                 required
                                 className={styles.input}
                             />
                         </div>
                         <div className={styles.formField}>
                             <label htmlFor="editEndTime">End Time:</label>
                             <input
                                 type="datetime-local"
                                 id="editEndTime"
                                 value={editFormEndTime}
                                 onChange={(e) => setEditFormEndTime(e.target.value)}
                                 required
                                 className={styles.input}
                             />
                         </div>
                         <div className={styles.formField}>
                             <label htmlFor="editServiceType">Service Type:</label>
                             <select
                                 id="editServiceType"
                                 value={editFormServiceType}
                                 onChange={(e) => setEditFormServiceType(e.target.value)}
                                 required
                                 className={styles.input}
                             >
                                 <option value="">-- Select Service --</option>
                                 {/* Assuming services prop contains needed types */}
                                 {/* Example - replace with actual service types if available */}
                                 <option value="Daycare">Daycare</option>
                                 <option value="Field Hire">Field Hire</option>
                             </select>
                         </div>
                         <div className={styles.formField}>
                             <label htmlFor="editStatus">Status:</label>
                             <input
                                 type="text"
                                 id="editStatus"
                                 value={editFormStatus}
                                 onChange={(e) => setEditFormStatus(e.target.value)}
                                 required
                                 className={styles.input}
                             />
                         </div>
                         <div className={styles.formActions}>
                            <button type="button" onClick={handleCancelEditBooking} className={`${styles.button} ${styles.buttonSecondary}`} disabled={isSubmitting}>
                                Cancel
                            </button>
                            <button type="submit" className={`${styles.button} ${styles.buttonPrimary}`} disabled={isSubmitting}>
                                {isSubmitting ? 'Updating...' : 'Save Changes'}
                            </button>
                         </div>
                     </form>
                 </div>
            ) : (
                 // --- Main View (Tabs for Admin, direct view for Staff) ---
                 <>
                    {role === 'admin' ? (
                        // Admin sees Tabs - TabNavigation handles state and content display internally
                        <TabNavigation
                            tabs={adminTabs}
                        />
                    ) : (
                        // Staff only see the existing bookings view (filtered by parent)
                        existingBookingsView
                    )}
                </>
            )}
        </div>
    );
}