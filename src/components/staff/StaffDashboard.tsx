'use client';

import React, { useState, useEffect } from 'react';
import SidebarNavigation from '@/components/SidebarNavigation';
import BookingManagement from '@/components/admin/BookingManagement';
// import type { User } from '@supabase/supabase-js'; // Type not used
import type { Site, Field, Booking /*, Service */ } from '@/types'; // Service type not used

// Define props for the staff dashboard
interface StaffDashboardProps {
  // user: User; // Removed unused prop
  // Booking management
  bookings: Booking[];
  isLoadingBookings: boolean;
  sites: Site[];
  fields: Field[];
  // services: Service[]; // Removed unused prop
  handleAddBooking: (event: React.FormEvent<HTMLFormElement>) => Promise<void>;
  addBookingFormRef: React.RefObject<HTMLFormElement | null>;
  getFieldsForSite: (siteId: number) => Field[];
  fetchBookings: () => Promise<void>;
  // Shared
  error: string | null;
  // Add paid status toggle handler
  handleToggleBookingPaidStatus: (bookingId: number, currentStatus: boolean) => Promise<void>;
}

export default function StaffDashboard({
  // _user, // Prop is unused
  bookings,
  isLoadingBookings,
  sites,
  fields,
  // _services, // Prop is unused
  handleAddBooking,
  addBookingFormRef,
  getFieldsForSite,
  fetchBookings,
  error,
  handleToggleBookingPaidStatus
}: StaffDashboardProps) {
  // Profile state
  const [profile, setProfile] = useState<{ first_name: string; last_name: string; phone: string } | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [editProfile, setEditProfile] = useState(false);
  const [editFields, setEditFields] = useState({ first_name: '', last_name: '', phone: '' });
  const [isSaving, setIsSaving] = useState(false);

  // Fetch profile on mount
  useEffect(() => {
    const fetchProfile = async () => {
      setProfileLoading(true);
      setProfileError(null);
      try {
        const res = await fetch('/api/profile');
        if (!res.ok) throw new Error((await res.json()).error || 'Failed to fetch profile');
        const data = await res.json();
        setProfile(data);
      } catch (e) {
        setProfileError(e instanceof Error ? e.message : 'Failed to fetch profile');
      } finally {
        setProfileLoading(false);
      }
    };
    fetchProfile();
  }, []);

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

  // Define tabs for the staff dashboard
  const staffTabs = [
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
      id: 'bookings',
      label: 'Today\'s Bookings',
      content: (
        <BookingManagement
          role="staff"
          bookings={bookings}
          isLoadingBookings={isLoadingBookings}
          sites={sites}
          fields={fields}
          error={error}
          handleAddBooking={handleAddBooking}
          addBookingFormRef={addBookingFormRef}
          getFieldsForSite={getFieldsForSite}
          refetchBookings={fetchBookings}
          handleToggleBookingPaidStatus={handleToggleBookingPaidStatus}
        />
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
            <div style={{ background: '#222', color: '#fff', padding: 16, borderRadius: 8, maxWidth: 400 }}>
              <label>First Name:<br />
                <input name="first_name" value={editFields.first_name} onChange={handleEditChange} style={{ background: '#333', color: '#fff', border: '1px solid #555', borderRadius: 4, padding: 4, width: '100%' }} />
              </label><br />
              <label>Last Name:<br />
                <input name="last_name" value={editFields.last_name} onChange={handleEditChange} style={{ background: '#333', color: '#fff', border: '1px solid #555', borderRadius: 4, padding: 4, width: '100%' }} />
              </label><br />
              <label>Phone:<br />
                <input name="phone" value={editFields.phone} onChange={handleEditChange} style={{ background: '#333', color: '#fff', border: '1px solid #555', borderRadius: 4, padding: 4, width: '100%' }} />
              </label><br />
              <button onClick={saveProfile} disabled={isSaving} style={{ color: '#fff', background: '#28a745', border: 'none', padding: '6px 16px', borderRadius: 4, marginRight: 8 }}>Save</button>
              <button onClick={cancelEdit} disabled={isSaving} style={{ color: '#fff', background: '#6c757d', border: 'none', padding: '6px 16px', borderRadius: 4 }}>Cancel</button>
            </div>
          )}
        </div>
      ),
    },
  ];

  return (
    <>
      <h2>Staff Dashboard</h2>
      <p>View your schedule and manage your assigned bookings.</p>
      <SidebarNavigation tabs={staffTabs} />
    </>
  );
}