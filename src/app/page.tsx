'use client';

import { useEffect, useState, useRef } from 'react';
import { createClient } from '@/utils/supabase/client';
// Remove Auth UI imports
// import { Auth } from '@supabase/auth-ui-react';
// import { ThemeSupa } from '@supabase/auth-ui-shared';
import type { User } from '@supabase/supabase-js';
import styles from "./page.module.css";
// Import server actions
import { login, signup } from './actions';
// Import the new component
import ClientBooking from '@/components/client/ClientBooking';
import UserManagement from '@/components/admin/UserManagement'; // Import UserManagement
import SiteFieldManagement from '@/components/admin/SiteFieldManagement'; // Import SiteFieldManagement
import BookingManagement from '@/components/admin/BookingManagement'; // Import BookingManagement
import ServiceManagement from '@/components/admin/ServiceManagement'; // Import ServiceManagement
import ServiceAvailabilityManagement from '@/components/admin/ServiceAvailabilityManagement'; // Import ServiceAvailabilityManagement
import ClientManagement from '@/components/admin/ClientManagement'; // Import ClientManagement
import AuthForm from '@/components/AuthForm'; // Import AuthForm
import PetManagement from '@/components/client/PetManagement'; // Import PetManagement
import MyBookings from '@/components/client/MyBookings'; // Import MyBookings
import AdminDashboard from '@/components/admin/AdminDashboard';
import StaffDashboard from '@/components/staff/StaffDashboard';
import ClientDashboard from '@/components/client/ClientDashboard';

// Define types for Site and Field based on schema
type Site = {
  id: number;
  name: string;
  address: string | null;
  is_active: boolean;
  fields?: Field[]; // Optional: for nesting fields under sites in state
}

type Field = {
  id: number;
  site_id: number;
  name: string | null;
  capacity: number | null;
  field_type: string | null;
}

// Define Booking Type
type Booking = {
  id: number;
  field_id: number;
  start_time: string; // ISO string format from DB
  end_time: string; // ISO string format from DB
  service_type: string | null;
  status: string;
  max_capacity: number | null;
}

// Define Service Type
type Service = {
  id: number;
  name: string;
  description: string | null;
  created_at: string;
  requires_field_selection: boolean;
}

// Define ServiceAvailability Type
type ServiceAvailability = {
  id: number;
  service_id: number;
  field_ids: number[];
  start_time: string;
  end_time: string;
  days_of_week: number[] | null;
  specific_date: string | null;
  base_capacity: number | null;
  is_active: boolean;
  created_at: string;
}

