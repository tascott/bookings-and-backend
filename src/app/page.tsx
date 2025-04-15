'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
// Remove Auth UI imports
// import { Auth } from '@supabase/auth-ui-react';
// import { ThemeSupa } from '@supabase/auth-ui-shared';
import type { User } from '@supabase/supabase-js';
import styles from "./page.module.css";
// Import server actions
import { login, signup } from './actions';

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
  const supabase = createClient();

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
        </main>
      )}
    </div>
  );
}
