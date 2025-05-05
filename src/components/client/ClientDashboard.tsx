'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import SidebarNavigation from '@/components/SidebarNavigation';
import ClientBooking from '@/components/client/ClientBooking';
import PetManagement from '@/components/client/PetManagement';
import MyBookings from '@/components/client/MyBookings';
import type { User } from '@supabase/supabase-js';
import { Service } from '@/types';
import { GeocoderAutocomplete } from '@geoapify/geocoder-autocomplete';
import '@geoapify/geocoder-autocomplete/styles/minimal-dark.css';

// Define props for the client dashboard - Only needs user now
interface ClientDashboardProps {
  user: User;
  businessType?: string | null; // <-- Add optional businessType prop
}

// Define profile type including new fields
interface ProfileData {
  user_id?: string; // Assuming user_id is fetched
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  email_allow_promotional: boolean;
  email_allow_informational: boolean;
  address_line_1: string | null;
  address_line_2: string | null;
  town_or_city: string | null;
  county: string | null;
  postcode: string | null;
  country: string | null;
  latitude: number | null;
  longitude: number | null;
}

export default function ClientDashboard({
  user,
  businessType, // <-- Destructure businessType
}: ClientDashboardProps) {
  // Profile state using the new interface
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [editProfile, setEditProfile] = useState(false);
  // Update editFields state type and initial values
  const [editFields, setEditFields] = useState({
    first_name: '',
    last_name: '',
    phone: '',
    email_allow_promotional: true, // Default to true
    email_allow_informational: true, // Default to true
    address_line_1: '',
    address_line_2: '',
    town_or_city: '',
    county: '',
    postcode: '',
    country: '',
    latitude: null as number | null, // Initialize latitude
    longitude: null as number | null // Initialize longitude
  });
  const [isSaving, setIsSaving] = useState(false);

  // Ref for Geoapify autocomplete
  const autocompleteContainerRef = useRef<HTMLDivElement>(null);

  // Add state for services
  const [services, setServices] = useState<Service[]>([]);

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
        // Initialize editFields if profile is fetched successfully
        setEditFields({
            first_name: data.first_name || '',
            last_name: data.last_name || '',
            phone: data.phone || '',
            email_allow_promotional: data.email_allow_promotional ?? true,
            email_allow_informational: data.email_allow_informational ?? true,
            address_line_1: data.address_line_1 || '',
            address_line_2: data.address_line_2 || '',
            town_or_city: data.town_or_city || '',
            county: data.county || '',
            postcode: data.postcode || '',
            country: data.country || '',
            latitude: data.latitude || null,
            longitude: data.longitude || null
        });
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
    try {
      // Clients likely fetch all active services
      const response = await fetch('/api/services?active=true'); // Assuming an ?active=true filter exists or is added
      if (!response.ok) throw new Error('Failed to fetch services');
      const data: Service[] = await response.json();
      setServices(data);
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : 'Failed to load services';
      console.error("Error fetching services:", errorMessage);
      setServices([]); // Set to empty array on error
    }
  }, []);

  useEffect(() => {
    fetchServices();
  }, [fetchServices]);

  // Initialize Geoapify Autocomplete when edit form is visible
  useEffect(() => {
    if (editProfile && autocompleteContainerRef.current) {
      const apiKey = process.env.NEXT_PUBLIC_GEOAPIFY_KEY;
      console.log('[ClientDashboard] Geoapify API Key:', apiKey ? 'Loaded' : 'MISSING!');
      if (!apiKey) {
        console.error("Geoapify API key not found. Please set NEXT_PUBLIC_GEOAPIFY_KEY environment variable.");
        setProfileError("Address lookup configuration error.");
        return;
      }

      const autocomplete = new GeocoderAutocomplete(
        autocompleteContainerRef.current,
        apiKey,
        {
          lang: 'en',
          filter: { countrycode: ['gb'] },
          placeholder: 'Start typing address...',
          skipIcons: true,
        }
      );

      autocomplete.on('select', (location) => {
        if (location && location.properties) {
          const props = location.properties;
          // Update editFields directly when an address is selected
          setEditFields(prev => ({
            ...prev,
            address_line_1: props.address_line1 || '',
            address_line_2: '', // DO NOT auto-populate line 2 from autocomplete
            town_or_city: props.city || '',
            county: props.county || '',
            postcode: props.postcode || '',
            country: props.country || '',
            latitude: props.lat || null,
            longitude: props.lon || null
          }));
        }
      });

      // Cleanup
      return () => {
        // autocomplete.remove(); // Method unclear, omitting for now
      };
    }
  }, [editProfile]); // Re-run when editProfile changes

  const startEdit = () => {
    if (!profile) return;
    // Initialize editFields from profile state (already done in fetchProfile, but good to ensure here too)
    setEditFields({
      first_name: profile.first_name || '',
      last_name: profile.last_name || '',
      phone: profile.phone || '',
      email_allow_promotional: profile.email_allow_promotional ?? true,
      email_allow_informational: profile.email_allow_informational ?? true,
      address_line_1: profile.address_line_1 || '',
      address_line_2: profile.address_line_2 || '',
      town_or_city: profile.town_or_city || '',
      county: profile.county || '',
      postcode: profile.postcode || '',
      country: profile.country || '',
      latitude: profile.latitude || null,
      longitude: profile.longitude || null
    });
    setEditProfile(true);
  };
  const cancelEdit = () => setEditProfile(false);
  const handleEditChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Handle checkboxes separately for boolean conversion
    const { name, value, type, checked } = e.target;
    setEditFields(f => ({
      ...f,
      [name]: type === 'checkbox' ? checked : value
    }));
  };
  const saveProfile = async () => {
    setIsSaving(true);
    setProfileError(null);
    try {
      const payload = {
        ...editFields,
        phone: editFields.phone.trim() === '' ? null : editFields.phone.trim(),
        address_line_1: editFields.address_line_1 || null,
        address_line_2: editFields.address_line_2 || null,
        town_or_city: editFields.town_or_city || null,
        county: editFields.county || null,
        postcode: editFields.postcode || null,
        country: editFields.country || null,
        latitude: editFields.latitude,
        longitude: editFields.longitude
      };
      console.log('[ClientDashboard] Saving profile payload:', payload);
      const res = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Failed to update profile');
      const data = await res.json();
      setProfile(data); // Update profile state with the response
      setEditProfile(false);
    } catch (e) {
      setProfileError(e instanceof Error ? e.message : 'Failed to update profile');
    } finally {
      setIsSaving(false);
    }
  };

  // Define tabs for the client dashboard
  const baseClientTabs = [
    {
      id: 'book',
      label: 'Book Services',
      content: (
        // Pass the fetched services and loading/error states
        <ClientBooking
            services={services}
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
              {/* Display Address Info */}
               <div style={{ marginTop: '1em', paddingTop: '1em', borderTop: '1px solid #555'}}>
                  <p><strong>Address:</strong></p>
                  {profile.address_line_1 ? (
                      <ul style={{ listStyle: 'none', paddingLeft: '1em' }}>
                          <li>{profile.address_line_1}</li>
                          {profile.address_line_2 && <li>{profile.address_line_2}</li>}
                          <li>{profile.town_or_city}{profile.county ? `, ${profile.county}` : ''}</li>
                          <li>{profile.postcode}</li>
                          <li>{profile.country}</li>
                      </ul>
                  ) : (
                      <p style={{ fontStyle: 'italic', color: '#aaa' }}>No address on file.</p>
                  )}
               </div>
              {/* Display Email Preferences */}
              <div style={{ marginTop: '1em', paddingTop: '1em', borderTop: '1px solid #555'}}>
                  <p><strong>Email Preferences:</strong></p>
                  <ul style={{ listStyle: 'none', paddingLeft: '1em' }}>
                      <li>Promotional Emails: {profile.email_allow_promotional ? 'Allowed' : 'Blocked'}</li>
                      <li>Informational Emails: {profile.email_allow_informational ? 'Allowed' : 'Blocked'}</li>
                  </ul>
              </div>
              <button onClick={startEdit} style={{ marginTop: '1em' }}>Edit</button>
            </div>
          ) : (
            <div style={{ background: '#222', color: '#fff', padding: 16, borderRadius: 8, maxWidth: 500 }}>
              {/* Existing Fields: First Name, Last Name, Phone */}
              <label>First Name:<br />
                <input name="first_name" value={editFields.first_name} onChange={handleEditChange} className="input" />
              </label><br />
              <label>Last Name:<br />
                <input name="last_name" value={editFields.last_name} onChange={handleEditChange} className="input" />
              </label><br />
              <label>Phone:<br />
                <input name="phone" value={editFields.phone} onChange={handleEditChange} className="input" />
              </label><br />

              {/* Address Autocomplete Section */}
              <div style={{ margin: '1em 0', borderTop: '1px solid #555', paddingTop: '1em' }}>
                <label htmlFor="addressAutocompleteClient" style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Find Address:</label>
                <div id="addressAutocompleteClient" ref={autocompleteContainerRef} style={{ marginBottom: '10px', width: '100%' }}>
                  {/* Geoapify input will be injected here */}
                </div>
                 <p style={{fontSize: '0.8em', color: '#aaa', margin: '0 0 10px 0'}}>Start typing above to populate the fields below.</p>
              </div>

              {/* Manual Address Fields */}
              <label>Address Line 1:<br />
                <input name="address_line_1" value={editFields.address_line_1} onChange={handleEditChange} className="input" />
              </label><br />
              <label>Address Line 2:<br />
                <input name="address_line_2" value={editFields.address_line_2} onChange={handleEditChange} className="input" />
              </label><br />
              <div style={{ display: 'flex', gap: '15px' }}>
                  <div style={{ flex: 1 }}>
                      <label>Town/City:<br />
                        <input name="town_or_city" value={editFields.town_or_city} onChange={handleEditChange} className="input" />
                      </label>
                  </div>
                  <div style={{ flex: 1 }}>
                      <label>County:<br />
                        <input name="county" value={editFields.county} onChange={handleEditChange} className="input" />
                      </label>
                  </div>
              </div>
              <div style={{ display: 'flex', gap: '15px' }}>
                  <div style={{ flex: 1 }}>
                      <label>Postcode:<br />
                         <input name="postcode" value={editFields.postcode} onChange={handleEditChange} className="input" />
                      </label>
                  </div>
                  <div style={{ flex: 1 }}>
                      <label>Country:<br />
                         <input name="country" value={editFields.country} onChange={handleEditChange} readOnly className="input readonly" />
                      </label>
                  </div>
              </div>
              {/* Display Lat/Lon for verification (optional) */}
               {editFields.latitude && editFields.longitude && (
                   <p style={{ fontSize: '0.8em', color: '#aaa', marginTop: '5px'}}>
                       Coordinates: {editFields.latitude.toFixed(6)}, {editFields.longitude.toFixed(6)}
                   </p>
               )}

              {/* Email Preference Checkboxes */}
              <div style={{ marginTop: '1em', paddingTop: '1em', borderTop: '1px solid #555' }}>
                <label style={{ display: 'block', marginBottom: '0.5em' }}>
                  <input
                    type="checkbox"
                    name="email_allow_promotional"
                    checked={editFields.email_allow_promotional}
                    onChange={handleEditChange}
                    style={{ marginRight: '8px' }}
                  />
                  Allow Promotional Emails (e.g., special offers)
                </label>
                <label style={{ display: 'block' }}>
                  <input
                    type="checkbox"
                    name="email_allow_informational"
                    checked={editFields.email_allow_informational}
                    onChange={handleEditChange}
                    style={{ marginRight: '8px' }}
                  />
                  Allow Informational Emails (e.g., policy updates, tips - excludes booking confirmations)
                </label>
              </div>
              <button onClick={saveProfile} disabled={isSaving} className="button primary" style={{ marginRight: 8, marginTop: '1em' }}>Save</button>
              <button onClick={cancelEdit} disabled={isSaving} className="button secondary" style={{ marginTop: '1em' }}>Cancel</button>
            </div>
          )}
        </div>
      ),
    },
  ];

  // Filter tabs based on businessType
  const clientTabs = baseClientTabs.filter(tab => {
    if (tab.id === 'pets' && businessType === 'Field Hire') {
      return false; // Hide 'My Pets' for Field Hire
    }
    return true; // Show all other tabs
  });

  return (
    <>
      <h2>Client Dashboard</h2>
      <p>Welcome to your portal. Book services, manage your pets, and view your appointments.</p>
      <SidebarNavigation tabs={clientTabs} />
    </>
  );
}