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
import { createClient } from '@/utils/supabase/client';
import type { User } from '@supabase/supabase-js';
import type { UserWithRole, Site, Field, Booking, Service, ServiceAvailability, Vehicle, StaffMemberListItem, Staff } from '@/types';

// Define props for the admin dashboard - Only needs user now
interface AdminDashboardProps {
	user: User;
	// REMOVED ALL OTHER PROPS
}

export default function AdminDashboard({ user }: AdminDashboardProps) {
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
			const response = await fetch('/api/users');
			if (!response.ok) {
				const errorData = await response.json();
				throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
			}
			const data: UserWithRole[] = await response.json();
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
			const response = await fetch('/api/sites');
			if (!response.ok) throw new Error('Failed to fetch sites');
			const data: Site[] = await response.json();
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
			const response = await fetch('/api/fields');
			if (!response.ok) throw new Error('Failed to fetch fields');
			const data: Field[] = await response.json();
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
			const response = await fetch('/api/services');
			if (!response.ok) throw new Error('Failed to fetch services');
			const data: Service[] = await response.json();
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
			const response = await fetch('/api/vehicles');
			if (!response.ok) throw new Error('Failed to fetch vehicles');
			const data: Vehicle[] = await response.json();
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
			if (!user || user.id === userId) {
				setError('Permission denied or cannot change own role.');
				return;
			}
			setUpdatingUserId(userId);
			setError(null);
			setSuccessMessage(null); // Clear messages
			try {
				const response = await fetch('/api/users', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ userId, targetRole }),
				});
				if (!response.ok) {
					const errorData = await response.json();
					throw new Error(errorData.error || `Failed to assign role (HTTP ${response.status})`);
				}
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
		[user, fetchAllUsers]
	);

	const handleAssignDefaultVehicle = useCallback(async (staffId: number, vehicleId: number | null) => {
		setError(null);
		setSuccessMessage(null); // Clear messages
		try {
			const response = await fetch('/api/staff/assignment', {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ staffId, defaultVehicleId: vehicleId }),
			});
			if (!response.ok) {
				const errorData = await response.json();
				throw new Error(errorData.error || `Failed to assign vehicle (HTTP ${response.status})`);
			}
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
		setSuccessMessage(null); // Clear messages
		const formData = new FormData(event.currentTarget);
		const name = formData.get('siteName') as string;
		const address = formData.get('siteAddress') as string;
		if (!name) {
			setError('Site name is required.');
			return;
		}
		try {
			const response = await fetch('/api/sites', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ name, address }),
			});
			if (!response.ok) {
				const errorData = await response.json();
				throw new Error(errorData.error || 'Failed to add site');
			}
			const newSite: Site = await response.json();
			setSites((prevSites) => [...prevSites, newSite]);
			addSiteFormRef.current?.reset();
		} catch (e) {
			setError(e instanceof Error ? e.message : 'Failed to add site');
			setSuccessMessage(null); // Clear success message on error
		}
	}, []);

	const handleAddField = useCallback(async (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		setError(null);
		setSuccessMessage(null); // Clear messages
		const formData = new FormData(event.currentTarget);
		const site_id = formData.get('fieldSiteId') as string;
		const name = formData.get('fieldName') as string;
		const field_type = formData.get('fieldType') as string;
		if (!site_id || !name || !field_type) {
			setError('Site, Field Name, and Field Type are required.');
			return;
		}
		try {
			const response = await fetch('/api/fields', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ site_id: parseInt(site_id, 10), name, field_type }),
			});
			if (!response.ok) {
				const errorData = await response.json();
				throw new Error(errorData.error || 'Failed to add field');
			}
			const newField: Field = await response.json();
			setFields((prevFields) => [...prevFields, newField]);
		} catch (e) {
			setError(e instanceof Error ? e.message : 'Failed to add field');
			setSuccessMessage(null); // Clear success message on error
		}
	}, []);

	const refetchBookings = useCallback(fetchBookings, [fetchBookings]);

	const handleToggleBookingPaidStatus = useCallback(async (bookingId: number, currentStatus: boolean) => {
		setError(null);
		setSuccessMessage(null); // Clear messages
		const newStatus = !currentStatus;
		try {
			const response = await fetch(`/api/bookings/${bookingId}/status`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ is_paid: newStatus }),
			});
			if (!response.ok) {
				const errorData = await response.json();
				throw new Error(errorData.error || 'Failed to update booking status');
			}
			const updatedBookingStatus: { id: number; is_paid: boolean } = await response.json();
			setBookings((prevBookings) => prevBookings.map((b) => (b.id === bookingId ? { ...b, is_paid: updatedBookingStatus.is_paid } : b)));
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

			const response = await fetch('/api/services', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload),
			});
			if (!response.ok) {
				const errorData = await response.json();
				throw new Error(errorData.error || 'Failed to add service');
			}
			const newService: Service = await response.json();
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
			const response = await fetch(`/api/services/${serviceId}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(data),
			});
			if (!response.ok) {
				const errorData = await response.json();
				throw new Error(errorData.error || 'Failed to update service');
			}
			const updatedService: Service = await response.json();
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
			const response = await fetch(`/api/services/${serviceId}`, { method: 'DELETE' });
			if (!response.ok) {
				const errorData = await response.json();
				throw new Error(errorData.error || 'Failed to delete service');
			}
			setServices((prev) => prev.filter((s) => s.id !== serviceId));
		} catch (e) {
			setError(e instanceof Error ? e.message : 'Failed to delete service');
			setSuccessMessage(null); // Clear success message on error
		}
	}, []);

	const handleAddServiceAvailability = useCallback(async (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		setError(null);
		setSuccessMessage(null); // Clear messages at the start
		const formData = new FormData(event.currentTarget);
		const daysOfWeekISO: number[] = []; // Store as ISO days (Mon=1, Sun=7)

		for (let i = 0; i <= 6; i++) {
			// Check indices 0 (Sun) to 6 (Sat)
			const dayValue = formData.get(`availabilityDayOfWeek-${i}`);
			if (dayValue !== null) {
				const dayNum = parseInt(dayValue as string, 10); // This is 0-6
				if (!isNaN(dayNum)) {
					// Convert index (0-6) to ISO day (1-7)
					const isoDay = dayNum === 0 ? 7 : dayNum;
					daysOfWeekISO.push(isoDay);
				}
			}
		}
		console.log('Collected daysOfWeek (ISO 1-7):', daysOfWeekISO);

		const overridePriceStr = formData.get('availabilityOverridePrice') as string;
		let override_price: number | null = null;
		if (overridePriceStr) {
			const parsed = parseFloat(overridePriceStr);
			if (!isNaN(parsed)) override_price = parsed;
			else {
				setError('Invalid format for override price.');
				return;
			}
		}

		const field_ids_str = formData.getAll('availabilityFieldIds') as string[];
		const field_ids = field_ids_str.map((id) => parseInt(id, 10)).filter((id) => !isNaN(id));

		const payload: Partial<ServiceAvailability> = {
			service_id: parseInt(formData.get('availabilityServiceId') as string, 10),
			field_ids: field_ids,
			start_time: formData.get('availabilityStartTime') as string,
			end_time: formData.get('availabilityEndTime') as string,
			// Use staff vehicle capacity flag name from the form
			use_staff_vehicle_capacity: formData.get('use_staff_vehicle_capacity') === 'on',
			// Default is_active to true when adding, if not present in form
			is_active: formData.get('availabilityIsActive') === 'on' || true,
			days_of_week: daysOfWeekISO.length > 0 ? daysOfWeekISO : null, // Send ISO days
			specific_date: (formData.get('availabilitySpecificDate') as string) || null,
			override_price: override_price,
		};

		// Validation remains the same
		if (!payload.service_id || !payload.field_ids || payload.field_ids.length === 0 || !payload.start_time || !payload.end_time) {
			setError('Service, Field(s), Start Time, and End Time are required.');
			return;
		}
		if (payload.days_of_week && payload.specific_date) {
			setError('Cannot set both Recurring Days and Specific Date.');
			return;
		}
		if (!payload.days_of_week && !payload.specific_date) {
			setError('Must set either Recurring Days or a Specific Date.');
			return;
		}
		if (payload.end_time <= payload.start_time) {
			setError('End Time must be after Start Time.');
			return;
		}

		// API Call remains the same
		try {
			console.log('[handleAddServiceAvailability] Sending payload:', payload); // Log payload before sending
			const response = await fetch('/api/service-availability', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload),
			});
			if (!response.ok) {
				const errorData = await response.json();
				throw new Error(errorData.error || 'Failed to add service availability rule');
			}
			const newAvailabilityRule: ServiceAvailability = await response.json();
			console.log('[handleAddServiceAvailability] Received new rule from API:', newAvailabilityRule); // Log response object
			setServiceAvailability((prev) => [...prev, newAvailabilityRule].sort((a, b) => a.id - b.id));
			addServiceAvailabilityFormRef.current?.reset();
			// Set success message instead of error
			setSuccessMessage('Success: Availability rule added!');
		} catch (e) {
			setError(e instanceof Error ? e.message : 'Failed to add service availability rule');
			setSuccessMessage(null); // Clear success message on error
		}
	}, []);

	const handleUpdateServiceAvailability = useCallback(async (ruleId: number, data: Partial<Omit<ServiceAvailability, 'id' | 'created_at'>>) => {
		setError(null);
		setSuccessMessage(null); // Clear messages
		try {
			const response = await fetch(`/api/service-availability/${ruleId}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(data),
			});
			if (!response.ok) {
				const errorData = await response.json();
				throw new Error(errorData.error || 'Failed to update availability rule');
			}
			const updatedRule: ServiceAvailability = await response.json();
			setServiceAvailability((prev) => prev.map((r) => (r.id === ruleId ? updatedRule : r)).sort((a, b) => a.id - b.id));
		} catch (e) {
			setError(e instanceof Error ? e.message : 'Failed to update availability rule');
			setSuccessMessage(null); // Clear success message on error
		}
	}, []);

	const handleDeleteServiceAvailability = useCallback(async (ruleId: number) => {
		if (!window.confirm('Are you sure you want to delete this availability rule?')) return;
		setError(null);
		setSuccessMessage(null); // Clear messages
		try {
			const response = await fetch(`/api/service-availability/${ruleId}`, { method: 'DELETE' });
			if (!response.ok) {
				const errorData = await response.json();
				throw new Error(errorData.error || 'Failed to delete availability rule');
			}
			setServiceAvailability((prev) => prev.filter((r) => r.id !== ruleId));
		} catch (e) {
			setError(e instanceof Error ? e.message : 'Failed to delete availability rule');
			setSuccessMessage(null); // Clear success message on error
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
			const response = await fetch('/api/vehicles', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(vehicleData),
			});
			if (!response.ok) {
				const errorData = await response.json();
				throw new Error(errorData.error || 'Failed to add vehicle');
			}
			const newVehicle: Vehicle = await response.json();
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
			const response = await fetch(`/api/vehicles?id=${id}`, { method: 'DELETE' });
			if (!response.ok) {
				const errorData = await response.json();
				throw new Error(errorData.error || 'Failed to delete vehicle');
			}
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
			const payload = { ...updates, id };
			const response = await fetch(`/api/vehicles`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload),
			});
			if (!response.ok) {
				const errorData = await response.json();
				throw new Error(errorData.error || 'Failed to update vehicle');
			}
			const updatedVehicle: Vehicle = await response.json();
			setVehicles((prev) => prev.map((v) => (v.id === id ? updatedVehicle : v)));
		} catch (e) {
			const message = e instanceof Error ? e.message : 'Failed to update vehicle';
			setVehicleError(message);
			setError(`Vehicle Update Error: ${message}`);
			setSuccessMessage(null); // Clear success message on error
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