// Define a type for the user data we expect from the API
type UserWithRole = {
  id: string;
  email?: string;
  role: string;
  created_at?: string;
  last_sign_in_at?: string;
}

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [isLoadingInitial, setIsLoadingInitial] = useState(true);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [isLoadingRole, setIsLoadingRole] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // State to track which user row is being updated
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);
  // Add state for sites and fields
  const [sites, setSites] = useState<Site[]>([]);
  const [fields, setFields] = useState<Field[]>([]);
  const [isLoadingSites, setIsLoadingSites] = useState(false);
  const [isLoadingFields, setIsLoadingFields] = useState(false);
  // Add state for bookings
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [isLoadingBookings, setIsLoadingBookings] = useState(false);
  // Add new state for services and availability
  const [services, setServices] = useState<Service[]>([]);
  const [isLoadingServices, setIsLoadingServices] = useState(false);
  const [serviceAvailability, setServiceAvailability] = useState<ServiceAvailability[]>([]);
  const [isLoadingServiceAvailability, setIsLoadingServiceAvailability] = useState(false);
  const supabase = createClient();

  // Create refs for forms that need resetting after async ops
  const addSiteFormRef = useRef<HTMLFormElement>(null);
  const addServiceFormRef = useRef<HTMLFormElement>(null);
  const addBookingFormRef = useRef<HTMLFormElement>(null);
  const addServiceAvailabilityFormRef = useRef<HTMLFormElement>(null);

  const fetchUserRole = async (userId: string) => {
    setIsLoadingRole(true);
    setRole(null);
    try {
      // Fetch from staff, don't assume single row
      const { data: staffData, error: staffError } = await supabase
        .from('staff')
        .select('role')
        .eq('user_id', userId)
        .limit(1); // Limit to 1 row for safety, but don't use .single()

      // Check if we found a staff record
      if (staffData && staffData.length > 0) {
         // Use the role from the first record found
        return staffData[0].role || 'staff';
      }
      // Throw if error is not "zero rows"
      if (staffError) throw staffError;

      // Fetch from clients, don't assume single row
      const { data: clientData, error: clientError } = await supabase
        .from('clients')
        .select('id')
        .eq('user_id', userId)
        .limit(1); // Limit to 1 row

      // Check if we found a client record
      if (clientData && clientData.length > 0) {
        return 'client';
      }
       // Throw if error is not "zero rows"
      if (clientError) throw clientError;

      // If not found in either table
      return null;
    } catch (err) {
      // Log unexpected errors (like connection issues, RLS problems)
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
      console.error("Error fetching user role:", err);
      setError(errorMessage);
      return null;
    } finally {
      setIsLoadingRole(false);
    }
  };

  const fetchAllUsers = async () => {
    setIsLoadingUsers(true);
    setError(null);
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
      console.error("Failed to fetch users:", e);
      setError(errorMessage);
      setUsers([]);
    } finally {
      setIsLoadingUsers(false);
    }
  };

  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
      setIsLoadingInitial(false);
    };

    checkUser();

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      setRole(null);
      setUsers([]);
      setError(null);
      setIsLoadingRole(false);
      setIsLoadingUsers(false);
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [supabase]);

  useEffect(() => {
    if (user) {
      fetchUserRole(user.id).then(fetchedRole => {
        setRole(fetchedRole);
      });
    } else {
      setRole(null);
    }
  }, [user]);

  useEffect(() => {
    if (role === 'admin') {
      fetchAllUsers();
    } else {
      setUsers([]);
    }
  }, [role]);

  // --- Site/Field Management Functions ---
  const fetchSites = async () => {
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
  };

  const fetchFields = async () => {
    setIsLoadingFields(true);
    setError(null);
    try {
      const response = await fetch('/api/fields'); // Fetch all fields initially
      if (!response.ok) throw new Error('Failed to fetch fields');
      const data: Field[] = await response.json();
      setFields(data);
    } catch (e) {
       setError(e instanceof Error ? e.message : 'Failed to load fields');
       setFields([]);
    } finally {
      setIsLoadingFields(false);
    }
  };

  const handleAddSite = async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setError(null);
      // Use the ref to get form data if needed, or keep using event.currentTarget for this part
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
          setSites(prevSites => [...prevSites, newSite]);
          // Reset the form using the ref (with optional chaining)
          addSiteFormRef.current?.reset();
      } catch (e) {
          setError(e instanceof Error ? e.message : 'Failed to add site');
      }
  };

  const handleAddField = async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setError(null);
      const formData = new FormData(event.currentTarget);
      const site_id = formData.get('fieldSiteId') as string;
      const name = formData.get('fieldName') as string;
      const capacity = formData.get('fieldCapacity') as string;
      const field_type = formData.get('fieldType') as string;

      if (!site_id) {
          setError('Site ID is required to add a field.');
          return;
      }

       try {
          const response = await fetch('/api/fields', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ site_id, name, capacity, field_type }),
          });
          if (!response.ok) {
              const errorData = await response.json();
              throw new Error(errorData.error || 'Failed to add field');
          }
          const newField: Field = await response.json();
          setFields(prevFields => [...prevFields, newField]);
          // Remove the reset call for the dynamic field forms
          // event.currentTarget.reset();
      } catch (e) {
          setError(e instanceof Error ? e.message : 'Failed to add field');
      }
  };
  // ---------------------------------------

  // Effect 4: Fetch Sites & Fields when Role becomes 'admin'
  useEffect(() => {
    if (role === 'admin' || role === 'staff') {
      fetchSites();
      fetchFields();
      fetchBookings(); // Fetch bookings for admin/staff
      fetchServices(); // All staff/admin can see services
      if (role === 'admin') { // Only admins manage availability rules
        fetchServiceAvailability();
      } else {
        setServiceAvailability([]); // Clear if staff
      }
    } else {
      // Clear data if user is not admin/staff
      setSites([]);
      setFields([]);
      setBookings([]); // Clear bookings
      setServices([]); // Clear services
      setServiceAvailability([]); // Clear availability
    }
     // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role]);

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error('Error logging out:', error);
      setError('Failed to log out.');
    } else {
      // Clear the URL parameters after successful logout
      window.history.replaceState({}, '', '/');
    }
  };

  // Function to handle role assignment
  const handleAssignRole = async (userId: string, targetRole: 'client' | 'staff' | 'admin') => {
    if (!user || role !== 'admin') {
      setError('Permission denied.');
      return;
    }
    if (user.id === userId) {
       setError('Cannot change your own role.');
       return;
    }

    setUpdatingUserId(userId); // Set loading state for this user
    setError(null);

    try {
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId, targetRole }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to assign role (HTTP ${response.status})`);
      }

      // Success! Refresh the user list to show the updated role
      await fetchAllUsers();

    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : 'An unknown error occurred.';
      console.error("Role assignment failed:", e);
      setError(errorMessage);
    } finally {
      setUpdatingUserId(null); // Clear loading state
    }
  };

  // --- Booking Management Functions ---
  const fetchBookings = async () => {
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
  };

  const handleAddBooking = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    const formData = new FormData(event.currentTarget);
    const field_id = formData.get('bookingFieldId') as string;
    const start_time = formData.get('bookingStartTime') as string;
    const end_time = formData.get('bookingEndTime') as string;
    const service_type = formData.get('bookingServiceType') as string;
    // Optional fields
    const max_capacity = formData.get('bookingMaxCapacity') as string;

    if (!field_id || !start_time || !end_time) {
      setError('Field, start time, and end time are required.');
      return;
    }

    try {
      const payload = {
        field_id,
        start_time,
        end_time,
        service_type: service_type || null, // Send null if empty
        max_capacity: max_capacity || null, // Send null if empty (API handles parsing)
      };

      const response = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to add booking');
      }
      const newBooking: Booking = await response.json();
      setBookings(prevBookings => [...prevBookings, newBooking].sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())); // Add and sort
      addBookingFormRef.current?.reset(); // Use ref
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to add booking');
    }
  };

  // --- Service Management Functions ---
  const fetchServices = async () => {
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
  };

  const handleAddService = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    const formData = new FormData(event.currentTarget);
    const name = formData.get('serviceName') as string;
    const description = formData.get('serviceDescription') as string;

    if (!name) {
      setError('Service name is required.');
      return;
    }

    try {
      const response = await fetch('/api/services', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to add service');
      }
      const newService: Service = await response.json();
      setServices(prev => [...prev, newService].sort((a, b) => a.name.localeCompare(b.name)));
      addServiceFormRef.current?.reset(); // Use ref
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to add service');
    }
  };
  // -----------------------------------

  // --- Service Availability Management Functions ---
  const fetchServiceAvailability = async () => {
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
  };

  const handleAddServiceAvailability = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    const formData = new FormData(event.currentTarget);

    const daysOfWeek: number[] = [];
    for (let i = 1; i <= 7; i++) {
      if (formData.get(`availabilityDayOfWeek-${i}`) === 'on') {
        daysOfWeek.push(i);
      }
    }

    const payload = {
      service_id: formData.get('availabilityServiceId') as string,
      field_ids: formData.getAll('availabilityFieldIds') as string[],
      start_time: formData.get('availabilityStartTime') as string,
      end_time: formData.get('availabilityEndTime') as string,
      base_capacity: formData.get('availabilityBaseCapacity') as string || undefined,
      is_active: formData.get('availabilityIsActive') === 'on',
      days_of_week: daysOfWeek.length > 0 ? daysOfWeek : undefined,
      specific_date: formData.get('availabilitySpecificDate') as string || undefined,
    };

    // Client-side validation (matching API)
    if (!payload.service_id || !payload.field_ids || payload.field_ids.length === 0 || !payload.start_time || !payload.end_time) {
      setError('Service, at least one Field, Start Time, and End Time are required.');
      return;
    }
    payload.field_ids = payload.field_ids.filter(id => id);
     if (payload.field_ids.length === 0) {
         setError('At least one Field must be selected.');
         return;
    }
    if (payload.specific_date === '' || payload.specific_date === undefined) payload.specific_date = undefined;
    if (payload.days_of_week !== undefined && payload.specific_date !== undefined) {
      setError('Cannot set both Recurring Days and Specific Date.');
      return;
    }

    try {
      const response = await fetch('/api/service-availability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        body: JSON.stringify(Object.fromEntries(Object.entries(payload).filter(([_, v]) => v !== undefined))),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to add service availability rule');
      }
      const newAvailabilityRule: ServiceAvailability = await response.json();
      setServiceAvailability(prev => [...prev, newAvailabilityRule].sort((a, b) => a.id - b.id));
      addServiceAvailabilityFormRef.current?.reset(); // Use ref
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to add service availability rule');
    }
  };
  // --------------------------------------------

  // --- Handler to toggle Service Availability Active state ---
  const handleToggleServiceAvailabilityActive = async (ruleId: number, currentStatus: boolean) => {
    setError(null);
    const newStatus = !currentStatus;

    try {
      const response = await fetch('/api/service-availability', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: ruleId, is_active: newStatus }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to update rule ${ruleId}`);
      }

      const updatedRule: ServiceAvailability = await response.json();

      // Update the local state
      setServiceAvailability(prevRules =>
        prevRules.map(rule => (rule.id === ruleId ? updatedRule : rule))
      );

    } catch (e) {
      setError(e instanceof Error ? e.message : `Failed to update rule ${ruleId}`);
      // Optionally revert optimistic UI update here if you implemented one
    }
  };
  // --------------------------------------------------------

  // Fetch data on login/role change
  useEffect(() => {
    if (user) {
        // Fetch sites/fields/services needed for name lookups if not already loaded by admin/staff role check
        if (role !== 'admin' && role !== 'staff') {
            // Clients only need services for the dropdown, not all sites/fields
            // fetchSites(); // REMOVED for clients
            // fetchFields(); // REMOVED for clients
            fetchServices();
        } else {
            // Admin/Staff still need sites/fields for their management sections
            fetchSites();
            fetchFields();
            fetchServices(); // Ensure services are fetched for admin/staff too
        }
    } else {
        // Clear data on logout
        setSites([]);
        setFields([]);
        setServices([]);
        // setCalculatedSlots([]); // State moved to ClientBooking
        setServiceAvailability([]); // Clear admin availability rules
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, role]); // Re-run if user or role changes

  if (isLoadingInitial) {
    return <div>Loading...</div>;
  }

  // --- Helper to group fields by site_id ---
  const getFieldsForSite = (siteId: number): Field[] => {
      return fields.filter(f => f.site_id === siteId);
  }
  // ----------------------------------------

  return (
    <div className={styles.page}>
      <header>
        <h1>Booking & Accounts</h1>
        {user ? (
          <div>
            <p>
              Welcome, {user.email}!
              {isLoadingRole ? (
                <span> (Checking role...)</span>
              ) : (
                role && <span> (Role: {role})</span>
              )}
            </p>
            <button onClick={handleLogout}>Logout</button>
          </div>
        ) : (
          <p>Please log in or sign up.</p>
        )}
      </header>
      {!user && (
        // Render the AuthForm component, passing server actions
        <AuthForm login={login} signup={signup} />
      )}
      {user && (
        <main>
          {isLoadingRole ? (
            <p>Verifying user role...</p>
          ) : (
            <>
              {/* Render the appropriate dashboard based on user role */}
              {role === 'admin' && (
                <AdminDashboard
                  user={user}
                  users={users}
                  isLoadingUsers={isLoadingUsers}
                  updatingUserId={updatingUserId}
                  handleAssignRole={handleAssignRole}
                  sites={sites}
                  fields={fields}
                  isLoadingSites={isLoadingSites}
                  isLoadingFields={isLoadingFields}
                  handleAddSite={handleAddSite}
                  handleAddField={handleAddField}
                  getFieldsForSite={getFieldsForSite}
                  addSiteFormRef={addSiteFormRef}
                  bookings={bookings}
                  isLoadingBookings={isLoadingBookings}
                  handleAddBooking={handleAddBooking}
                  addBookingFormRef={addBookingFormRef}
                  fetchBookings={fetchBookings}
                  services={services}
                  isLoadingServices={isLoadingServices}
                  handleAddService={handleAddService}
                  addServiceFormRef={addServiceFormRef}
                  serviceAvailability={serviceAvailability}
                  isLoadingServiceAvailability={isLoadingServiceAvailability}
                  handleAddServiceAvailability={handleAddServiceAvailability}
                  handleToggleServiceAvailabilityActive={handleToggleServiceAvailabilityActive}
                  addServiceAvailabilityFormRef={addServiceAvailabilityFormRef}
                  error={error}
                />
              )}

              {role === 'staff' && (
                <StaffDashboard
                  user={user}
                  bookings={bookings}
                  isLoadingBookings={isLoadingBookings}
                  sites={sites}
                  fields={fields}
                  services={services}
                  handleAddBooking={handleAddBooking}
                  addBookingFormRef={addBookingFormRef}
                  getFieldsForSite={getFieldsForSite}
                  fetchBookings={fetchBookings}
                  error={error}
                />
              )}

              {role === 'client' && (
                <ClientDashboard
                  user={user}
                  services={services}
                />
              )}

              {!role && (
                <div>
                  <p>Your account is not currently assigned a role. Please contact an administrator.</p>
                </div>
              )}
            </>
          )}
        </main>
      )}
    </div>
  );
}
