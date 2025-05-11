'use client';

import React, { useState, useCallback, FormEvent, useMemo, Fragment, useEffect } from 'react';
import styles from "@/app/page.module.css"; // Adjust path as needed
import TabNavigation from '@/components/TabNavigation'; // Import TabNavigation
import { getDay } from 'date-fns'; // Import getDay
// import { format } from 'date-fns'; // REMOVED unused format import
// import Modal from '../shared/Modal'; // Removed unused Modal import
// Update type import path
import {
	Booking, Pet, Service, UpdateBookingPayload, AvailableSlot, CreateBookingPayload,
	// Client, // Removed unused Client type
} from '@booking-and-accounts-monorepo/shared-types';

// Import API services
import {
	searchClientsForAdmin,
	fetchPetsByClientId,
	fetchAvailableSlots,
	createAdminBookingAPI,
	updateBookingDetailsAPI,
	deleteBookingAPI
} from '@booking-and-accounts-monorepo/api-services';

// Define CalculatedSlot type locally (as it's not in global types)
// Based on structure returned by /api/available-slots
// type CalculatedSlot = { // This will be replaced by AvailableSlot from shared-code
//     start_time: string;           // ISO string
//     end_time: string;             // ISO string
//     remaining_capacity: number | null;
//     price_per_pet?: number | null;
//     zero_capacity_reason?: string | null; // 'staff_full', 'no_staff', or null (removed 'base_full')
//     uses_staff_capacity?: boolean;
//     field_ids?: number[];
//     capacity_display?: string; // Optional display string from API
// }

// Define props for the component
interface BookingManagementProps {
    role: 'admin' | 'staff'; // Role determines available actions
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

// Format date for display (e.g., "Wednesday, 14 May 2025")
const formatFullDate = (isoString: string): string => {
    try {
        const date = new Date(isoString.split('T')[0] + 'T00:00:00Z'); // Parse date part as UTC
        if (isNaN(date.getTime())) return 'Invalid Date';
        return date.toLocaleDateString('en-GB', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC'
        });
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

// Helper to check if a date string (YYYY-MM-DD) is a weekend
const isWeekend = (dateString: string): boolean => {
    try {
        const date = new Date(dateString + 'T00:00:00Z'); // Parse as UTC
        if (isNaN(date.getTime())) return false;
        const day = getDay(date); // Use date-fns getDay (Sun=0, Sat=6)
        return day === 0 || day === 6;
    } catch {
        return false;
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
    const [availableSlots, setAvailableSlots] = useState<AvailableSlot[]>([]);
    const [selectedSlots, setSelectedSlots] = useState<Set<string>>(new Set()); // Key = startTime string
    const [addBookingError, setAddBookingError] = useState<string | null>(null);
    const [isCreatingBooking, setIsCreatingBooking] = useState(false);

    // State to track collapsed date sections
    const [collapsedDates, setCollapsedDates] = useState<Set<string>>(new Set());

    // --- Group Bookings by Date (Desc) then Time Slot (Asc) ---
    const groupedBookingsByDate = useMemo(() => {
        // Group by Date String (YYYY-MM-DD)
        const groupsByDate = new Map<string, Booking[]>();
        bookings.forEach(booking => {
            const dateKey = formatDate(booking.start_time); // YYYY-MM-DD
            if (!groupsByDate.has(dateKey)) {
                groupsByDate.set(dateKey, []);
            }
            groupsByDate.get(dateKey)?.push(booking);
        });
        // Sort dates descending
        const sortedDates = Array.from(groupsByDate.keys()).sort((a, b) => b.localeCompare(a));
        // Within each date, group by time slot and sort time slots
        const finalGroupedData = new Map<string, Map<string, Booking[]>>();
        sortedDates.forEach(dateKey => {
            const bookingsOnDate = groupsByDate.get(dateKey) || [];
            const groupsByTimeSlot = new Map<string, Booking[]>();
            bookingsOnDate.forEach(booking => {
                const timeSlotKey = getTimeSlotKey(booking);
                if (!groupsByTimeSlot.has(timeSlotKey)) {
                    groupsByTimeSlot.set(timeSlotKey, []);
                }
                groupsByTimeSlot.get(timeSlotKey)?.push(booking);
            });
            // Sort time slots chronologically within the date
            const sortedTimeSlots = Array.from(groupsByTimeSlot.keys()).sort();
            const sortedTimeSlotMap = new Map<string, Booking[]>();
            sortedTimeSlots.forEach(tsKey => {
                sortedTimeSlotMap.set(tsKey, groupsByTimeSlot.get(tsKey) || []);
            });
            finalGroupedData.set(dateKey, sortedTimeSlotMap);
        });
        return finalGroupedData;
    }, [bookings]);

    // Effect to set initial collapsed state (AFTER groupedBookingsByDate is defined)
    useEffect(() => {
        if (groupedBookingsByDate.size > 0) {
            // Initialize with all dates collapsed
            setCollapsedDates(new Set(groupedBookingsByDate.keys()));
        }
        // Reset if bookings become empty (optional)
        else {
            setCollapsedDates(new Set());
        }
    }, [groupedBookingsByDate]); // Run when the grouped data changes

    // Toggle collapsed state for a date
    const toggleDateCollapse = useCallback((dateKey: string) => {
        setCollapsedDates(prev => {
            const newSet = new Set(prev);
            if (newSet.has(dateKey)) {
                newSet.delete(dateKey);
            } else {
                newSet.add(dateKey);
            }
            return newSet;
        });
    }, []);

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

        const payload: UpdateBookingPayload = {
            start_time: editFormStartTime ? new Date(editFormStartTime).toISOString() : undefined,
            end_time: editFormEndTime ? new Date(editFormEndTime).toISOString() : undefined,
            service_type: editFormServiceType || undefined, // Uses service_type (string)
            status: editFormStatus || undefined,
            // notes, assigned_staff_id, vehicle_id could be added to the form and payload if needed
        };

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
            await updateBookingDetailsAPI('', editingBooking.id, payload); // Use the service

            setEditingBooking(null);
            await refetchBookings();

        } catch (e: unknown) {
            const errorMessage = e instanceof Error ? e.message : (typeof e === 'string' ? e : 'An unknown error occurred.');
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

        setIsSubmitting(true);
        setLocalError(null);

        try {
            await deleteBookingAPI('', bookingId); // Use the service

            await refetchBookings();

        } catch (e: unknown) {
            const errorMessage = e instanceof Error ? e.message : (typeof e === 'string' ? e : 'An unknown error occurred.');
            console.error("Delete Booking Error:", e);
            setLocalError(errorMessage);
        } finally {
            setIsSubmitting(false);
        }
    }, [refetchBookings]);

    // --- NEW Admin Booking Creation Handlers ---
    const handleClientSearchChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const searchTerm = event.target.value;
        setClientSearchTerm(searchTerm);
        if (searchTerm.length < 2) {
            setClientSearchResults([]);
            return;
        }
        setIsSearchingClients(true);
        setLocalError(null);
        try {
            const data = await searchClientsForAdmin(searchTerm);
            setClientSearchResults(data);
        } catch (err: unknown) {
            console.error("Client search error:", err);
            const message = err instanceof Error ? err.message : typeof err === 'string' ? err : 'Could not search clients.';
            setLocalError(message);
            setClientSearchResults([]);
        }
        setIsSearchingClients(false);
    };

