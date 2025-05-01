'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import SidebarNavigation from '@/components/SidebarNavigation';
import BookingManagement from '@/components/admin/BookingManagement';
import { createClient } from '@/utils/supabase/client';
import type { User } from '@supabase/supabase-js';
import type { Site, Field, Booking, Service } from '@/types';

// Define props for the staff dashboard - Only needs user now
interface StaffDashboardProps {
  user: User;
  // REMOVED all other props
}

export default function StaffDashboard({
  user,
  // REMOVED all other props from destructuring
}: StaffDashboardProps) {
  const supabase = createClient(); // Initialize Supabase client

  // === State Hooks ===
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [isLoadingBookings, setIsLoadingBookings] = useState(false);
  const [sites, setSites] = useState<Site[]>([]);
  const [fields, setFields] = useState<Field[]>([]);
  const [services, setServices] = useState<Service[]>([]); // Add services state
  const [isLoadingData, setIsLoadingData] = useState(true); // Consolidated loading state
  const [error, setError] = useState<string | null>(null); // Consolidated error state

  // Profile state (keep as is)
  const [profile, setProfile] = useState<{ first_name: string; last_name: string; phone: string } | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [editProfile, setEditProfile] = useState(false);
  const [editFields, setEditFields] = useState({ first_name: '', last_name: '', phone: '' });
  const [isSaving, setIsSaving] = useState(false);

  // Ref for booking form (if needed by BookingManagement or a future staff booking form)
  const addBookingFormRef = useRef<HTMLFormElement>(null);

  // === Fetching Functions ===
  const fetchData = useCallback(async () => {
    setIsLoadingData(true);
    setError(null);
    try {
      // Fetch bookings (likely filtered for the specific staff member? API needs adjustment?)
      // For now, assume /api/bookings returns all, or adjust API endpoint/params
      const bookingsRes = await fetch('/api/bookings'); // TODO: Filter by staff ID? `/api/bookings?staff_id=${user.id}`?
      if (!bookingsRes.ok) throw new Error(`Failed to fetch bookings: ${bookingsRes.statusText}`);
      const bookingsData: Booking[] = await bookingsRes.json();
      setBookings(bookingsData);

      // Fetch sites, fields, services (needed for booking management display/dropdowns)
      const [sitesRes, fieldsRes, servicesRes] = await Promise.all([
        fetch('/api/sites'),
        fetch('/api/fields'),
        fetch('/api/services') // Fetch services
      ]);

      if (!sitesRes.ok) throw new Error(`Failed to fetch sites: ${sitesRes.statusText}`);
      if (!fieldsRes.ok) throw new Error(`Failed to fetch fields: ${fieldsRes.statusText}`);
      if (!servicesRes.ok) throw new Error(`Failed to fetch services: ${servicesRes.statusText}`);

      const sitesData: Site[] = await sitesRes.json();
      const fieldsData: Field[] = await fieldsRes.json();
      const servicesData: Service[] = await servicesRes.json(); // Set services

      setSites(sitesData);
      setFields(fieldsData);
      setServices(servicesData); // Store services

    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : 'Failed to load dashboard data';
      console.error(errorMessage, e);
      setError(errorMessage);
      // Clear data on error
      setBookings([]);
      setSites([]);
      setFields([]);
      setServices([]);
    } finally {
      setIsLoadingData(false);
    }
  }, [user.id]); // Dependency on user.id if used in fetch path

  // Fetch dashboard data on mount
  useEffect(() => {
    fetchData();
  }, [fetchData]);

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

  // handleAddBooking might need to be defined here if Staff can create bookings
  // Or potentially passed through to BookingManagement if it handles its own adds
  const handleAddBooking = useCallback(async (event: React.FormEvent<HTMLFormElement>) => {
      // Placeholder: Implement staff booking logic if needed
      event.preventDefault();
      alert('Staff booking creation not implemented yet.');
      // Example using /api/admin-booking (if staff use that endpoint)
      // const formData = new FormData(event.currentTarget);
      // try {
      //   const res = await fetch('/api/admin-booking', { method: 'POST', body: formData });
      //   if (!res.ok) throw new Error(await res.text());
      //   fetchData(); // Refetch data after booking
      //   addBookingFormRef.current?.reset();
      // } catch(e) { setError(...) }
  }, [fetchData]); // Depends on refetch

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

  // === Helper Functions ===
  const getFieldsForSite = useCallback((siteId: number): Field[] => {
      return fields.filter(f => f.site_id === siteId);
  }, [fields]); // Depends on fields state

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
          sites={sites} // Pass local state
          fields={fields} // Pass local state
          services={services} // Pass local state
          error={error} // Pass local state
          refetchBookings={fetchData} // Pass main data fetcher
          handleToggleBookingPaidStatus={handleToggleBookingPaidStatus} // Pass handler
          // Pass other potentially needed props if BookingManagement requires them
          // handleAddBooking={handleAddBooking} // Pass if staff can add via this component
          // addBookingFormRef={addBookingFormRef}
          // getFieldsForSite={getFieldsForSite}
        />
      ),
    },
    {
      id: 'schedule',
      label: 'My Schedule',
      content: (
        <div>
          <h3>My Schedule</h3>
          <p>View your assigned bookings and daily schedule.</p>
          {/* Staff schedule component will be implemented here */}
          <div /* className={styles.comingSoon} */ >
            <p>Coming soon - calendar view of your upcoming shifts</p>
          </div>
        </div>
      ),
    },
    {
      id: 'clients',
      label: 'My Clients',
      content: (
        <div>
          <h3>My Assigned Clients</h3>
          <p>View details of clients assigned to your bookings.</p>
          <div /* className={styles.comingSoon} */ >
            <p>Coming soon - view client and pet details for your scheduled shifts</p>
          </div>
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
    </>
  );
}