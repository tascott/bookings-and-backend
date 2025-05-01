'use client';

import React, { useState, useEffect, useCallback } from 'react';
import SidebarNavigation from '@/components/SidebarNavigation';
import ClientBooking from '@/components/client/ClientBooking';
import PetManagement from '@/components/client/PetManagement';
import MyBookings from '@/components/client/MyBookings';
import type { User } from '@supabase/supabase-js';
import { Service } from '@/types';

// Define props for the client dashboard - Only needs user now
interface ClientDashboardProps {
  user: User;
}

export default function ClientDashboard({
  user,
}: ClientDashboardProps) {
  // Profile state
  const [profile, setProfile] = useState<{ first_name: string; last_name: string; phone: string } | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [editProfile, setEditProfile] = useState(false);
  const [editFields, setEditFields] = useState({ first_name: '', last_name: '', phone: '' });
  const [isSaving, setIsSaving] = useState(false);

  // Add state for services
  const [services, setServices] = useState<Service[]>([]);
  const [isLoadingServices, setIsLoadingServices] = useState(false);
  const [servicesError, setServicesError] = useState<string | null>(null);

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

  // Fetch services on mount
  const fetchServices = useCallback(async () => {
    setIsLoadingServices(true);
    setServicesError(null);
    try {
      // Clients likely fetch all active services
      const response = await fetch('/api/services?active=true'); // Assuming an ?active=true filter exists or is added
      if (!response.ok) throw new Error('Failed to fetch services');
      const data: Service[] = await response.json();
      setServices(data);
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : 'Failed to load services';
      console.error("Error fetching services:", errorMessage);
      setServicesError(errorMessage);
      setServices([]); // Set to empty array on error
    } finally {
      setIsLoadingServices(false);
    }
  }, []);

  useEffect(() => {
    fetchServices();
  }, [fetchServices]);


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

  // Define tabs for the client dashboard
  const clientTabs = [
    {
      id: 'book',
      label: 'Book Services',
      content: (
        // Pass the fetched services and loading/error states
        <ClientBooking
            services={services}
            isLoadingServices={isLoadingServices}
            servicesError={servicesError}
        />
      ),
    },
    {
      id: 'my-bookings',
      label: 'My Bookings',
      content: (
        <MyBookings />
      ),
    },
    {
      id: 'pets',
      label: 'My Pets',
      content: (
        <PetManagement />
      ),
    },
    {
      id: 'account',
      label: 'My Account',
      content: (
        <div>
          <h3>My Profile</h3>
          {profileLoading ? (
            <p>Loading profile...</p>
          ) : profileError ? (
            <p style={{ color: 'red' }}>{profileError}</p>
          ) : profile && !editProfile ? (
            <div>
              <p><strong>Email:</strong> {user.email}</p>
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
      <h2>Client Dashboard</h2>
      <p>Welcome to your doggy daycare portal. Book services, manage your pets, and view your appointments.</p>
      <SidebarNavigation tabs={clientTabs} />
    </>
  );
}