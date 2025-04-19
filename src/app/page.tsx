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
  // ---------------------------------

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
        <div style={{ maxWidth: '400px', margin: '50px auto', border: '1px solid #ccc', padding: '2rem', borderRadius: '8px' }}>
          <form className={styles.authForm}>
            <h2>Login or Sign Up</h2>

            <div>
              <label htmlFor="name">Name:</label>
              <input id="name" name="name" type="text" placeholder="Your Name (for signup)"/>
            </div>

            <div>
              <label htmlFor="email">Email:</label>
              <input id="email" name="email" type="email" required placeholder="your@email.com" />
            </div>

            <div>
              <label htmlFor="password">Password:</label>
              <input id="password" name="password" type="password" required placeholder="••••••••"/>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1rem'}}>
              <button type="submit" formAction={login}>Log in</button>
              <button type="submit" formAction={signup}>Sign up</button>
            </div>
          </form>
        </div>
      )}
      {user && (
        <main>
          <p>This is the main content area for logged-in users.</p>

          {!isLoadingRole && role === 'admin' && (
            <section>
              <h2>User Management (Admin)</h2>
              {isLoadingUsers && <p>Loading users...</p>}
              {error && <p style={{ color: 'red' }}>Error: {error}</p>}
              {!isLoadingUsers && !error && users.length > 0 && (
                <div className={styles.userList}>
                  <div className={styles.userCardHeader}>
                    <div>Email</div>
                    <div>Current Role</div>
                    <div>Created At</div>
                    <div>Last Sign In</div>
                    <div className={styles.userAction}>Actions</div>
                  </div>
                  {users.map((u) => (
                    <div key={u.id} className={`${styles.userCard} ${updatingUserId === u.id ? styles.updating : ''}`}>
                      <div>{u.email ?? 'N/A'}</div>
                      <div>{u.role}</div>
                      <div>{u.created_at ? new Date(u.created_at).toLocaleString() : 'N/A'}</div>
                      <div>{u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleString() : 'N/A'}</div>
                      <div className={styles.userAction}>
                        {updatingUserId === u.id ? (
                          <span>Updating...</span>
                        ) : (
                          <>
                            {/* Conditionally render buttons based on current role */}
                            {/* Prevent changing own role or if role is already target */}
                            {u.id !== user.id && u.role !== 'client' && (
                              <button onClick={() => handleAssignRole(u.id, 'client')}>Make Client</button>
                            )}
                            {u.id !== user.id && u.role !== 'staff' && (
                              <button onClick={() => handleAssignRole(u.id, 'staff')}>Make Staff</button>
                            )}
                            {u.id !== user.id && u.role !== 'admin' && (
                              <button onClick={() => handleAssignRole(u.id, 'admin')}>Make Admin</button>
                            )}
                            {/* Show current role if it's the admin's own row */}
                            {u.id === user.id && (
                               <span>(Your Role)</span>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {!isLoadingUsers && !error && users.length === 0 && (
                 <p>No users found.</p>
               )}
            </section>
          )}
          {isLoadingRole && <p>Verifying user role...</p>}
          {!isLoadingRole && role && role !== 'admin' && (
            <p>You do not have permission to view user management.</p>
          )}

          {/* --- Site & Field Management Section (Admin Only) --- */}
          {!isLoadingRole && role === 'admin' && (
            <section style={{ marginTop: '2rem', borderTop: '1px solid #eee', paddingTop: '2rem' }}>
              <h2>Site & Field Management (Admin)</h2>

              {/* Add New Site Form - Attach the ref */}
              <form ref={addSiteFormRef} onSubmit={handleAddSite} style={{ marginBottom: '1.5rem', padding: '1rem', border: '1px solid #ddd', borderRadius: '4px'}}>
                 <h3>Add New Site</h3>
                 <div>
                    <label htmlFor="siteName">Site Name:</label>
                    <input type="text" id="siteName" name="siteName" required />
                 </div>
                 <div style={{marginTop: '0.5rem'}}>
                    <label htmlFor="siteAddress">Address:</label>
                    <input type="text" id="siteAddress" name="siteAddress" />
                 </div>
                 <button type="submit" style={{marginTop: '1rem'}}>Add Site</button>
              </form>

               {/* Display Existing Sites and Fields */}
               <h3>Existing Sites & Fields</h3>
               {isLoadingSites || isLoadingFields ? (
                   <p>Loading sites and fields...</p>
               ) : sites.length === 0 ? (
                   <p>No sites created yet.</p>
               ) : (
                 <div className={styles.siteList}> {/* Use a class for potential styling */}
                   {sites.map(site => (
                     <div key={site.id} className={styles.siteCard} style={{border: '1px solid #ccc', padding: '1rem', marginBottom: '1rem', borderRadius: '4px'}}>
                       <h4>{site.name} {site.is_active ? '(Active)' : '(Inactive)'}</h4>
                       <p>{site.address || 'No address provided'}</p>

                       <h5>Fields at this site:</h5>
                       {getFieldsForSite(site.id).length === 0 ? (
                           <p>No fields added to this site yet.</p>
                       ) : (
                          <ul style={{ listStyle: 'disc', marginLeft: '2rem' }}>
                             {getFieldsForSite(site.id).map(field => (
                               <li key={field.id}>
                                  {field.name || 'Unnamed Field'} (ID: {field.id}) -
                                  Capacity: {field.capacity ?? 'N/A'},
                                  Type: {field.field_type || 'N/A'}
                               </li>
                             ))}
                          </ul>
                       )}

                        {/* Add New Field Form (for this site) */}
                        <form onSubmit={handleAddField} style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px dashed #eee' }}>
                          <h5>Add Field to {site.name}</h5>
                          {/* Hidden input to associate with the current site */}
                          <input type="hidden" name="fieldSiteId" value={site.id} />
                          <div>
                             <label htmlFor={`fieldName-${site.id}`}>Field Name:</label>
                             <input type="text" id={`fieldName-${site.id}`} name="fieldName" />
                          </div>
                          <div style={{marginTop: '0.5rem'}}>
                             <label htmlFor={`fieldCapacity-${site.id}`}>Capacity:</label>
                             <input type="number" id={`fieldCapacity-${site.id}`} name="fieldCapacity" min="0" />
                          </div>
                          <div style={{marginTop: '0.5rem'}}>
                             <label htmlFor={`fieldType-${site.id}`}>Field Type:</label>
                             <input type="text" id={`fieldType-${site.id}`} name="fieldType" placeholder="e.g., dog daycare, fitness" />
                          </div>
                          <button type="submit" style={{marginTop: '1rem'}}>Add Field</button>
                        </form>
                     </div>
                   ))}
                 </div>
               )}
            </section>
          )}
          {/* ----------------------------------------------- */}

          {/* --- Booking Management Section (Admin/Staff) --- */}
          {!isLoadingRole && (role === 'admin' || role === 'staff') && (
            <section style={{ marginTop: '2rem', borderTop: '1px solid #eee', paddingTop: '2rem' }}>
               <h2>Booking Management ({role})</h2>
               {error && <p style={{ color: 'red' }}>Error: {error}</p>}

               {/* Add New Booking Form */}
               <form ref={addBookingFormRef} onSubmit={handleAddBooking} style={{ marginBottom: '1.5rem', padding: '1rem', border: '1px solid #ddd', borderRadius: '4px'}}>
                 <h3>Add New Booking</h3>
                 {fields.length === 0 ? (
                    <p>No fields available. Please add fields via Site Management.</p>
                 ) : (
                   <>
                     <div>
                       <label htmlFor="bookingFieldId">Field:</label>
                       <select id="bookingFieldId" name="bookingFieldId" required>
                          <option value="">-- Select a Field --</option>
                          {/* Group fields by site for better UX */}
                          {sites.map(site => (
                             <optgroup key={site.id} label={site.name}>
                                {getFieldsForSite(site.id).map(field => (
                                   <option key={field.id} value={field.id}>
                                      {field.name || `Field ID ${field.id}`}
                                   </option>
                                ))}
                             </optgroup>
                          ))}
                       </select>
                     </div>
                     <div style={{marginTop: '0.5rem'}}>
                        <label htmlFor="bookingStartTime">Start Time:</label>
                        <input type="datetime-local" id="bookingStartTime" name="bookingStartTime" required />
                     </div>
                     <div style={{marginTop: '0.5rem'}}>
                        <label htmlFor="bookingEndTime">End Time:</label>
                        <input type="datetime-local" id="bookingEndTime" name="bookingEndTime" required />
                     </div>
                     <div style={{marginTop: '0.5rem'}}>
                        <label htmlFor="bookingServiceType">Service Type:</label>
                        <input type="text" id="bookingServiceType" name="bookingServiceType" placeholder="e.g., dog daycare, private rental" />
                     </div>
                     <div style={{marginTop: '0.5rem'}}>
                        <label htmlFor="bookingMaxCapacity">Max Capacity (Optional):</label>
                        <input type="number" id="bookingMaxCapacity" name="bookingMaxCapacity" min="0" />
                     </div>
                     <button type="submit" style={{marginTop: '1rem'}}>Add Booking</button>
                   </>
                 )}
               </form>

                {/* Display Existing Bookings */}
               <h3>Existing Bookings</h3>
                {isLoadingBookings ? (
                   <p>Loading bookings...</p>
                ) : bookings.length === 0 ? (
                   <p>No bookings found.</p>
                ) : (
                   <div className={styles.bookingList}> {/* Use a class for styling */}
                      {bookings.map(booking => (
                         <div key={booking.id} className={styles.bookingCard} style={{ border: '1px solid #eee', padding: '0.8rem', marginBottom: '0.8rem', borderRadius: '4px' }}>
                           <p>
                              <strong>Field ID:</strong> {booking.field_id} |
                              <strong>Service:</strong> {booking.service_type || 'N/A'} |
                              <strong>Status:</strong> {booking.status}
                           </p>
                           <p>
                              <strong>From:</strong> {new Date(booking.start_time).toLocaleString()} |
                              <strong>To:</strong> {new Date(booking.end_time).toLocaleString()}
                           </p>
                           {booking.max_capacity !== null && (
                              <p><strong>Max Capacity:</strong> {booking.max_capacity}</p>
                           )}
                           {/* Add buttons for Edit/Cancel later? */}
                         </div>
                      ))}
                   </div>
                )}
            </section>
          )}
           {/* ----------------------------------------- */}

          {/* --- Service Management (Admin Only) --- */}
          {!isLoadingRole && role === 'admin' && (
             <section style={{ marginTop: '2rem', borderTop: '1px solid #eee', paddingTop: '2rem' }}>
               <h2>Service Management (Admin)</h2>
                {error && <p style={{ color: 'red' }}>Error: {error}</p>}

                {/* Add New Service Form */}
                <form ref={addServiceFormRef} onSubmit={handleAddService} style={{ marginBottom: '1.5rem', padding: '1rem', border: '1px solid #ddd', borderRadius: '4px'}}>
                   <h3>Add New Service</h3>
                   <div>
                      <label htmlFor="serviceName">Service Name:</label>
                      <input type="text" id="serviceName" name="serviceName" required placeholder="e.g., Doggy Daycare AM, Full Day Field Hire" />
                   </div>
                   <div style={{marginTop: '0.5rem'}}>
                      <label htmlFor="serviceDescription">Description:</label>
                      <textarea id="serviceDescription" name="serviceDescription" rows={3}></textarea>
                   </div>
                   <button type="submit" style={{marginTop: '1rem'}}>Add Service</button>
                </form>

                 {/* Display Existing Services */}
                <h3>Existing Services</h3>
                {isLoadingServices ? (
                   <p>Loading services...</p>
                ) : services.length === 0 ? (
                   <p>No services defined yet.</p>
                ) : (
                   <ul style={{ listStyle: 'none', padding: 0 }}>
                      {services.map(service => (
                         <li key={service.id} style={{ border: '1px solid #eee', padding: '0.8rem', marginBottom: '0.5rem', borderRadius: '4px' }}>
                            <strong>{service.name}</strong> (ID: {service.id})
                            <p style={{ margin: '0.3rem 0 0 0', fontSize: '0.9em', color: '#555' }}>
                               {service.description || 'No description'}
                            </p>
                            {/* Add Edit/Delete later */}
                         </li>
                      ))}
                   </ul>
                )}
             </section>
           )}
           {/* ----------------------------------------- */}

           {/* --- Service Availability Management (Admin Only) --- */}
           {!isLoadingRole && role === 'admin' && (
             <section style={{ marginTop: '2rem', borderTop: '1px solid #eee', paddingTop: '2rem' }}>
                <h2>Service Availability Rules (Admin)</h2>
                 {error && <p style={{ color: 'red' }}>Error: {error}</p>}

                 {/* Add New Availability Rule Form */}
                 <form ref={addServiceAvailabilityFormRef} onSubmit={handleAddServiceAvailability} style={{ marginBottom: '1.5rem', padding: '1rem', border: '1px solid #ddd', borderRadius: '4px'}}>
                   <h3>Add New Availability Rule</h3>
                   {(services.length === 0 || fields.length === 0) ? (
                     <p>Please add Services and Fields before defining availability.</p>
                   ) : (
                     <>
                       <div>
                         <label htmlFor="availabilityServiceId">Service:</label>
                         <select id="availabilityServiceId" name="availabilityServiceId" required>
                            <option value="">-- Select Service --</option>
                            {services.map(service => (
                               <option key={service.id} value={service.id}>{service.name}</option>
                            ))}
                         </select>
                       </div>
                       {/* Multi-Field Selection */}
                       <div style={{marginTop: '0.5rem'}}>
                         <label>Applies to Field(s):</label>
                         {sites.map(site => (
                           <div key={`avail-site-group-${site.id}`} style={{ marginLeft: '1rem', marginBottom: '0.5rem' }}>
                             <strong>{site.name}</strong>
                             {getFieldsForSite(site.id).map(field => (
                               <div key={`avail-field-chk-${field.id}`} style={{ marginLeft: '1rem' }}>
                                 <input type="checkbox" id={`availField-${field.id}`} name="availabilityFieldIds" value={field.id} />
                                 <label htmlFor={`availField-${field.id}`}>{field.name || `Field ID ${field.id}`}</label>
                               </div>
                             ))}
                           </div>
                         ))}
                       </div>
                       {/* Time, Recurrence, Capacity, Active Inputs */}
                       <div style={{marginTop: '0.5rem'}}>
                         <label htmlFor="availabilityStartTime">Start Time:</label>
                         <input type="time" id="availabilityStartTime" name="availabilityStartTime" required />
                       </div>
                       <div style={{marginTop: '0.5rem'}}>
                         <label htmlFor="availabilityEndTime">End Time:</label>
                         <input type="time" id="availabilityEndTime" name="availabilityEndTime" required />
                       </div>
                        <div style={{marginTop: '0.5rem'}}>
                         <label htmlFor="availabilityBaseCapacity">Base Capacity (Optional):</label>
                         <input type="number" id="availabilityBaseCapacity" name="availabilityBaseCapacity" min="0" placeholder="Defaults to field capacity" />
                       </div>
                       <div style={{marginTop: '0.5rem'}}>
                           <label>Recurring Days (Mon-Sun):</label>
                           <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', marginLeft: '1rem' }}>
                              {[
                                 { label: 'Mon', value: 1 }, { label: 'Tue', value: 2 }, { label: 'Wed', value: 3 },
                                 { label: 'Thu', value: 4 }, { label: 'Fri', value: 5 }, { label: 'Sat', value: 6 },
                                 { label: 'Sun', value: 7 },
                              ].map(day => (
                                 <div key={`avail-day-${day.value}`}>
                                    <input type="checkbox" id={`availabilityDayOfWeek-${day.value}`} name={`availabilityDayOfWeek-${day.value}`} />
                                    <label htmlFor={`availabilityDayOfWeek-${day.value}`}>{day.label}</label>
                                 </div>
                              ))}
                           </div>
                       </div>
                       <div style={{marginTop: '0.5rem'}}>
                           <label htmlFor="availabilitySpecificDate">Specific Date (Optional):</label>
                           <input type="date" id="availabilitySpecificDate" name="availabilitySpecificDate" placeholder="Leave blank if recurring" />
                       </div>
                       <div style={{marginTop: '0.5rem'}}>
                         <label htmlFor="availabilityIsActive">Is Active:</label>
                         <input type="checkbox" id="availabilityIsActive" name="availabilityIsActive" defaultChecked />
                       </div>
                       <button type="submit" style={{marginTop: '1rem'}}>Add Availability Rule</button>
                     </>
                   )}
                 </form>

                {/* Display Existing Availability Rules */}
                <h3>Existing Availability Rules</h3>
                {isLoadingServiceAvailability ? (
                   <p>Loading availability rules...</p>
                ) : serviceAvailability.length === 0 ? (
                   <p>No availability rules defined yet.</p>
                ) : (
                   <div className={styles.availabilityList}>
                      {serviceAvailability.map(rule => (
                         <div key={rule.id} className={styles.availabilityCard} style={{ border: '1px solid #eee', padding: '0.8rem', marginBottom: '0.8rem', borderRadius: '4px' }}>
                            <p>
                               {/* Find service name - ideally join in API later */}
                               <strong>Service ID:</strong> {rule.service_id} |
                               <strong>Fields:</strong> {rule.field_ids.join(', ')} |
                               <strong>Active:</strong> {rule.is_active ? 'Yes' : 'No'}
                            </p>
                             <p>
                               <strong>Time:</strong> {rule.start_time} - {rule.end_time} |
                               <strong>Recurrence:</strong>
                               {rule.days_of_week && rule.days_of_week.length > 0 ? `Days: ${rule.days_of_week.join(', ')} (Mon=1)` : rule.specific_date ? `${rule.specific_date}` : 'None specified'}
                            </p>
                             <p><strong>Base Capacity:</strong> {rule.base_capacity ?? 'Field Default'}</p>
                           {/* Add Edit/Delete later */}
                         </div>
                      ))}
                   </div>
                )}
             </section>
           )}
           {/* ------------------------------------------------ */}

        </main>
      )}
    </div>
  );
}
