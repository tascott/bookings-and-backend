'use client';

import React from 'react';
import TabNavigation from '@/components/TabNavigation';
import ClientBooking from '@/components/client/ClientBooking';
import PetManagement from '@/components/client/PetManagement';
import MyBookings from '@/components/client/MyBookings';
import styles from '@/app/page.module.css';
import type { User } from '@supabase/supabase-js';
import { Service } from '@/types';

// Define props for the client dashboard
interface ClientDashboardProps {
  user: User;
  // Services for booking
  services: Service[];
  // Any other props needed for client components
}

export default function ClientDashboard({
  user,
  services,
}: ClientDashboardProps) {

  // Define tabs for the client dashboard
  const clientTabs = [
    {
      id: 'book',
      label: 'Book Services',
      content: (
        <ClientBooking services={services} />
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
          <h3>My Account</h3>
          <p>View and update your account information.</p>
          <div>
            <p><strong>Email:</strong> {user.email}</p>
            {/* Client account information component will be implemented here */}
          </div>
        </div>
      ),
    },
  ];

  return (
    <div className={styles.roleTabsContent}>
      <h2>Client Dashboard</h2>
      <p>Welcome to your doggy daycare portal. Book services, manage your pets, and view your appointments.</p>
      <TabNavigation tabs={clientTabs} />
    </div>
  );
}