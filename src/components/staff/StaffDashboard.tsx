'use client';

import React, { useState, useEffect } from 'react';
import TabNavigation from '@/components/TabNavigation';
import BookingManagement from '@/components/admin/BookingManagement';
import styles from '@/app/page.module.css';
import type { User } from '@supabase/supabase-js';
import { Site, Field, Booking, Service, Vehicle } from '@/types';

// Define props for the staff dashboard
interface StaffDashboardProps {
  user: User; // Keep for future use even if not currently used
  // Booking management
  bookings: Booking[];
  isLoadingBookings: boolean;
  sites: Site[];
  fields: Field[];
  services: Service[]; // Keep for future use
  handleAddBooking: (event: React.FormEvent<HTMLFormElement>) => Promise<void>;
  addBookingFormRef: React.RefObject<HTMLFormElement | null>;
  getFieldsForSite: (siteId: number) => Field[];
  fetchBookings: () => Promise<void>;
  // Shared
  error: string | null;
  vehicles?: Vehicle[];
}

export default function StaffDashboard({
  user: _user, // Rename to _user to indicate it's not currently used
  bookings,
  isLoadingBookings,
  sites,
  fields,
  services: _services, // Rename to _services to indicate it's not currently used
  handleAddBooking,
  addBookingFormRef,
  getFieldsForSite,
  fetchBookings,
  error,
  vehicles = [],
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
          <div className={styles.comingSoon}>
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
          <div className={styles.comingSoon}>
            <p>Coming soon - view client and pet details for your scheduled shifts</p>
          </div>
        </div>
      ),
    },
    {
      id: 'my-vehicle',
      label: 'My Vehicle',
      content: (
        <div>
          <h3>My Vehicle</h3>
          {vehicles.length === 0 ? (
            <p>You have no vehicles assigned.</p>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0 }}>
              {vehicles.map(vehicle => (
                <li key={vehicle.id} style={{ border: '1px solid #eee', padding: '0.8rem', marginBottom: '0.5rem', borderRadius: '4px' }}>
                  <strong>{vehicle.make} {vehicle.model}</strong> ({vehicle.year || 'Year N/A'})<br />
                  Color: {vehicle.color || 'N/A'}<br />
                  License Plate: {vehicle.license_plate || 'N/A'}<br />
                  Notes: {vehicle.notes || 'N/A'}<br />
                </li>
              ))}
            </ul>
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
    <div className={styles.roleTabsContent}>
      <h2>Staff Dashboard</h2>
      <p>View your schedule and manage your assigned bookings.</p>
      <TabNavigation tabs={staffTabs} />
    </div>
  );
}