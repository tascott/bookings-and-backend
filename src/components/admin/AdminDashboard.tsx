'use client';

import React from 'react';
import TabNavigation from '@/components/TabNavigation';
import UserManagement from './UserManagement';
import SiteFieldManagement from './SiteFieldManagement';
import BookingManagement from './BookingManagement';
import ServiceManagement from './ServiceManagement';
import ServiceAvailabilityManagement from './ServiceAvailabilityManagement';
import ClientManagement from './ClientManagement';
import VehicleManagement from './VehicleManagement';
import styles from '@/app/page.module.css';
import type { User } from '@supabase/supabase-js';
import { UserWithRole, Site, Field, Booking, Service, ServiceAvailability, Vehicle, Staff } from '@/types';

// Define props for the admin dashboard
interface AdminDashboardProps {
  user: User;
  // User management
  users: UserWithRole[];
  isLoadingUsers: boolean;
  updatingUserId: string | null;
  handleAssignRole: (userId: string, targetRole: 'client' | 'staff' | 'admin') => Promise<void>;
  // Site and field management
  sites: Site[];
  fields: Field[];
  isLoadingSites: boolean;
  isLoadingFields: boolean;
  handleAddSite: (event: React.FormEvent<HTMLFormElement>) => Promise<void>;
  handleAddField: (event: React.FormEvent<HTMLFormElement>) => Promise<void>;
  getFieldsForSite: (siteId: number) => Field[];
  addSiteFormRef: React.RefObject<HTMLFormElement | null>;
  // Booking management
  bookings: Booking[];
  isLoadingBookings: boolean;
  handleAddBooking: (event: React.FormEvent<HTMLFormElement>) => Promise<void>;
  addBookingFormRef: React.RefObject<HTMLFormElement | null>;
  fetchBookings: () => Promise<void>;
  // Service management
  services: Service[];
  isLoadingServices: boolean;
  handleAddService: (event: React.FormEvent<HTMLFormElement>) => Promise<void>;
  addServiceFormRef: React.RefObject<HTMLFormElement | null>;
  // Service availability
  serviceAvailability: ServiceAvailability[];
  isLoadingServiceAvailability: boolean;
  handleAddServiceAvailability: (event: React.FormEvent<HTMLFormElement>) => Promise<void>;
  handleToggleServiceAvailabilityActive: (ruleId: number, currentStatus: boolean) => Promise<void>;
  addServiceAvailabilityFormRef: React.RefObject<HTMLFormElement | null>;
  // Shared
  error: string | null;
  // Add vehicle management props
  vehicles: Vehicle[];
  staff: Staff[];
  isLoadingVehicles: boolean;
  vehicleError: string | null;
  handleAddVehicle: (vehicle: Partial<Vehicle>) => Promise<void>;
  handleDeleteVehicle: (id: number) => Promise<void>;
}

export default function AdminDashboard({
  user,
  users,
  isLoadingUsers,
  updatingUserId,
  handleAssignRole,
  sites,
  fields,
  isLoadingSites,
  isLoadingFields,
  handleAddSite,
  handleAddField,
  getFieldsForSite,
  addSiteFormRef,
  bookings,
  isLoadingBookings,
  handleAddBooking,
  addBookingFormRef,
  fetchBookings,
  services,
  isLoadingServices,
  handleAddService,
  addServiceFormRef,
  serviceAvailability,
  isLoadingServiceAvailability,
  handleAddServiceAvailability,
  handleToggleServiceAvailabilityActive,
  addServiceAvailabilityFormRef,
  error,
  vehicles,
  staff,
  isLoadingVehicles,
  vehicleError,
  handleAddVehicle,
  handleDeleteVehicle,
}: AdminDashboardProps) {

  // Define tabs for the admin dashboard
  const adminTabs = [
    {
      id: 'users',
      label: 'User Management',
      content: (
        <UserManagement
          users={users}
          isLoadingUsers={isLoadingUsers}
          error={error}
          currentUser={user}
          updatingUserId={updatingUserId}
          handleAssignRole={handleAssignRole}
        />
      ),
    },
    {
      id: 'sites',
      label: 'Sites & Fields',
      content: (
        <SiteFieldManagement
          sites={sites}
          fields={fields}
          isLoadingSites={isLoadingSites}
          isLoadingFields={isLoadingFields}
          error={error}
          handleAddSite={handleAddSite}
          handleAddField={handleAddField}
          getFieldsForSite={getFieldsForSite}
          addSiteFormRef={addSiteFormRef}
        />
      ),
    },
    {
      id: 'bookings',
      label: 'Bookings',
      content: (
        <BookingManagement
          role="admin"
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
      id: 'services',
      label: 'Services',
      content: (
        <ServiceManagement
          services={services}
          isLoadingServices={isLoadingServices}
          error={error}
          handleAddService={handleAddService}
          addServiceFormRef={addServiceFormRef}
        />
      ),
    },
    {
      id: 'availability',
      label: 'Service Availability',
      content: (
        <ServiceAvailabilityManagement
          serviceAvailability={serviceAvailability}
          isLoadingServiceAvailability={isLoadingServiceAvailability}
          services={services}
          sites={sites}
          fields={fields}
          error={error}
          handleAddServiceAvailability={handleAddServiceAvailability}
          handleToggleServiceAvailabilityActive={handleToggleServiceAvailabilityActive}
          addServiceAvailabilityFormRef={addServiceAvailabilityFormRef}
          getFieldsForSite={getFieldsForSite}
        />
      ),
    },
    {
      id: 'clients',
      label: 'Client Management',
      content: (
        <ClientManagement />
      ),
    },
    {
      id: 'vehicles',
      label: 'Vehicles',
      content: (
        <VehicleManagement
          vehicles={vehicles}
          staff={staff}
          isLoading={isLoadingVehicles}
          error={vehicleError}
          onAdd={handleAddVehicle}
          onDelete={handleDeleteVehicle}
        />
      ),
    },
  ];

  return (
    <div className={styles.roleTabsContent}>
      <h2>Admin Dashboard</h2>
      <p>Manage your business operations from this central hub.</p>
      <TabNavigation tabs={adminTabs} />
    </div>
  );
}