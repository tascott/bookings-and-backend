'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import type { User } from '@supabase/supabase-js';
import styles from "./page.module.css";
import { login, signup } from './actions';
import AuthForm from '@/components/AuthForm';
import AdminDashboard from '@/components/admin/AdminDashboard';
import StaffDashboard from '@/components/staff/StaffDashboard';
import ClientDashboard from '@/components/client/ClientDashboard';

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [isLoadingInitial, setIsLoadingInitial] = useState(true);
  const [isLoadingRole, setIsLoadingRole] = useState(false);
  const [error, setError] = useState<string | null>(null); // Keep error for auth/role fetching
  const [firstName, setFirstName] = useState<string | null>(null);
  const [lastName, setLastName] = useState<string | null>(null);
  const supabase = createClient();

  const fetchUserRole = async (userId: string) => {
    setIsLoadingRole(true);
    setRole(null);
    setError(null); // Clear previous errors when fetching role
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
      console.warn(`User ${userId} not found in staff or clients table.`); // Add warning
      return null;
    } catch (err) {
      // Log unexpected errors (like connection issues, RLS problems)
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
      console.error("Error fetching user role:", err);
      setError(`Error fetching user role: ${errorMessage}`); // Set error state
      return null;
    } finally {
      setIsLoadingRole(false);
    }
  };

  // Removed fetchAllUsers function

  // Effect 1: Check auth state and fetch profile
  useEffect(() => {
    const checkUserAndProfile = async (currentUser: User | null) => {
       if (currentUser) {
         // Fetch profile details after getting user
         const { data: profile, error: profileError } = await supabase
           .from('profiles')
           .select('first_name, last_name')
           .eq('user_id', currentUser.id)
           .single();

         if (profileError) {
           console.error("Error fetching profile:", profileError);
           // Don't block rendering, just won't have name
           setFirstName(null);
           setLastName(null);
         } else if (profile) {
           setFirstName(profile.first_name);
           setLastName(profile.last_name);
         } else {
           // Profile might not exist yet
           console.warn(`Profile not found for user ${currentUser.id}`);
           setFirstName(null);
           setLastName(null);
         }
       } else {
         // No user, clear profile state
         setFirstName(null);
         setLastName(null);
       }
    };

    // Initial check
    supabase.auth.getUser().then(({ data: { user }, error: userError }) => {
        setUser(user);
        if (userError) {
            // Only log error if it's *not* an expected session missing error
            if (userError.name !== 'AuthSessionMissingError') {
                console.error("Error fetching user on initial load:", userError);
            } else {
                // Optionally log that the user is not logged in, or do nothing
                console.log("Initial load: No active session found.");
            }
        }
        checkUserAndProfile(user).finally(() => {
            setIsLoadingInitial(false); // Set initial loading false after user and profile check
        });
    });


    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      const newUser = session?.user ?? null;
      const previousUser = user; // Capture previous user state for comparison
      setUser(newUser);

      // --- Logic to Send Welcome Email on First Sign In ---
      // Check if user changed from null to a valid user (first sign in)
      if (!previousUser && newUser) {
          console.log('First sign-in detected, attempting to send welcome email for:', newUser.email);

          // Fetch profile data again here to pass to API, or rely on previous fetch
          // Let's re-fetch to be sure we pass current data, including the flag
          supabase
            .from('profiles')
            // Fetch first_name AND welcome_email_sent
            .select('first_name, welcome_email_sent')
            .eq('user_id', newUser.id)
            .single()
            .then(({ data: profileData, error: profileError }) => {
                if (profileError) {
                    console.error('Error fetching profile during welcome email check:', profileError);
                    // Don't proceed if we can't check the flag
                    return;
                }

                // Check if email was already sent
                if (profileData?.welcome_email_sent) {
                    console.log(`Welcome email already sent for ${newUser.email}, skipping.`);
                    return;
                }

                // Trigger the API call
                fetch('/api/send-welcome-email', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        email: newUser.email,
                        firstName: profileData?.first_name, // Pass first name if available
                    }),
                })
                .then(async (res) => {
                    if (!res.ok) {
                        const errorBody = await res.json();
                        console.error('Error response from /api/send-welcome-email:', errorBody);
                    } else {
                        console.log('Successfully triggered welcome email API for:', newUser.email);
                        // --- Mark email as sent in DB ---
                        fetch('/api/mark-welcome-sent', { method: 'POST' })
                          .then(async (markRes) => {
                              if (!markRes.ok) {
                                  const markErrorBody = await markRes.json();
                                  console.error('Error response from /api/mark-welcome-sent:', markErrorBody);
                              } else {
                                  console.log(`Successfully marked welcome email sent for ${newUser.email} in DB.`);
                              }
                          })
                          .catch((markFetchError) => {
                              console.error('Fetch error calling /api/mark-welcome-sent:', markFetchError);
                          });
                        // --- End marking email as sent ---
                    }
                })
                .catch((fetchError) => {
                    console.error('Fetch error calling /api/send-welcome-email:', fetchError);
                });
            });
      }
      // --- End Welcome Email Logic ---

      // Only reset dependent state if the user actually changed (login/logout)
      if (newUser?.id !== previousUser?.id) {
          console.log('Auth state changed, resetting role and profile.');
          setRole(null);
          setError(null);
          setIsLoadingRole(false);
          // Fetch profile for the new user or clear it
          checkUserAndProfile(newUser);
      } else {
          // If only session refreshed, user is the same, don't reset role/profile
          console.log('Auth session refreshed, user unchanged.');
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase]); // Depend only on supabase client instance

  // Effect 2: Fetch role after user state is confirmed
  useEffect(() => {
    if (user && !role && !isLoadingRole) { // Fetch role only if we have a user but no role yet, and not already loading
      console.log(`User ${user.id} logged in, fetching role...`);
      fetchUserRole(user.id).then(fetchedRole => {
        console.log(`Role fetched for user ${user.id}: ${fetchedRole}`);
        setRole(fetchedRole);
      });
    } else if (!user) {
      // Clear role if user logs out
      setRole(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, role, isLoadingRole]); // Depend on user object, role, and loading state

  const handleLogout = async () => {
    const { error: signOutError } = await supabase.auth.signOut(); // Renamed error variable
    if (signOutError) {
      console.error('Error logging out:', signOutError);
      setError('Failed to log out.');
    } else {
      // No need to clear state manually, onAuthStateChange handles it
       // Clear the URL parameters after successful logout (optional, good practice)
       window.history.replaceState({}, '', '/');
    }
  };

  // Helper to display user name or email (Keep this)
  const getUserDisplayName = () => {
    if (firstName || lastName) {
      return `${firstName || ''} ${lastName || ''}`.trim();
    }
    return user?.email || 'User'; // Fallback to email or generic 'User'
  };

  if (isLoadingInitial) {
    return <div>Loading application...</div>; // More descriptive loading message
  }

  return (
    <div className={styles.page}>
      <header>
        <h1>Booking & Accounts</h1>
        {user ? (
          <div>
            <p>
              Welcome, {getUserDisplayName()}!
              {isLoadingRole ? (
                <span> (Checking role...)</span>
              ) : (
                 // Display role or indicate if no role assigned
                role ? <span> (Role: {role})</span> : <span> (Role not assigned)</span>
              )}
            </p>
            <button onClick={handleLogout}>Logout</button>
          </div>
        ) : (
          <p>Please log in or sign up.</p>
        )}
        {/* Display auth/role errors in the header */}
        {error && <p className={styles.error}>Error: {error}</p>}
      </header>

      {!user && !isLoadingInitial && ( // Show AuthForm only when not logged in and initial load is done
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
                // Pass only necessary props, AdminDashboard will fetch its own data
                <AdminDashboard
                  user={user}
                />
              )}

              {role === 'staff' && (
                 // Pass only necessary props, StaffDashboard will fetch its own data
                <StaffDashboard
                  user={user}
                />
              )}

              {role === 'client' && (
                 // Pass only necessary props, ClientDashboard will fetch its own data
                <ClientDashboard
                  user={user}
                  // Removed props: services
                />
              )}

              {/* Handle case where user is logged in but has no role */}
              {role === null && !isLoadingRole && (
                <div>
                  <p>Your account is not currently assigned a role (staff or client). Please contact an administrator.</p>
                </div>
              )}
            </>
          )}
        </main>
      )}
    </div>
  );
}
