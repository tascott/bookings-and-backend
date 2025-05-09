'use client';

import React, { useEffect, useState } from 'react';
import { createClient } from '@booking-and-accounts-monorepo/utils';
import type { User } from '@supabase/supabase-js';
// import { cookies } from 'next/headers'; // Removed unused
// import { redirect } from 'next/navigation'; // Removed unused
// import { useRouter } from 'next/navigation'; // Removed unused
import styles from "./page.module.css";
import { login, signup } from './actions';
import AuthForm from '@/components/AuthForm';
import AdminDashboard from '@/components/admin/AdminDashboard';
import StaffDashboard from '@/components/staff/StaffDashboard';
import ClientDashboard from '@/components/client/ClientDashboard';

// Define UserRole type locally
type UserRole = 'admin' | 'staff' | 'client' | null | 'loading';

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  // const [profile, setProfile] = useState<UserProfile | null>(null); // Removed unused state
  const [role, setRole] = useState<UserRole>('loading'); // Use defined UserRole type
  const [theme, setTheme] = useState('light'); // Add theme state, default light
  const [isLoadingInitial, setIsLoadingInitial] = useState(true);
  const [isLoadingRole, setIsLoadingRole] = useState(false);
  // const [error, setError] = useState<string | null>(null); // Removed unused error state
  const [firstName, setFirstName] = useState<string | null>(null);
  const [lastName, setLastName] = useState<string | null>(null);
  const [businessType, setBusinessType] = useState<string | null>(null); // <-- State remains
  const supabase = createClient();
  // const router = useRouter(); // Removed unused variable

  const fetchUserRole = async (userId: string) => {
    setIsLoadingRole(true);
    setRole(null);
    // const [error, setError] = useState<string | null>(null); // Removed unused error state
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
      // const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.'; // Removed unused variable
      console.error("Error fetching user role:", err);
      // const [error, setError] = useState<string | null>(null); // Removed unused error state
      return null;
    } finally {
      setIsLoadingRole(false);
    }
  };

  // Removed fetchAllUsers function

  // Effect 0: Load theme from local storage on mount
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') || 'light';
    setTheme(savedTheme);
    // Add class to body for global styling access if needed, though page-level is often sufficient
    document.body.className = savedTheme;
  }, []);

  // Effect 1: Check auth state and fetch profile/affiliations
  useEffect(() => {
    // --- UPDATED: Function to fetch profile and affiliations ---
    const fetchProfileAndAffiliations = async (currentUser: User | null) => {
       if (currentUser) {
         // Fetch profile details (first name, last name)
         const { data: profile, error: profileError } = await supabase
           .from('profiles')
           .select('first_name, last_name') // Removed business_type
           .eq('user_id', currentUser.id)
           .single();

         if (profileError) {
           console.error("Error fetching profile:", profileError);
           setFirstName(null);
           setLastName(null);
         } else if (profile) {
           setFirstName(profile.first_name);
           setLastName(profile.last_name);
         } else {
           console.warn(`Profile not found for user ${currentUser.id}`);
           setFirstName(null);
           setLastName(null);
         }

         // Fetch business affiliations
         const { data: affiliations, error: affiliationError } = await supabase
           .from('user_business_affiliations')
           .select('business_type')
           .eq('user_id', currentUser.id);

         if (affiliationError) {
           console.error("Error fetching business affiliations:", affiliationError);
           setBusinessType(null);
         } else if (affiliations && affiliations.length > 0) {
           // Prioritize 'Pet Services' for this app's context
           const hasPetServices = affiliations.some(aff => aff.business_type === 'Pet Services');
           if (hasPetServices) {
             setBusinessType('Pet Services');
           } else {
             // Fallback if no 'Pet Services' (shouldn't happen for this app)
             setBusinessType(affiliations[0].business_type);
           }
         } else {
           console.warn(`No business affiliations found for user ${currentUser.id}`);
           setBusinessType(null);
         }

       } else {
         // No user, clear profile and affiliation state
         setFirstName(null);
         setLastName(null);
         setBusinessType(null);
       }
    };
    // --- END UPDATED FUNCTION ---

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
        // --- Use updated function ---
        fetchProfileAndAffiliations(user).finally(() => {
            setIsLoadingInitial(false);
        });
        // --- END ---
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
          // const [error, setError] = useState<string | null>(null); // Removed unused error state
          setIsLoadingRole(false);
          setFirstName(null); // Clear name state
          setLastName(null); // Clear name state
          setBusinessType(null); // Clear business type state
          // --- Use updated function ---
          fetchProfileAndAffiliations(newUser);
          // --- END ---
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

  // Function to toggle theme
  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    document.body.className = newTheme; // Update body class as well
  };

  const handleLogout = async () => {
    const { error: signOutError } = await supabase.auth.signOut(); // Renamed error variable
    if (signOutError) {
      console.error('Error logging out:', signOutError);
      // const [error, setError] = useState<string | null>(null); // Removed unused error state
       // Clear the URL parameters after successful logout (optional, good practice)
       window.history.replaceState({}, '', '/');
    } else {
      // No need to clear state manually, onAuthStateChange handles it
    }
  };

  // Helper to display user name or email (Keep this)
  const getUserDisplayName = () => {
    if (firstName || lastName) {
      return `${firstName || ''} ${lastName || ''}`.trim();
    }
    return user?.email || 'User'; // Fallback to email or generic 'User'
  };

  // Wrap header content in a div with a class for styling
  const renderHeader = () => (
    <div className="page-header">
      <h1>Bonnies</h1>
      <div className="header-controls">
        {user && (
          <div className="user-info">
            <p>
              Welcome, {getUserDisplayName()}
              {isLoadingRole ? (
                <span> (Checking role...)</span>
              ) : (
                 // Display role or indicate if no role assigned
                role ? <span> (Role: {role})</span> : <span> (Role not assigned)</span>
              )}
              {/* --- ADDED: Display Business Type --- */}
              {businessType && <span> ({businessType})</span>}
              {/* --- END ADDED --- */}
            </p>
            <button onClick={handleLogout} className="button secondary">Logout</button>
          </div>
        )}
        <button
          onClick={toggleTheme}
          className="theme-icon-toggle"
          title={`Switch to ${theme === 'light' ? 'Dark' : 'Light'} Mode`}
          aria-label={`Switch to ${theme === 'light' ? 'Dark' : 'Light'} Mode`}
        >
          {theme === 'light' ? '🌙' : '☀️'}
        </button>
      </div>
    </div>
  );

  if (isLoadingInitial) {
    return <div>Loading application...</div>; // More descriptive loading message
  }

  return (
    <div className={`${styles.page} ${theme}`}>
      {/* Render header outside the form/dashboard logic if user might be logged in */}
      {renderHeader()}

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
                <AdminDashboard />
              )}

              {role === 'staff' && (
                 // Pass only necessary props, StaffDashboard will fetch its own data
                <StaffDashboard />
              )}

              {role === 'client' && (
                 // Pass only necessary props, ClientDashboard will fetch its own data
                <ClientDashboard businessType={businessType} />
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
