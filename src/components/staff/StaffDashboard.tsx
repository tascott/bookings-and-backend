'use client';

import React, { useState, useEffect, useCallback } from 'react';
import SidebarNavigation from '@/components/SidebarNavigation';
import BookingManagement from '@/components/admin/BookingManagement';
// import { createClient } from '@/utils/supabase/client'; // Unused
import type { User } from '@supabase/supabase-js';
// Removed Site, Field from import as they are unused now
import type { Booking, Service, Client, Pet } from '@/types';
import CalendarView, { CalendarEvent } from '@/components/shared/CalendarView'; // Import CalendarView and CalendarEvent
import Modal from '@/components/shared/Modal'; // Import the Modal component

// Define a type for the client data we expect for this view
// (Subset of what the API returns, excluding nested/redundant fields)
type StaffAssignedClient = Omit<Client, 'profiles' | 'staff' | 'default_staff_name'> & {
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  pets: Pet[];
};

// Define props for the staff dashboard - Only needs user now
interface StaffDashboardProps {
  user: User;
}

export default function StaffDashboard({
  user,
}: StaffDashboardProps) {
  // const supabase = createClient(); // Unused

  // === State Hooks ===
  const [bookings, setBookings] = useState<Booking[]>([]);
  // const [sites, setSites] = useState<Site[]>([]); // Removed unused state
  // const [fields, setFields] = useState<Field[]>([]); // Removed unused state
  const [services, setServices] = useState<Service[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Profile state (keep as is)
  const [profile, setProfile] = useState<{ first_name: string; last_name: string; phone: string } | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [editProfile, setEditProfile] = useState(false);
  const [editFields, setEditFields] = useState({ first_name: '', last_name: '', phone: '' });
  const [isSaving, setIsSaving] = useState(false);

  // === NEW State for My Clients tab ===
  const [myClients, setMyClients] = useState<StaffAssignedClient[]>([]);
  const [isLoadingMyClients, setIsLoadingMyClients] = useState(true);
  const [myClientsError, setMyClientsError] = useState<string | null>(null);

  // === NEW State for Calendar ===
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]); // State to hold events for the calendar
  const [isLoadingCalendar, setIsLoadingCalendar] = useState(false); // Loading state for calendar-specific data if needed
  const [calendarError, setCalendarError] = useState<string | null>(null); // Error state for calendar data fetching

  // === State for Booking Details Modal ===
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [selectedBookingForModal, setSelectedBookingForModal] = useState<Booking | null>(null);

  // === Fetching Functions ===
  const fetchData = useCallback(async () => {
    setIsLoadingData(true);
    setError(null);
    try {
      // Fetch bookings
      const bookingsRes = await fetch('/api/bookings'); // TODO: Filter by staff ID? `/api/bookings?staff_id=${user.id}`?
      if (!bookingsRes.ok) throw new Error(`Failed to fetch bookings: ${bookingsRes.statusText}`);
      const bookingsData: Booking[] = await bookingsRes.json();
      setBookings(bookingsData);

      // Fetch services (needed for booking management display/dropdowns)
      // Removed sites and fields fetches
      const servicesRes = await fetch('/api/services');

      if (!servicesRes.ok) throw new Error(`Failed to fetch services: ${servicesRes.statusText}`);

      const servicesData: Service[] = await servicesRes.json();

      // setSites(sitesData); // Removed
      // setFields(fieldsData); // Removed
      setServices(servicesData);

    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : 'Failed to load dashboard data';
      console.error(errorMessage, e);
      setError(errorMessage);
      // Clear data on error
      setBookings([]);
      // setSites([]); // Removed
      // setFields([]); // Removed
      setServices([]);
    } finally {
      setIsLoadingData(false);
    }
  }, [user.id]); // Dependency on user.id if used in fetch path

  // === NEW Fetch Function for My Clients ===
  const fetchMyClients = useCallback(async () => {
    setIsLoadingMyClients(true);
    setMyClientsError(null);
    try {
      const res = await fetch('/api/clients?assigned_staff_id=me');
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || `Failed to fetch assigned clients: ${res.statusText}`);
      }
      const data: { clients: StaffAssignedClient[], total: number } = await res.json();
      // Log the received data structure - REMOVED
      // console.log('Fetched assigned clients data:', JSON.stringify(data, null, 2));
      setMyClients(data.clients || []);
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : 'Failed to load assigned clients';
      console.error(errorMessage, e);
      setMyClientsError(errorMessage);
      setMyClients([]); // Clear data on error
    } finally {
      setIsLoadingMyClients(false);
    }
  }, []);

  // === Placeholder Fetch Function for Calendar Data (e.g., staff schedule/bookings) ===
  // TODO: Implement actual data fetching for staff schedule
  const fetchCalendarData = useCallback(async () => {
    setIsLoadingCalendar(true);
    setCalendarError(null);
    try {
      // Fetch bookings assigned to this staff member
      // Note: Use the user.id associated with the *auth* user, which should match bookings.assigned_staff_id (UUID)
      const res = await fetch(`/api/bookings?assigned_staff_id=${user.id}`);
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to fetch schedule');
      }
      const bookingsData: Booking[] = await res.json();

      // Map the fetched bookings data to the CalendarEvent format
      const mappedEvents: CalendarEvent[] = bookingsData.map(booking => ({
        id: booking.id,
        // Use service_type for the title, fallback if needed.
        // Update this if the API returns the full service name later.
        title: booking.service_type || 'Booking',
        // Ensure start_time and end_time are converted to Date objects
        start: new Date(booking.start_time),
        end: new Date(booking.end_time),
        resource: booking, // Attach the original booking object for potential use in handlers
        allDay: false // Assuming bookings are not all-day events unless specified otherwise
      }));

      setCalendarEvents(mappedEvents); // Update state with mapped events
      console.log(`Fetched ${mappedEvents.length} bookings for staff calendar.`);

    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : 'Failed to load schedule data';
      console.error(errorMessage, e);
      setCalendarError(errorMessage);
      setCalendarEvents([]); // Clear events on error
    } finally {
      setIsLoadingCalendar(false);
    }
  }, [user.id]); // Depend on user.id

  // Fetch dashboard data on mount
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Fetch assigned clients on mount
  useEffect(() => {
    fetchMyClients();
  }, [fetchMyClients]);

  // Fetch calendar data on mount
  useEffect(() => {
    fetchCalendarData();
  }, [fetchCalendarData]);

  // Fetch profile data (keep as is)
  useEffect(() => {
    const fetchProfileData = async () => {
      setProfileLoading(true);
      setProfileError(null);
      try {
        const res = await fetch('/api/profile'); // Assumes /api/profile fetches the current user's profile
        if (!res.ok) throw new Error((await res.json()).error || 'Failed to fetch profile');
        const data = await res.json();
        setProfile(data);
      } catch (e) {
        setProfileError(e instanceof Error ? e.message : 'Failed to fetch profile');
      } finally {
        setProfileLoading(false);
      }
    };
    fetchProfileData();
  }, []);

  // === Action Handlers ===

  // handleToggleBookingPaidStatus - Staff might not have permission? Check API/requirements
  // Assuming staff *can* toggle status for now, mimicking AdminDashboard
  const handleToggleBookingPaidStatus = useCallback(async (bookingId: number, currentStatus: boolean) => {
    setError(null);
    const newStatus = !currentStatus;
    try {
        // Staff might need a specific endpoint or the generic one needs role checks
        const response = await fetch(`/api/bookings/${bookingId}/status`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ is_paid: newStatus }),
        });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to update booking status');
        }
        // Update local state
        setBookings(prevBookings =>
            prevBookings.map(b =>
                b.id === bookingId ? { ...b, is_paid: newStatus } : b
            )
        );
    } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to update booking status');
    }
  }, []);

  // === NEW Calendar Interaction Handlers ===
  const handleCalendarDayClick = (slotInfo: { start: Date; end: Date; }) => {
    // This handler receives the date clicked (start and end will be the same day for single clicks)
    console.log('Calendar day clicked:', slotInfo.start);
    // Future TODO: Implement logic, e.g., show details for that day, navigate to day view, set selected date state.
  };

  const handleCalendarEventClick = (event: CalendarEvent) => {
    // This handler receives the specific event object clicked
    console.log('Calendar event clicked:', event);
    // Access original booking data via event.resource
    // Ensure the resource is actually a Booking before setting state
    if (event.resource && typeof event.resource === 'object' && 'start_time' in event.resource) {
      setSelectedBookingForModal(event.resource as Booking);
      setIsBookingModalOpen(true);
    } else {
      console.error('Clicked calendar event resource is not a valid Booking object:', event.resource);
      // Optionally show an error to the user
    }
  };

  // === Helper Functions ===

  // Profile edit functions (keep as is)
  const startEdit = () => {
    if (!profile) return;
    setEditFields({
      first_name: profile.first_name || '',
      last_name: profile.last_name || '',
      phone: profile.phone || ''
    });
    setEditProfile(true);
  };
  const cancelEdit = () => setEditProfile(false);
  const handleEditChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEditFields(f => ({ ...f, [e.target.name]: e.target.value }));
  };
  const saveProfile = async () => {
    setIsSaving(true);
    setProfileError(null);
    try {
      const payload = {
        ...editFields,
        phone: editFields.phone.trim() === '' ? null : editFields.phone.trim()
      };
      const res = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Failed to update profile');
      const data = await res.json();
      setProfile(data);
      setEditProfile(false);
    } catch (e) {
      setProfileError(e instanceof Error ? e.message : 'Failed to update profile');
    } finally {
      setIsSaving(false);
    }
  };

  // === Define Tabs ===
  const staffTabs = [
    {
      id: 'bookings',
      label: 'Today\'s Bookings', // Maybe filter bookings for today?
      content: (
        <BookingManagement
          role="staff"
          bookings={bookings} // Pass local state
          isLoadingBookings={isLoadingData} // Use consolidated loading state
          services={services} // Pass local state
          error={error} // Pass local state
          refetchBookings={fetchData} // Pass main data fetcher
          handleToggleBookingPaidStatus={handleToggleBookingPaidStatus} // Pass handler
        />
      ),
    },
    {
      id: 'schedule',
      label: 'My Schedule',
      content: (
        <div>
          <h3>My Schedule</h3>
          <p>View your assigned bookings and availability. Click on a booking for details.</p>
          {isLoadingCalendar && <p>Loading schedule...</p>}
          {calendarError && <p style={{ color: 'red' }}>Error loading schedule: {calendarError}</p>}
          {!isLoadingCalendar && !calendarError && (
            <CalendarView
              events={calendarEvents}
              onSelectSlot={handleCalendarDayClick}
              onSelectEvent={handleCalendarEventClick}
            />
          )}
        </div>
      ),
    },
    {
      id: 'clients',
      label: 'My Clients',
      content: (
        <div>
          <h3>My Assigned Clients</h3>
          <p>Clients for whom you are the default assigned staff member.</p>
          {isLoadingMyClients && <p>Loading clients...</p>}
          {myClientsError && <p style={{ color: 'red' }}>Error: {myClientsError}</p>}
          {!isLoadingMyClients && !myClientsError && (
            myClients.length > 0 ? (
              <ul style={{ listStyleType: 'disc', paddingLeft: '20px' }}>
                {myClients.map(client => (
                  <li key={client.id} style={{ marginBottom: '10px' }}>
                    <div>
                      <strong>{client.first_name || ''} {client.last_name || ''}</strong> ({client.email})
                      {client.phone && <span> - Phone: {client.phone}</span>}
                    </div>
                    {client.pets && client.pets.length > 0 && (
                      <ul style={{ listStyleType: 'circle', paddingLeft: '20px', marginTop: '5px' }}>
                        {client.pets.map(pet => (
                           <li key={pet.id} style={{ fontSize: '0.9em' }}>
                             {pet.name} ({pet.breed})
                           </li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p>No clients are currently assigned to you.</p>
            )
          )}
        </div>
      ),
    },
    {
      id: 'profile',
      label: 'My Profile',
      content: (
        <div>
          <h3>My Profile</h3>
          {profileLoading ? (
            <p>Loading profile...</p>
          ) : profileError ? (
            <p style={{ color: 'red' }}>{profileError}</p>
          ) : profile && !editProfile ? (
            <div>
              <p><strong>First Name:</strong> {profile.first_name || 'N/A'}</p>
              <p><strong>Last Name:</strong> {profile.last_name || 'N/A'}</p>
              <p><strong>Phone:</strong> {profile.phone || 'N/A'}</p>
              <button onClick={startEdit}>Edit</button>
            </div>
          ) : (
            <div style={{ background: '#2a2a2e', padding: '2rem', borderRadius: 8, color: '#fff', width: '90%', maxWidth: '500px' }}>
              <label>First Name:<br />
                <input name="first_name" value={editFields.first_name} onChange={handleEditChange} className="input" />
              </label><br />
              <label>Last Name:<br />
                <input name="last_name" value={editFields.last_name} onChange={handleEditChange} className="input" />
              </label><br />
              <label>Phone:<br />
                <input name="phone" value={editFields.phone} onChange={handleEditChange} className="input" />
              </label><br />
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1.5rem' }}>
                <button onClick={cancelEdit} disabled={isSaving} className="button secondary">Cancel</button>
                <button onClick={saveProfile} disabled={isSaving} className="button primary">{isSaving ? 'Saving...' : 'Save Changes'}</button>
              </div>
            </div>
          )}
        </div>
      ),
    },
  ];

  // Helper function to format date/time
  const formatDateTime = (isoString: string) => {
    if (!isoString) return 'N/A';
    try {
        const date = new Date(isoString);
        return date.toLocaleString(); // Adjust format as needed
    } catch (e) {
        console.error("Error formatting date:", isoString, e);
        return 'Invalid Date';
    }
  };

  // === Render ===
  return (
    <>
      <h2>Staff Dashboard</h2>
      <p>View your schedule and manage your assigned bookings.</p>
      {/* Display consolidated error */}
      {error && <p style={{ color: 'red' }}>Error loading dashboard: {error}</p>}
      {/* Display loading state */}
      {isLoadingData && <p>Loading dashboard data...</p>}
      {!isLoadingData && <SidebarNavigation tabs={staffTabs} />}

      {/* Booking Details Modal */}
      <Modal
        isOpen={isBookingModalOpen}
        onClose={() => setIsBookingModalOpen(false)}
        title="Booking Details"
      >
        {selectedBookingForModal ? (
          <div>
            <p><strong>Service:</strong> {selectedBookingForModal.service_type || 'N/A'}</p>
            {/* Attempt to display client name if available */}
            {selectedBookingForModal.client_name && (
              <p><strong>Client:</strong> {selectedBookingForModal.client_name}</p>
            )}
            {/* Attempt to display pet names if available */}
            {selectedBookingForModal.pet_names && selectedBookingForModal.pet_names.length > 0 && (
              <p><strong>Pets:</strong> {selectedBookingForModal.pet_names.join(', ')}</p>
            )}
            <p><strong>Start Time:</strong> {formatDateTime(selectedBookingForModal.start_time)}</p>
            <p><strong>End Time:</strong> {formatDateTime(selectedBookingForModal.end_time)}</p>
            <p><strong>Status:</strong> {selectedBookingForModal.status || 'N/A'}</p>
            <p><strong>Paid:</strong> {selectedBookingForModal.is_paid ? 'Yes' : 'No'}</p>
            {selectedBookingForModal.assignment_notes && (
              <p><strong>Assignment Notes:</strong> {selectedBookingForModal.assignment_notes}</p>
            )}
            {/* Display raw booking data for debugging (optional) */}
            {/* <pre style={{ fontSize: '0.8em', background: '#333', padding: '10px', borderRadius: '4px', maxHeight: '200px', overflow: 'auto' }}>
              {JSON.stringify(selectedBookingForModal, null, 2)}
            </pre> */}
          </div>
        ) : (
          <p>Loading booking details...</p>
        )}
      </Modal>
    </>
  );
}