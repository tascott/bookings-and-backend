'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import SidebarNavigation from '@/components/SidebarNavigation';
import ClientBooking from '@/components/client/ClientBooking';
import PetManagement from '@/components/client/PetManagement';
import MyBookings from '@/components/client/MyBookings';
// import type { User } from '@supabase/supabase-js'; // User prop might be unused now
import { Service, Profile as ProfileType, UserWithRole } from '@booking-and-accounts-monorepo/shared-types';
import { GeocoderAutocomplete } from '@geoapify/geocoder-autocomplete';
import '@geoapify/geocoder-autocomplete/styles/minimal-dark.css';
import { fetchUserProfile, updateUserProfile } from '@booking-and-accounts-monorepo/api-services';
import { fetchServices } from '@booking-and-accounts-monorepo/api-services';
import { createClient } from '@booking-and-accounts-monorepo/utils';

interface ClientDashboardProps {
  // user: User; // Removing user prop as profile state should contain necessary user info
  businessType?: string | null;
}

// ProfileData interface removed as it is unused.

export default function ClientDashboard({
  // user, // user prop removed
  businessType,
}: ClientDashboardProps) {
  const [profile, setProfile] = useState<UserWithRole | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [editProfile, setEditProfile] = useState(false);
  const [editFields, setEditFields] = useState<Partial<ProfileType>>({
    user_id: '',
    first_name: '',
    last_name: '',
    phone: '',
    email_allow_promotional: true,
    email_allow_informational: true,
    address_line_1: '',
    address_line_2: '',
    town_or_city: '',
    county: '',
    postcode: '',
    country: '',
    latitude: null,
    longitude: null
  });
  const [isSaving, setIsSaving] = useState(false);
  const autocompleteContainerRef = useRef<HTMLDivElement>(null);
  const [services, setServices] = useState<Service[]>([]);

  useEffect(() => {
    const loadProfile = async () => {
      setProfileLoading(true);
      setProfileError(null);
      try {
        const data = await fetchUserProfile();
        setProfile(data);
        setEditFields({
            user_id: data.id,
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
    loadProfile();
  }, []);

  const supabase = createClient(); // Create Supabase client

  const loadServices = useCallback(async () => {
    try {
      const data = await fetchServices(supabase, { active: true });
      setServices(data);
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : 'Failed to load services';
      console.error("Error fetching services:", errorMessage);
      setServices([]);
    }
  }, [supabase]);

  useEffect(() => {
    loadServices();
  }, [loadServices]);

  useEffect(() => {
    if (editProfile && autocompleteContainerRef.current) {
      const apiKey = process.env.NEXT_PUBLIC_GEOAPIFY_KEY;
      if (!apiKey) {
        console.error("Geoapify API key not found.");
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
          setEditFields(prev => ({
            ...prev,
            address_line_1: props.address_line1 || '',
            address_line_2: '',
            town_or_city: props.city || '',
            county: props.county || '',
            postcode: props.postcode || '',
            country: props.country || '',
            latitude: props.lat || null,
            longitude: props.lon || null
          }));
        }
      });
    }
  }, [editProfile]);

  const startEdit = () => {
    if (!profile) return;
    setEditFields({
      user_id: profile.id,
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
      if (!profile?.id) {
        throw new Error("User ID is missing, cannot update profile.");
      }
      const payload: Partial<ProfileType> = {
        user_id: profile.id,
        first_name: editFields.first_name || null,
        last_name: editFields.last_name || null,
        phone: editFields.phone?.trim() === '' ? null : editFields.phone?.trim(),
        email_allow_promotional: editFields.email_allow_promotional,
        email_allow_informational: editFields.email_allow_informational,
        address_line_1: editFields.address_line_1 || null,
        address_line_2: editFields.address_line_2 || null,
        town_or_city: editFields.town_or_city || null,
        county: editFields.county || null,
        postcode: editFields.postcode || null,
        country: editFields.country || null,
        latitude: editFields.latitude,
        longitude: editFields.longitude
      };
      const updatedProfileData = await updateUserProfile(payload);

      setProfile(prevProfile => {
        if (!prevProfile) return null;
        return {
          ...prevProfile,
          first_name: updatedProfileData.first_name,
          last_name: updatedProfileData.last_name,
          phone: updatedProfileData.phone,
          email_allow_promotional: updatedProfileData.email_allow_promotional,
          email_allow_informational: updatedProfileData.email_allow_informational,
          address_line_1: updatedProfileData.address_line_1,
          address_line_2: updatedProfileData.address_line_2,
          town_or_city: updatedProfileData.town_or_city,
          county: updatedProfileData.county,
          postcode: updatedProfileData.postcode,
          country: updatedProfileData.country,
          latitude: updatedProfileData.latitude,
          longitude: updatedProfileData.longitude,
        };
      });
      setEditProfile(false);
    } catch (e) {
      setProfileError(e instanceof Error ? e.message : 'Failed to update profile');
    } finally {
      setIsSaving(false);
    }
  };

  const baseClientTabs = [
    {
      id: 'book',
      label: 'Book Services',
      content: (
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
      content: <PetManagement />,
    },
  ];

  const filteredClientTabs = baseClientTabs.filter(tab => {
    if (tab.id === 'pets' && businessType === 'Field Hire') {
      return false;
    }
    return true;
  });

  const settingsTab = {
    id: 'settings',
    label: 'Settings',
    content: (
      <div className="space-y-6">
        <h2 className="text-2xl font-semibold">Profile Settings</h2>
        {profileLoading && <p>Loading profile...</p>}
        {profileError && <p className="text-red-500">Error: {profileError}</p>}
        {profile && !editProfile && (
          <div className="space-y-4">
            <p><strong>Name:</strong> {profile.first_name} {profile.last_name}</p>
            <p><strong>Email:</strong> {profile.email}</p>
            <p><strong>Phone:</strong> {profile.phone || 'Not set'}</p>
            <p><strong>Address:</strong></p>
            <address className="not-italic">
              {profile.address_line_1 && <>{profile.address_line_1}<br /></>}
              {profile.address_line_2 && <>{profile.address_line_2}<br /></>}
              {profile.town_or_city && <>{profile.town_or_city}<br /></>}
              {profile.county && <>{profile.county}<br /></>}
              {profile.postcode && <>{profile.postcode}<br /></>}
              {profile.country && <>{profile.country}<br /></>}
            </address>
            <p><strong>Promotional Emails:</strong> {profile.email_allow_promotional ? 'Subscribed' : 'Unsubscribed'}</p>
            <p><strong>Informational Emails:</strong> {profile.email_allow_informational ? 'Subscribed' : 'Unsubscribed'}</p>
            <button onClick={startEdit} className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">Edit Profile</button>
          </div>
        )}
        {editProfile && (
          <div className="space-y-4">
            <div>
              <label htmlFor="first_name" className="block text-sm font-medium">First Name</label>
              <input type="text" name="first_name" id="first_name" value={editFields.first_name || ''} onChange={handleEditChange} className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm" />
            </div>
            <div>
              <label htmlFor="last_name" className="block text-sm font-medium">Last Name</label>
              <input type="text" name="last_name" id="last_name" value={editFields.last_name || ''} onChange={handleEditChange} className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm" />
            </div>
            <div>
              <label htmlFor="phone" className="block text-sm font-medium">Phone</label>
              <input type="text" name="phone" id="phone" value={editFields.phone || ''} onChange={handleEditChange} className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm" />
            </div>

            <div ref={autocompleteContainerRef} className="mb-4"></div>

            <div>
              <label htmlFor="address_line_1" className="block text-sm font-medium">Address Line 1</label>
              <input type="text" name="address_line_1" id="address_line_1" value={editFields.address_line_1 || ''} onChange={handleEditChange} className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm" />
            </div>
            <div>
              <label htmlFor="address_line_2" className="block text-sm font-medium">Address Line 2</label>
              <input type="text" name="address_line_2" id="address_line_2" value={editFields.address_line_2 || ''} onChange={handleEditChange} className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm" />
            </div>
            <div>
              <label htmlFor="town_or_city" className="block text-sm font-medium">Town/City</label>
              <input type="text" name="town_or_city" id="town_or_city" value={editFields.town_or_city || ''} onChange={handleEditChange} className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm" />
            </div>
            <div>
              <label htmlFor="county" className="block text-sm font-medium">County</label>
              <input type="text" name="county" id="county" value={editFields.county || ''} onChange={handleEditChange} className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm" />
            </div>
            <div>
              <label htmlFor="postcode" className="block text-sm font-medium">Postcode</label>
              <input type="text" name="postcode" id="postcode" value={editFields.postcode || ''} onChange={handleEditChange} className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm" />
            </div>
            <div>
              <label htmlFor="country" className="block text-sm font-medium">Country</label>
              <input type="text" name="country" id="country" value={editFields.country || ''} onChange={handleEditChange} className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm" />
            </div>

            <div className="flex items-center">
              <input type="checkbox" name="email_allow_promotional" id="email_allow_promotional" checked={editFields.email_allow_promotional ?? true} onChange={handleEditChange} className="h-4 w-4 text-blue-600 border-gray-300 rounded" />
              <label htmlFor="email_allow_promotional" className="ml-2 block text-sm">Receive promotional emails</label>
            </div>
            <div className="flex items-center">
              <input type="checkbox" name="email_allow_informational" id="email_allow_informational" checked={editFields.email_allow_informational ?? true} onChange={handleEditChange} className="h-4 w-4 text-blue-600 border-gray-300 rounded" />
              <label htmlFor="email_allow_informational" className="ml-2 block text-sm">Receive informational emails</label>
            </div>
            <div className="flex space-x-2">
              <button onClick={saveProfile} disabled={isSaving} className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50">
                {isSaving ? 'Saving...' : 'Save Profile'}
              </button>
              <button onClick={cancelEdit} className="px-4 py-2 bg-gray-300 rounded hover:bg-gray-400">Cancel</button>
            </div>
          </div>
        )}
      </div>
    ),
  };

  const finalClientTabs = [...filteredClientTabs, settingsTab]; // Corrected tab building

  return (
    <div className="flex h-screen bg-gray-100">
      <SidebarNavigation tabs={finalClientTabs} /> {/* Removed initialTabId */}
      {/* Main content will be rendered by SidebarNavigation based on active tab */}
    </div>
  );
}