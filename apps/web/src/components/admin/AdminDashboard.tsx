'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import SidebarNavigation from '@/components/SidebarNavigation';
import UserManagement from './UserManagement';
import SiteFieldManagement from './SiteFieldManagement';
import BookingManagement from './BookingManagement';
import ServiceManagement from './ServiceManagement';
import ServiceAvailabilityManagement from './ServiceAvailabilityManagement';
import ClientManagement from './ClientManagement';
import VehicleManagement from './VehicleManagement';
import StaffAvailabilityManagement from './StaffAvailabilityManagement';
import EmailManagement from './EmailManagement';
import { createClient } from '@booking-and-accounts-monorepo/utils';
// import type { User } from '@supabase/supabase-js'; // Removed unused User import
import type {
	UserWithRole, Site, Field, Booking, Service, ServiceAvailability, Vehicle,
	StaffMemberListItem, Staff, UpdateServicePayload, // Removed AddServicePayload
	UpdateFieldPayload, AddFieldPayload, AddSitePayload,
	AddServiceAvailabilityPayload, UpdateServiceAvailabilityPayload, // Added these
	// Client, Pet, UpdateClientPayload, AddPetPayload, UpdatePetPayload, // Removed unused types
	// AddStaffAvailabilityRulePayload, UpdateStaffAvailabilityRulePayload, // Removing unused
	// AddVehiclePayload, UpdateVehiclePayload, // Removing unused
	// UpdateSitePayload, // Removing unused
} from '@booking-and-accounts-monorepo/shared-types';
import {
	fetchServices as fetchServicesApi,
	// fetchServiceAvailabilities as fetchServiceAvailabilitiesApi, // Removed unused
	addService as addServiceApi,
	updateService as updateServiceApi,
	deleteService as deleteServiceApi,
	addServiceAvailability as addServiceAvailabilityApi, // Added this
	updateServiceAvailability as updateServiceAvailabilityApi, // Added this
	deleteServiceAvailability as deleteServiceAvailabilityApi, // Added this
	// fetchServiceAvailabilities as fetchServiceAvailability, // Removing unused alias
	// deleteServiceAvailability as deleteServiceAvailabilityRule // Removing unused alias
} from '@booking-and-accounts-monorepo/api-services';
// import { fetchBookings as fetchBookingsApi, updateBookingStatus } from '@booking-and-accounts-monorepo/api-services'; // Corrected path, but fetchBookingsApi is unused
import { updateBookingStatus } from '@booking-and-accounts-monorepo/api-services';
import {
	fetchAllUsers as fetchAllUsersApi,
	assignUserRole as assignUserRoleApi,
	assignStaffDefaultVehicle as assignStaffVehicleApi
} from '@booking-and-accounts-monorepo/api-services';
import {
	fetchSites as fetchSitesApi,
	fetchFields as fetchFieldsApi,
	addSite as addSiteApi,
	addField as addFieldApi,
	updateField as updateFieldApi, // Added this
	deleteField as deleteFieldApi, // Added this
	// updateSite as updateSiteApi, // Removing unused import
	// deleteSite as deleteSiteApi, // Removing unused import
} from '@booking-and-accounts-monorepo/api-services';
import {
	fetchVehicles as fetchVehiclesApi,
	addVehicle as addVehicleApi,
	deleteVehicle as deleteVehicleApi,
	updateVehicle as updateVehicleApi
} from '@booking-and-accounts-monorepo/api-services';

// Remove empty AdminDashboardProps interface
// interface AdminDashboardProps {
// 	// user: User; // Removed user prop
// 	// REMOVED ALL OTHER PROPS
// }

