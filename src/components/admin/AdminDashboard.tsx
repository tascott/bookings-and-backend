'use client';

import React from 'react';
import SidebarNavigation from '@/components/SidebarNavigation';
import UserManagement from './UserManagement';
import SiteFieldManagement from './SiteFieldManagement';
import BookingManagement from './BookingManagement';
import ServiceManagement from './ServiceManagement';
import ServiceAvailabilityManagement from './ServiceAvailabilityManagement';
import ClientManagement from './ClientManagement';
import VehicleManagement from './VehicleManagement';
import StaffAvailabilityManagement from './StaffAvailabilityManagement';
import type { User } from '@supabase/supabase-js';
import { UserWithRole, Site, Field, Booking, Service, ServiceAvailability, Vehicle, StaffMemberListItem } from '@/types';

// Define props for the admin dashboard
interface AdminDashboardProps {
  user: User;
  // User management
  users: UserWithRole[];
  staff: StaffMemberListItem[];
  isLoadingUsers: boolean;
  updatingUserId: string | null;
  handleAssignRole: (userId: string, role: string) => Promise<void>;
  fetchAllUsers: () => Promise<void>;
  handleAssignDefaultVehicle: (staffId: number, vehicleId: number | null) => Promise<void>;
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
  // Add paid status toggle handler
  handleToggleBookingPaidStatus: (bookingId: number, currentStatus: boolean) => Promise<void>;
  // Service management
  services: Service[];
  isLoadingServices: boolean;
  handleAddService: (event: React.FormEvent<HTMLFormElement>) => Promise<void>;
  addServiceFormRef: React.RefObject<HTMLFormElement | null>;
  // Add service update/delete handlers
  handleUpdateService: (serviceId: number, updatedData: Partial<Service>) => Promise<void>;
  handleDeleteService: (serviceId: number) => Promise<void>;
  // Service availability
  serviceAvailability: ServiceAvailability[];
  isLoadingServiceAvailability: boolean;
  handleAddServiceAvailability: (event: React.FormEvent<HTMLFormElement>) => Promise<void>;
  handleToggleServiceAvailabilityActive: (id: number, isActive: boolean) => Promise<void>;
  addServiceAvailabilityFormRef: React.RefObject<HTMLFormElement | null>;
  // Add availability update/delete handlers
  handleUpdateServiceAvailability: (id: number, updatedData: Partial<ServiceAvailability>) => Promise<void>;
  handleDeleteServiceAvailability: (id: number) => Promise<void>;
  // Shared
  error: string | null;
  // Vehicle management props (vehicles needed for dropdown in user mgmt)
  vehicles: Vehicle[];
  isLoadingVehicles: boolean;
  vehicleError: string | null;
  handleAddVehicle: (vehicle: Partial<Vehicle>) => Promise<void>;
  handleDeleteVehicle: (vehicleId: number) => Promise<void>;
  handleUpdateVehicle: (vehicleId: number, updates: Partial<Vehicle>) => Promise<void>;
}

export default function AdminDashboard({
  user,
  users,
  staff,
  isLoadingUsers,
  updatingUserId,
  handleAssignRole,
  fetchAllUsers,
  handleAssignDefaultVehicle,
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
  handleToggleBookingPaidStatus,
  services,
  isLoadingServices,
  handleAddService,
  addServiceFormRef,
  handleUpdateService,
  handleDeleteService,
  serviceAvailability,
  isLoadingServiceAvailability,
  handleAddServiceAvailability,
  handleToggleServiceAvailabilityActive,
  addServiceAvailabilityFormRef,
  handleUpdateServiceAvailability,
  handleDeleteServiceAvailability,
  error,
  vehicles,
  isLoadingVehicles,
  vehicleError,
  handleAddVehicle,
  handleDeleteVehicle,
  handleUpdateVehicle,
}: AdminDashboardProps) {

  // Define tabs for the admin dashboard
  const adminTabs = [
    {
      id: 'users',
      label: 'User Management',
      content: (
        <UserManagement
          users={users}
          staff={staff}
          vehicles={vehicles}
          handleAssignDefaultVehicle={handleAssignDefaultVehicle}
          isLoadingUsers={isLoadingUsers}
          error={error}
          currentUser={user}
          updatingUserId={updatingUserId}
          handleAssignRole={handleAssignRole}
          onUserUpdated={fetchAllUsers}
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
      id: 'services',
      label: 'Services',
      content: (
        <ServiceManagement
          services={services}
          isLoadingServices={isLoadingServices}
          error={error}
          handleAddService={handleAddService}
          addServiceFormRef={addServiceFormRef}
          handleUpdateService={handleUpdateService}
          handleDeleteService={handleDeleteService}
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
          handleUpdateServiceAvailability={handleUpdateServiceAvailability}
          handleDeleteServiceAvailability={handleDeleteServiceAvailability}
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
          services={services}
          error={error}
          refetchBookings={fetchBookings}
          handleToggleBookingPaidStatus={handleToggleBookingPaidStatus}
        />
      ),
    },
    {
      id: 'vehicles',
      label: 'Vehicles',
      content: (
        <VehicleManagement
          vehicles={vehicles}
          isLoading={isLoadingVehicles}
          error={vehicleError}
          onAdd={handleAddVehicle}
          onDelete={handleDeleteVehicle}
          onUpdate={handleUpdateVehicle}
        />
      ),
    },
    {
      id: 'staff_availability',
      label: 'Staff Availability',
      content: (
        <StaffAvailabilityManagement />
      ),
    },
  ];

  return (
    <>
      <h2>Admin Dashboard</h2>
      <p>Manage your business operations from this central hub.</p>
      <SidebarNavigation tabs={adminTabs} />
    </>
  );
}