    const handleSelectClient = async (client: { id: number; first_name: string | null; last_name: string | null; email: string }) => {
        setSelectedClient(client);
        setClientSearchTerm('');
        setClientSearchResults([]);
        setIsLoadingClientPets(true);
        setLocalError(null);
        try {
            const petData = await fetchPetsByClientId(client.id);
            setClientPets(petData);
        } catch (err: unknown) {
            console.error("Fetch client pets error:", err);
            const message = err instanceof Error ? err.message : typeof err === 'string' ? err : 'Could not fetch pets for the selected client.';
            setLocalError(message);
            setClientPets([]);
        }
        setIsLoadingClientPets(false);
    };

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

    // --- NEW Admin Booking Creation: Fetch Available Slots ---
    const fetchAvailableSlotsForAdminDateRange = useCallback(async () => {
        if (!selectedServiceId || !selectedStartDate || !selectedEndDate) {
            setAvailableSlots([]);
            return;
        }
        setIsLoadingSlots(true);
        setAddBookingError(null);
        try {
            const data = await fetchAvailableSlots({
                serviceId: selectedServiceId,
                startDate: selectedStartDate,
                endDate: selectedEndDate
            });
            setAvailableSlots(data);
        } catch (e: unknown) {
            console.error("Fetch available slots error:", e);
            const message = e instanceof Error ? e.message : typeof e === 'string' ? e : 'Could not fetch available slots.';
            setAddBookingError(message);
            setAvailableSlots([]);
        }
        setIsLoadingSlots(false);
    }, [selectedServiceId, selectedStartDate, selectedEndDate]);