export default function AdminDashboard(/* Removed props */) {
	const supabase = createClient();

	// === State Hooks ===
	const [users, setUsers] = useState<UserWithRole[]>([]);
	const [staff, setStaff] = useState<Staff[]>([]);
	const [isLoadingUsers, setIsLoadingUsers] = useState(false);
	const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);

	const [sites, setSites] = useState<Site[]>([]);
	const [fields, setFields] = useState<Field[]>([]);
	const [isLoadingSites, setIsLoadingSites] = useState(false);
	const [isLoadingFields, setIsLoadingFields] = useState(false);

	const [bookings, setBookings] = useState<Booking[]>([]);
	const [isLoadingBookings, setIsLoadingBookings] = useState(false);

	const [services, setServices] = useState<Service[]>([]);
	const [isLoadingServices, setIsLoadingServices] = useState(false);

	const [serviceAvailability, setServiceAvailability] = useState<ServiceAvailability[]>([]);
	const [isLoadingServiceAvailability, setIsLoadingServiceAvailability] = useState(false);

	const [vehicles, setVehicles] = useState<Vehicle[]>([]);
	const [isLoadingVehicles, setIsLoadingVehicles] = useState(false);
	const [vehicleError, setVehicleError] = useState<string | null>(null);

	// Shared error state (could be split further if needed)
	const [error, setError] = useState<string | null>(null);
	// Add state for success messages
	const [successMessage, setSuccessMessage] = useState<string | null>(null);

	// Refs for forms (needed for resetting after adds)
	const addSiteFormRef = useRef<HTMLFormElement>(null);
	const addServiceFormRef = useRef<HTMLFormElement>(null);
	const addServiceAvailabilityFormRef = useRef<HTMLFormElement>(null);

	// === Fetching Functions ===

	const fetchAllUsers = useCallback(async () => {
		setIsLoadingUsers(true);
		setError(null);
		setSuccessMessage(null); // Clear success message on new fetch
		try {
			const data = await fetchAllUsersApi();
			setUsers(data);
		} catch (e) {
			const errorMessage = e instanceof Error ? e.message : 'An unknown error occurred.';
			console.error('Failed to fetch users:', e);
			setError(`Failed to fetch users: ${errorMessage}`);
			setUsers([]);
		} finally {
			setIsLoadingUsers(false);
		}
	}, []);

	const fetchStaff = useCallback(async () => {
		setStaff([]);
		try {
			const { data, error: dbError } = await supabase.from('staff').select(`
          id,
          user_id,
          role,
          default_vehicle_id,
          profiles ( first_name, last_name )
        `);

			if (dbError) throw dbError;

			const formattedStaff: Staff[] = (data || []).map((s: StaffMemberListItem) => ({
				id: s.id,
				user_id: s.user_id,
				role: s.role,
				default_vehicle_id: s.default_vehicle_id,
				profile: s.profile ? { first_name: s.profile.first_name, last_name: s.profile.last_name } : null,
			}));
			setStaff(formattedStaff);
		} catch (e) {
			const errorMessage = e instanceof Error ? e.message : 'Failed to load staff list.';
			console.error('Error fetching staff list:', e);
			setError(`Error fetching staff list: ${errorMessage}`);
			setStaff([]);
		}
	}, [supabase]);

	const fetchSites = useCallback(async () => {
		setIsLoadingSites(true);
		setError(null);
		try {
			const data = await fetchSitesApi();
			setSites(data);
		} catch (e) {
			setError(e instanceof Error ? e.message : 'Failed to load sites');
			setSites([]);
		} finally {
			setIsLoadingSites(false);
		}
	}, []);

	const fetchFields = useCallback(async () => {
		setIsLoadingFields(true);
		setError(null);
		try {
			const data = await fetchFieldsApi();
			setFields(data);
		} catch (e) {
			setError(e instanceof Error ? e.message : 'Failed to load fields');
			setFields([]);
		} finally {
			setIsLoadingFields(false);
		}
	}, []);

	const fetchBookings = useCallback(async () => {
		setIsLoadingBookings(true);
		setError(null);
		try {
			const response = await fetch('/api/bookings');
			if (!response.ok) throw new Error('Failed to fetch bookings');
			const data: Booking[] = await response.json();
			setBookings(data);
		} catch (e) {
			setError(e instanceof Error ? e.message : 'Failed to load bookings');
			setBookings([]);
		} finally {
			setIsLoadingBookings(false);
		}
	}, []);

	const fetchServices = useCallback(async () => {
		setIsLoadingServices(true);
		setError(null);
		try {
			const data = await fetchServicesApi();
			setServices(data);
		} catch (e) {
			setError(e instanceof Error ? e.message : 'Failed to load services');
			setServices([]);
		} finally {
			setIsLoadingServices(false);
		}
	}, []);

	const fetchServiceAvailability = useCallback(async () => {
		setIsLoadingServiceAvailability(true);
		setError(null);
		try {
			const response = await fetch('/api/service-availability');
			if (!response.ok) throw new Error('Failed to fetch service availability');
			const data: ServiceAvailability[] = await response.json();
			setServiceAvailability(data);
		} catch (e) {
			setError(e instanceof Error ? e.message : 'Failed to load service availability');
			setServiceAvailability([]);
		} finally {
			setIsLoadingServiceAvailability(false);
		}
	}, []);

	const fetchVehicles = useCallback(async () => {
		setIsLoadingVehicles(true);
		setVehicleError(null);
		try {
			const data = await fetchVehiclesApi();
			setVehicles(data);
		} catch (e) {
			const msg = e instanceof Error ? e.message : 'Failed to load vehicles';
			setVehicleError(msg);
			setError(`Vehicle Loading Error: ${msg}`);
			setVehicles([]);
		} finally {
			setIsLoadingVehicles(false);
		}
	}, []);

	// === Initial Data Fetching Effect ===
	useEffect(() => {
		fetchAllUsers();
		fetchStaff();
		fetchSites();
		fetchFields();
		fetchBookings();
		fetchServices();
		fetchServiceAvailability();
		fetchVehicles();
	}, [fetchAllUsers, fetchStaff, fetchSites, fetchFields, fetchBookings, fetchServices, fetchServiceAvailability, fetchVehicles]);

	// === Action Handlers ===

	const handleAssignRole = useCallback(
		async (userId: string, targetRole: string) => {
			// Removed check for user.id === userId as user prop is removed
			// The API itself should perform necessary authorization checks
			// if (!user || user.id === userId) {
			// 	setError('Permission denied or cannot change own role.');
			// 	return;
			// }
			setUpdatingUserId(userId);
			setError(null);
			setSuccessMessage(null); // Clear messages
			try {
				await assignUserRoleApi(userId, targetRole);
				await fetchAllUsers();
			} catch (e) {
				const errorMessage = e instanceof Error ? e.message : 'An unknown error occurred.';
				console.error('Role assignment failed:', e);
				setError(errorMessage);
				setSuccessMessage(null); // Clear success message on error
			} finally {
				setUpdatingUserId(null);
			}
		},
		[fetchAllUsers, assignUserRoleApi]
	);

	const handleAssignDefaultVehicle = useCallback(async (staffId: number, vehicleId: number | null) => {
		setError(null);
		setSuccessMessage(null); // Clear messages
		try {
			await assignStaffVehicleApi(staffId, vehicleId);
			setStaff((prevStaff) => prevStaff.map((s) => (s.id === staffId ? { ...s, default_vehicle_id: vehicleId } : s)));
		} catch (e) {
			const message = e instanceof Error ? e.message : 'Unknown error assigning vehicle';
			console.error('Error assigning default vehicle:', message);
			setError(message);
			setSuccessMessage(null); // Clear success message on error
		}
	}, []);

	const handleAddSite = useCallback(async (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		setError(null);
		setSuccessMessage(null);
		const formData = new FormData(event.currentTarget);
		const payload: AddSitePayload = {
			name: formData.get('name') as string,
			address: formData.get('address') as string || null,
		};
		if (!payload.name) {
			setError('Site name is required.');
			return;
		}
		try {
			const newSite = await addSiteApi(payload);
			setSites(prev => [...prev, newSite].sort((a,b) => a.name.localeCompare(b.name)));
			setSuccessMessage('Site added successfully!');
			addSiteFormRef.current?.reset();
		} catch (e: unknown) {
			const errorMessage = e instanceof Error ? e.message : 'An unknown error occurred.';
			console.error('Failed to add site:', e);
			setError(`Failed to add site: ${errorMessage}`);
		}
	}, []);

	const handleAddField = useCallback(async (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		setError(null);
		setSuccessMessage(null);
		const formData = new FormData(event.currentTarget);

		const payload: AddFieldPayload = {
			site_id: parseInt(formData.get('site_id') as string, 10),
			name: formData.get('name') as string,
			field_type: formData.get('field_type') as string,
			// capacity: formData.get('capacity') ? parseInt(formData.get('capacity') as string, 10) : null,
		};

		if (!payload.site_id || !payload.name || !payload.field_type) {
			setError('Site, Field Name, and Field Type are required.');
			return;
		}

		try {
			const newField = await addFieldApi(payload);
			setFields(prev => [...prev, newField].sort((a,b) => (a.name || 'zzz').localeCompare(b.name || 'zzz')));
			setSuccessMessage('Field added successfully!');
			// Consider resetting the specific form if multiple add field forms exist
		} catch (e: unknown) {
			const errorMessage = e instanceof Error ? e.message : 'An unknown error occurred.';
			console.error('Failed to add field:', e);
			setError(`Failed to add field: ${errorMessage}`);
		}
	}, []);

	const refetchBookings = useCallback(fetchBookings, [fetchBookings]);

	const handleToggleBookingPaidStatus = useCallback(async (bookingId: number, currentStatus: boolean) => {
		setError(null);
		setSuccessMessage(null); // Clear messages
		const newStatus = !currentStatus;
		try {
			await updateBookingStatus(bookingId, { is_paid: newStatus });
			// Assume the API call was successful and update the local state with the intended newStatus
			setBookings((prevBookings) =>
				prevBookings.map((b) =>
					b.id === bookingId ? { ...b, is_paid: newStatus } : b
				)
			);
		} catch (e) {
			setError(e instanceof Error ? e.message : 'Failed to update booking status');
			setSuccessMessage(null); // Clear success message on error
		}
	}, []);

	const handleAddService = useCallback(async (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		setError(null);
		setSuccessMessage(null); // Clear messages
		const formData = new FormData(event.currentTarget);
		const name = formData.get('serviceName') as string;
		const description = formData.get('serviceDescription') as string;
		const requires_field_selection = formData.get('requiresFieldSelection') === 'on';
		const defaultPriceStr = formData.get('serviceDefaultPrice') as string;
		const service_type = formData.get('service_type') as 'Field Hire' | 'Daycare';

		if (!name) {
			setError('Service name is required.');
			return;
		}
		let default_price: number | null = null;
		if (defaultPriceStr) {
			const parsed = parseFloat(defaultPriceStr);
			if (!isNaN(parsed)) {
				default_price = parsed;
			} else {
				setError('Invalid format for default price.');
				return;
			}
		}

		if (!service_type || (service_type !== 'Field Hire' && service_type !== 'Daycare')) {
			setError('A valid Service Type (Field Hire or Daycare) must be selected.');
			return;
		}

		try {
			const payload = {
				name,
				description,
				requires_field_selection,
				default_price,
				service_type,
			};

			const newService = await addServiceApi(payload);
			setServices((prev) => [...prev, newService].sort((a, b) => a.name.localeCompare(b.name)));
			addServiceFormRef.current?.reset();
		} catch (e) {
			setError(e instanceof Error ? e.message : 'Failed to add service');
			setSuccessMessage(null); // Clear success message on error
		}
	}, []);

	const handleUpdateService = useCallback(async (serviceId: number, data: Partial<Omit<Service, 'id' | 'created_at'>>) => {
		setError(null);
		setSuccessMessage(null); // Clear messages
		try {
			const updatedService = await updateServiceApi(serviceId, data as UpdateServicePayload); // Cast data
			setServices((prev) => prev.map((s) => (s.id === serviceId ? updatedService : s)).sort((a, b) => a.name.localeCompare(b.name)));
		} catch (e) {
			setError(e instanceof Error ? e.message : 'Failed to update service');
			setSuccessMessage(null); // Clear success message on error
		}
	}, []);

	const handleDeleteService = useCallback(async (serviceId: number) => {
		if (!window.confirm('Are you sure you want to delete this service? This cannot be undone.')) return;
		setError(null);
		setSuccessMessage(null); // Clear messages
		try {
			await deleteServiceApi(serviceId);
			setServices((prev) => prev.filter((s) => s.id !== serviceId));
		} catch (e) {
			setError(e instanceof Error ? e.message : 'Failed to delete service');
			setSuccessMessage(null); // Clear success message on error
		}
	}, []);

	const handleAddServiceAvailability = useCallback(async (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		setError(null);
		setSuccessMessage(null);
		const formData = new FormData(event.currentTarget);
		const daysOfWeekISO: number[] = [];
		for (let i = 0; i <= 6; i++) {
			const dayValue = formData.get(`availabilityDayOfWeek-${i}`);
			if (dayValue !== null) {
				const dayNum = parseInt(dayValue as string, 10);
				if (!isNaN(dayNum)) {
					const isoDay = dayNum === 0 ? 7 : dayNum;
					daysOfWeekISO.push(isoDay);
				}
			}
		}

		const overridePriceStr = formData.get('availabilityOverridePrice') as string;
		let override_price: number | null = null;
		if (overridePriceStr) {
			const parsed = parseFloat(overridePriceStr);
			if (!isNaN(parsed)) override_price = parsed;
			else { setError('Invalid format for override price.'); return; }
		}
		const field_ids_str = formData.getAll('availabilityFieldIds') as string[];
		const field_ids = field_ids_str.map((id) => parseInt(id, 10)).filter((id) => !isNaN(id));

		const payload: AddServiceAvailabilityPayload = {
			service_id: parseInt(formData.get('availabilityServiceId') as string, 10),
			field_ids: field_ids,
			start_time: formData.get('availabilityStartTime') as string,
			end_time: formData.get('availabilityEndTime') as string,
			use_staff_vehicle_capacity: formData.get('use_staff_vehicle_capacity') === 'on',
			is_active: formData.get('availabilityIsActive') === 'on' || true,
			days_of_week: daysOfWeekISO.length > 0 ? daysOfWeekISO : null,
			specific_date: (formData.get('availabilitySpecificDate') as string) || null,
			override_price: override_price,
		};

		if (!payload.service_id || !payload.field_ids || payload.field_ids.length === 0 || !payload.start_time || !payload.end_time) {
			setError('Service, Field(s), Start Time, and End Time are required.'); return;
		}
		if (payload.days_of_week && payload.specific_date) {
			setError('Cannot set both Recurring Days and Specific Date.'); return;
		}
		if (!payload.days_of_week && !payload.specific_date) {
			setError('Must set either Recurring Days or a Specific Date.'); return;
		}
		if (payload.end_time <= payload.start_time) {
			setError('End Time must be after Start Time.'); return;
		}

		try {
			const newAvailabilityRule = await addServiceAvailabilityApi(payload);

			setServiceAvailability((prev) => [...prev, newAvailabilityRule].sort((a, b) => a.id - b.id));
			addServiceAvailabilityFormRef.current?.reset();
			setSuccessMessage('Success: Availability rule added!');
		} catch (e: unknown) {
			const errorMessage = e instanceof Error ? e.message : 'Failed to add service availability rule';
			setError(errorMessage);
			setSuccessMessage(null);
		}
	}, []);

	const handleUpdateServiceAvailability = useCallback(async (ruleId: number, data: UpdateServiceAvailabilityPayload) => {
		setError(null);
		setSuccessMessage(null);
		try {
			const updatedRule = await updateServiceAvailabilityApi(ruleId, data);

			setServiceAvailability((prev) => prev.map((r) => (r.id === ruleId ? updatedRule : r)).sort((a, b) => a.id - b.id));
			setSuccessMessage('Success: Availability rule updated!');
		} catch (e: unknown) {
			const errorMessage = e instanceof Error ? e.message : 'Failed to update availability rule';
			setError(errorMessage);
			setSuccessMessage(null);
		}
	}, []);

	const handleDeleteServiceAvailability = useCallback(async (ruleId: number) => {
		if (!window.confirm('Are you sure you want to delete this availability rule?')) return;
		setError(null);
		setSuccessMessage(null);
		try {
			await deleteServiceAvailabilityApi(ruleId);

			setServiceAvailability((prev) => prev.filter((r) => r.id !== ruleId));
			setSuccessMessage('Success: Availability rule deleted!');
		} catch (e: unknown) {
			const errorMessage = e instanceof Error ? e.message : 'Failed to delete availability rule';
			setError(errorMessage);
			setSuccessMessage(null);
		}
	}, []);

	const handleToggleServiceAvailabilityActive = useCallback(
		async (ruleId: number, currentStatus: boolean) => {
			await handleUpdateServiceAvailability(ruleId, { is_active: !currentStatus });
		},
		[handleUpdateServiceAvailability]
	);

	const handleAddVehicle = useCallback(async (vehicleData: Partial<Vehicle>) => {
		setVehicleError(null);
		setError(null);
		setSuccessMessage(null);
		try {
			const newVehicle = await addVehicleApi(vehicleData);
			setVehicles((prev) => [...prev, newVehicle]);
		} catch (e) {
			const msg = e instanceof Error ? e.message : 'Failed to add vehicle';
			setVehicleError(msg);
			setError(`Vehicle Error: ${msg}`);
			setSuccessMessage(null); // Clear success message on error
		}
	}, []);

	const handleDeleteVehicle = useCallback(async (id: number) => {
		setVehicleError(null);
		setError(null);
		setSuccessMessage(null);
		if (!window.confirm('Are you sure you want to delete this vehicle?')) return;
		try {
			await deleteVehicleApi(id);
			setVehicles((prev) => prev.filter((v) => v.id !== id));
		} catch (e) {
			const msg = e instanceof Error ? e.message : 'Failed to delete vehicle';
			setVehicleError(msg);
			setError(`Vehicle Error: ${msg}`);
			setSuccessMessage(null); // Clear success message on error
		}
	}, []);

	const handleUpdateVehicle = useCallback(async (id: number, updates: Partial<Vehicle>) => {
		setVehicleError(null);
		setError(null);
		setSuccessMessage(null);
		try {
			const updatedVehicle = await updateVehicleApi(id, updates);
			setVehicles((prev) => prev.map((v) => (v.id === id ? updatedVehicle : v)));
		} catch (e) {
			const message = e instanceof Error ? e.message : 'Failed to update vehicle';
			setVehicleError(message);
			setError(`Vehicle Update Error: ${message}`);
			setSuccessMessage(null); // Clear success message on error
		}
	}, []);

	// === Site & Field Management Handlers ===
	const handleUpdateField = useCallback(async (fieldId: number, updatedData: UpdateFieldPayload) => {
		setError(null);
		setSuccessMessage(null);
		try {
			const updatedField = await updateFieldApi(fieldId, updatedData);
			setFields(prev => prev.map(f => f.id === fieldId ? updatedField : f));
			setSuccessMessage('Field updated successfully!');
		} catch (e: unknown) {
			const errorMessage = e instanceof Error ? e.message : 'An unknown error occurred.';
			console.error('Failed to update field:', e);
			setError(`Failed to update field: ${errorMessage}`);
		}
	}, []);

	const handleDeleteField = useCallback(async (fieldId: number) => {
		if (!window.confirm('Are you sure you want to delete this field?')) return;
		setError(null);
		setSuccessMessage(null);
		try {
			await deleteFieldApi(fieldId);
			setFields(prev => prev.filter(f => f.id !== fieldId));
			setSuccessMessage('Field deleted successfully!');
		} catch (e: unknown) {
			const errorMessage = e instanceof Error ? e.message : 'An unknown error occurred.';
			console.error('Failed to delete field:', e);
			setError(`Failed to delete field: ${errorMessage}`);
		}
	}, []);

	// === Helper Functions ===
	const getFieldsForSite = useCallback(
		(siteId: number): Field[] => {
			return fields.filter((f) => f.site_id === siteId);
		},
		[fields]
	);

	// === Define Tabs ===
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
					updatingUserId={updatingUserId}
					handleAssignRole={handleAssignRole}
					onUserUpdated={fetchAllUsers}
				/>
			),
		},
		{
			id: 'clients',
			label: 'Client Management',
			content: <ClientManagement />,
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
					onUpdateField={handleUpdateField}
					onDeleteField={handleDeleteField}
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
					services={services}
					handleToggleBookingPaidStatus={handleToggleBookingPaidStatus}
					refetchBookings={refetchBookings}
					bookings={bookings}
					isLoadingBookings={isLoadingBookings}
					error={error}
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
			content: <StaffAvailabilityManagement />,
		},
		{
			id: 'email',
			label: 'Email Management',
			content: <EmailManagement />,
		},
	];

	// === Render ===
	return (
		<>
			<h2>Admin Dashboard</h2>
			<p>Manage your business operations from this central hub.</p>
			{/* Display error messages in red */}
			{error && <p style={{ color: '#f87171', background: '#4a2a2a', padding: '0.5rem', borderRadius: '4px' }}>Error: {error}</p>}
			{/* Display success messages in green */}
			{successMessage && <p style={{ color: '#6ee7b7', background: '#1a3a3a', padding: '0.5rem', borderRadius: '4px' }}>{successMessage}</p>}
			<SidebarNavigation tabs={adminTabs} />
		</>
	);
}
