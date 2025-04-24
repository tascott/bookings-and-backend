'use client';

import React from 'react';
import TabNavigation from '@/components/TabNavigation';
import BookingManagement from '@/components/admin/BookingManagement';
import styles from '@/app/page.module.css';
import type { User } from '@supabase/supabase-js';
import { Site, Field, Booking, Service } from '@/types';

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
  addBookingFormRef: React.RefObject<HTMLFormElement>;
  getFieldsForSite: (siteId: number) => Field[];
  fetchBookings: () => Promise<void>;
  // Shared
  error: string | null;
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
}: StaffDashboardProps) {

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
  ];

  return (
    <div className={styles.roleTabsContent}>
      <h2>Staff Dashboard</h2>
      <p>View your schedule and manage your assigned bookings.</p>
      <TabNavigation tabs={staffTabs} />
    </div>
  );
}