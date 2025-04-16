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
  const supabase = createClient();

  // Create a ref for the Add Site form
  const addSiteFormRef = useRef<HTMLFormElement>(null);

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
    if (role === 'admin') {
      fetchSites();
      fetchFields();
    } else {
      // Clear site/field data if user is not admin
      setSites([]);
      setFields([]);
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

        </main>
      )}
    </div>
  );
}
