'use client';

import { useState, useCallback, FormEvent } from 'react';
import styles from "@/app/page.module.css"; // Adjust path as needed
import TabNavigation from '@/components/TabNavigation'; // Import TabNavigation
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

// Simple date formatter for display
const formatDate = (isoString: string): string => {
    try {
        return new Date(isoString).toLocaleDateString(undefined, { timeZone: 'UTC' });
    } catch {
        return 'Invalid Date';
    }
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

    // Define NEW add content separately
    const newAddBookingContent = (
        <div style={{ padding: '1rem' }}>
            <h3>Create New Booking (Admin)</h3>
            {addBookingError && <p style={{ color: 'red' }}>{addBookingError}</p>}

            {/* 1. Client Selection */}
            <div style={{ marginBottom: '1.5rem', position: 'relative' }}>
                <label htmlFor="clientSearch">Search Client (Name/Email):</label>
                <input
                    type="text"
                    id="clientSearch"
                    value={clientSearchTerm}
                    onChange={handleClientSearchChange}
                    placeholder="Enter 2+ characters..."
                    className="input"
                    disabled={!!selectedClient}
                />
                {isSearchingClients && <p>Searching...</p>}
                {clientSearchResults.length > 0 && (
                    <ul style={{ position: 'absolute', background: '#444', border: '1px solid #666', listStyle: 'none', padding: '0.5rem', margin: 0, zIndex: 10, maxHeight: '200px', overflowY: 'auto' }}>
                        {clientSearchResults.map(client => (
                            <li key={client.id} onClick={() => handleSelectClient(client)} style={{ cursor: 'pointer', padding: '0.3rem 0.5rem', borderBottom: '1px solid #555' }}>
                                {client.first_name} {client.last_name} ({client.email})
                            </li>
                        ))}
                    </ul>
                )}
                {selectedClient && (
                    <div style={{ marginTop: '0.5rem', padding: '0.5rem', background: '#3a3a3e', borderRadius: '4px' }}>
                        Selected: <strong>{[selectedClient.first_name, selectedClient.last_name].filter(Boolean).join(' ') || selectedClient.email}</strong>
                        <button onClick={() => { setSelectedClient(null); setClientPets([]); setSelectedPetIds(new Set()); setAvailableSlots([]); setSelectedSlots(new Set()); }} style={{ marginLeft: '1rem' }} className="button danger small">Change</button>
                    </div>
                )}
            </div>

            {/* 2. Pet Selection (Show only if client selected) */}
            {selectedClient && (
                <div style={{ marginBottom: '1.5rem' }}>
                    <label>Select Pet(s):</label>
                    {isLoadingClientPets ? (
                        <p>Loading pets...</p>
                    ) : clientPets.length > 0 ? (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem' }}>
                            {clientPets.map(pet => (
                                <label key={pet.id} style={{ background: '#444', padding: '0.5rem 1rem', borderRadius: '4px' }}>
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

             {/* 3. Service & Date Selection (Show only if client selected) */}
             {selectedClient && (
                <div style={{ marginBottom: '1.5rem', display: 'flex', gap: '1rem', alignItems: 'flex-end' }}>
                    <div style={{ flex: 2 }}>
                        <label htmlFor="adminBookingService">Select Service:</label>
                                <select
                            id="adminBookingService"
                            value={selectedServiceId}
                            onChange={handleServiceChange}
                                    required
                            className="input"
                            disabled={selectedPetIds.size === 0} // Disable if no pets selected
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
                            className="input"
                            disabled={!selectedServiceId} // Disable if no service
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
                            className="input"
                            disabled={!selectedServiceId} // Disable if no service
                                />
                            </div>
                     <button
                        type="button"
                        onClick={fetchAvailableSlotsForAdmin}
                        disabled={isLoadingSlots || !selectedServiceId || !selectedStartDate || !selectedEndDate}
                        className="button primary"
                    >
                        {isLoadingSlots ? 'Finding Slots...' : 'Find Slots'}
                    </button>
                </div>
             )}

             {/* 4. Slot Display & Selection (Show only if slots loaded) */}
             {availableSlots.length > 0 && (
                <div style={{ marginBottom: '1.5rem' }}>
                    <h4>Available Slots (Admin View)</h4>
                    <p style={{ fontSize: '0.9em', color: '#bbb' }}>Select a slot to book. Availability status shown is for clients (you can override).</p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem' }}>
                        {availableSlots.map((slot) => {
                            const slotKey = slot.start_time;
                            const isSelected = selectedSlots.has(slotKey);
                            const isUnavailable = slot.zero_capacity_reason === 'no_staff';
                            const isFull = slot.zero_capacity_reason === 'staff_full' || slot.remaining_capacity === 0; // Consider 0 capacity as full too
                            const isAvailableClient = !isUnavailable && !isFull;

                            return (
                                <div
                                    key={slotKey}
                                    style={{
                                        border: `2px solid ${isSelected ? '#00aaff' : '#555'}`,
                                        padding: '1rem',
                                        borderRadius: '4px',
                                        cursor: 'pointer',
                                        opacity: isSelected ? 1 : 0.9,
                                        background: isSelected ? '#003366' : '#333'
                                    }}
                                    onClick={() => handleSlotSelectionToggleForAdmin(slotKey)}
                                >
                                    <p><strong>Time:</strong> {formatDate(slot.start_time)} {new Date(slot.start_time).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', timeZone: 'UTC' })} - {new Date(slot.end_time).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', timeZone: 'UTC' })}</p>
                                    <p><strong>Client Status:</strong>
                                        {isAvailableClient ? <span style={{ color: 'lightgreen' }}> Available ({slot.remaining_capacity ?? 'Unlimited'})</span>
                                        : isFull ? <span style={{ color: 'orange' }}> Fully Booked</span>
                                        : isUnavailable ? <span style={{ color: '#aaa' }}> No Staff/Unavailable</span>
                                        : ' Unknown'}
                                    </p>
                                    <p style={{ fontSize: '0.8em', color: '#ccc' }}>Fields: {slot.field_ids?.join(', ') || 'N/A'}</p>
                                    {isSelected && <p style={{ color: '#00aaff', fontWeight: 'bold' }}>SELECTED</p>}
                            </div>
                            );
                        })}
                            </div>
                            </div>
             )}

             {/* 5. Booking Action Button (Show if slot selected) */}
             {selectedSlots.size > 0 && selectedClient && selectedPetIds.size > 0 && (
                <div style={{ marginTop: '2rem', textAlign: 'center' }}>
                     <button
                        type="button"
                        onClick={handleAdminBookingSubmit}
                        disabled={isCreatingBooking}
                        className="button primary large"
                    >
                        {isCreatingBooking ? 'Creating Booking...'
                         : `Book Slot for ${[selectedClient.first_name, selectedClient.last_name].filter(Boolean).join(' ') || selectedClient.email}` // Combine name fields or fallback to email
                        }
                                </button>
                </div>
             )}
        </div>
    );

    // Define Tabs for Admin (Using NEW add content)
    const adminTabs = [
        { id: 'view', label: 'View Bookings', content: viewBookingsContent },
        { id: 'add', label: 'Create Booking', content: newAddBookingContent },
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

            {/* Edit Booking Modal (Existing) */}
            {editingBooking && (
                 <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
                    <div style={{ background: '#2a2a2e', padding: '2rem', borderRadius: 8, color: '#fff', width: '90%', maxWidth: '500px' }}>
                        <h3>Edit Booking ID: {editingBooking.id}</h3>
                        {localError && <p style={{ color: '#f87171' }}>{localError}</p>}
                        <div className={styles.editFormContainer} style={{ marginTop: '2rem', padding: '1.5rem', border: '1px solid #555', borderRadius: '8px', background: '#3a3a3e' }}>
                            <h4>Edit Booking ID: {editingBooking.id}</h4>
                             <form onSubmit={handleUpdateBookingSubmit}>
                                <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
                                    <div style={{ flex: 1 }}>
                                        <label htmlFor="edit_start_time">Start Time:</label>
                                        <input type="datetime-local" id="edit_start_time" value={editFormStartTime} onChange={(e) => setEditFormStartTime(e.target.value)} required className="input" />
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <label htmlFor="edit_end_time">End Time:</label>
                                        <input type="datetime-local" id="edit_end_time" value={editFormEndTime} onChange={(e) => setEditFormEndTime(e.target.value)} required className="input" />
                                    </div>
                                </div>
                                <div style={{ marginBottom: '1rem' }}>
                                    <label htmlFor="edit_service_type">Service Type:</label>
                                    <input type="text" id="edit_service_type" value={editFormServiceType} onChange={(e) => setEditFormServiceType(e.target.value)} className="input" />
                                </div>
                                <div style={{ marginBottom: '1rem' }}>
                                    <label htmlFor="edit_status">Status:</label>
                                    <input type="text" id="edit_status" value={editFormStatus} onChange={(e) => setEditFormStatus(e.target.value)} className="input" />
                                </div>
                                <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'flex-end' }}>
                                    <button type="button" onClick={handleCancelEditBooking} className="button secondary" style={{ marginRight: '1rem' }} disabled={isSubmitting}>Cancel</button>
                                    <button type="submit" className="button primary" disabled={isSubmitting}>{isSubmitting ? 'Saving...' : 'Save Changes'}</button>
                            </div>
                        </form>
                        </div>
                    </div>
                </div>
            )}
        </section>
    );
}