    useEffect(() => {
        fetchAvailableSlotsForAdminDateRange();
    }, [fetchAvailableSlotsForAdminDateRange]);

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
            setAddBookingError('Client, pets, service, and at least one slot must be selected.');
            return;
        }

        setIsCreatingBooking(true);
        setAddBookingError(null);
        let createdCount = 0;
        let lastError: string | null = null;

        const slotsToBook = Array.from(selectedSlots)
            .map(slotKey => availableSlots.find(s => s.start_time === slotKey))
            .filter(Boolean) as AvailableSlot[];

        for (const slot of slotsToBook) {
            const payload: CreateBookingPayload = {
                client_id: selectedClient.id,
                pet_ids: Array.from(selectedPetIds),
                service_id: parseInt(selectedServiceId, 10),
                start_time: slot.start_time,
                end_time: slot.end_time,
                field_ids: slot.field_ids,
            };

            try {
                await createAdminBookingAPI('', payload);
                createdCount++;
            } catch (e: unknown) {
                console.error(`Error creating booking for slot ${slot.start_time}:`, e);
                lastError = e instanceof Error ? e.message : typeof e === 'string' ? e : 'An error occurred during booking creation.';
                // Optionally, decide if you want to stop on first error or try all slots
                // For now, it tries all slots and reports the last error.
            }
        }

        setIsCreatingBooking(false);

        if (createdCount === slotsToBook.length && createdCount > 0) {
            setAddBookingError(null); // Clear any previous errors on full success
            alert('Booking(s) created successfully!');
            // Reset form or parts of it
            setSelectedClient(null);
            setClientPets([]);
            setSelectedPetIds(new Set());
            // setSelectedServiceId(''); // Keep service?
            setAvailableSlots([]);
            setSelectedSlots(new Set());
            setClientSearchTerm('');
            refetchBookings(); // Refresh the main booking list
        } else if (createdCount > 0 && createdCount < slotsToBook.length) {
            setAddBookingError(`Partially created bookings. ${createdCount}/${slotsToBook.length} successful. Last error: ${lastError}`);
            refetchBookings();
        } else if (lastError) {
            setAddBookingError(lastError);
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
            ) : groupedBookingsByDate.size === 0 ? (
                <p>No bookings found{role === 'staff' ? ' for today' : ''}.</p>
            ) : (
                <table className={styles.table}>
                    <thead>
                        <tr>
                            {/* Keep header always visible */}
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
                    {/* Use a single tbody to avoid whitespace/hydration issues */}
                    <tbody>
                        {Array.from(groupedBookingsByDate.entries()).map(([dateKey, bookingsByTimeSlot]) => {
                            const isCollapsed = collapsedDates.has(dateKey);
                            const rowClass = isWeekend(dateKey) ? styles.weekendRow : styles.weekdayRow;
                            const headerRowClass = `${styles.dateSeparatorRow} ${rowClass}`;

                            return (
                                <Fragment key={dateKey}>
                                    {/* Date Header Row */}
                                    <tr className={headerRowClass} onClick={() => toggleDateCollapse(dateKey)} style={{ cursor: 'pointer' }}>
                                        <td colSpan={role === 'admin' ? 8 : 7}>
                                            <span style={{ marginRight: '0.5rem' }}>{isCollapsed ? '▶' : '▼'}</span>
                                            <strong>{formatFullDate(dateKey)}</strong>
                                        </td>
                                    </tr>

                                    {/* Conditionally Rendered Booking Rows for this Date */}
                                    {!isCollapsed && Array.from(bookingsByTimeSlot.entries()).map(([timeSlot, bookingsInGroup]) => (
                                        <Fragment key={`${dateKey}-${timeSlot}`}>
                                            {/* Optional: Time Slot Separator Row - Might add extra whitespace, consider styling first/last booking row instead */}
                                             <tr className={styles.timeSlotSeparatorInner}>
                                                 <td colSpan={role === 'admin' ? 8 : 7}><strong>{timeSlot}</strong></td>
                                             </tr>
                                            {bookingsInGroup.map(booking => (
                                                <tr key={booking.id}>
                                                    <td>{booking.client_name || 'N/A'}</td>
                                                    <td>{booking.pets && booking.pets.length > 0
                                                        ? booking.pets.map(pet => pet.name).join(', ')
                                                        : 'No Pets'}</td>
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
                                                                <button onClick={() => handleEditBookingClick(booking)} className={`${styles.button} ${styles.buttonSmall} ${styles.buttonSecondary}`} disabled={isSubmitting}>Edit</button>
                                                                <button onClick={() => handleDeleteBooking(booking.id)} className={`${styles.button} ${styles.buttonSmall} ${styles.buttonDanger}`} disabled={isSubmitting}>Delete</button>
                                                            </>
                                                        ) : (
                                                            <button className={`${styles.button} ${styles.buttonSmall} ${styles.buttonSecondary}`} onClick={() => alert(`Details for booking ${booking.id}`)} disabled={isSubmitting}>Details</button>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </Fragment>
                                    ))}
                                </Fragment>
                            );
                        })}
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
                 <label htmlFor="clientSearch">Search Client (Email):</label>
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
                         onClick={fetchAvailableSlotsForAdminDateRange}
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
                                     <p><strong>Time:</strong> {formatDateTimeLocal(slot.start_time)} {formatTime(slot.start_time)} - {formatTime(slot.end_time)}</p>
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

    // Determine which tabs to show with content
    const tabs = [
        { id: 'existing', label: 'View Bookings', content: existingBookingsView }, // Add content
        // Only show "Add Booking" tab for admins
        ...(role === 'admin' ? [{ id: 'add', label: 'Add New Booking', content: addBookingView }] : []) // Add content
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
                        <TabNavigation tabs={tabs} defaultTabId="existing" />
                    ) : (
                        // Staff only see the existing bookings view (filtered by parent)
                        existingBookingsView
                    )}
                </>
            )}
        </div>
    );
}