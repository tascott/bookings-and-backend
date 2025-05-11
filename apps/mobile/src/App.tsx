import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { supabase } from './services/supabaseClient';
import { Session, AuthChangeEvent, User } from '@supabase/supabase-js';

import LoginScreen from './screens/LoginScreen';
import SignUpScreen from './screens/SignUpScreen';
import StaffDashboardScreen from './screens/StaffDashboardScreen';
import ClientDashboardScreen from './screens/ClientDashboardScreen';
import HomeScreen from './screens/HomeScreen';

export type RootStackParamList = {
  Login: undefined;
  SignUp: undefined;
  StaffDashboard: undefined;
  ClientDashboard: undefined;
  Home: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

// UserProfile type might not be directly from one table now
// We are primarily interested in the role string.

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const determineUserRole = async (currentUser: User | null) => {
      if (!currentUser) {
        setUserRole(null);
        return;
      }

      try {
        // 1. Check if user is in the 'staff' table
        const { data: staffProfile, error: staffError } = await supabase
          .from('staff')
          .select('role') // Select the role column from staff table
          .eq('user_id', currentUser.id)
          .single();

        if (staffError && staffError.code !== 'PGRST116') { // PGRST116: 0 rows
          console.error('Error fetching staff profile:', staffError.message);
          setUserRole(null);
          return;
        }
        if (staffProfile) {
          setUserRole(staffProfile.role); // Role from staff table
          return;
        }

        // 2. If not in staff, check if user is in the 'clients' table
        const { data: clientProfile, error: clientError } = await supabase
          .from('clients')
          .select('user_id') // Just need to check existence
          .eq('user_id', currentUser.id)
          .maybeSingle(); // Use maybeSingle as client might not exist

        if (clientError && clientError.code !== 'PGRST116') {
          console.error('Error fetching client profile:', clientError.message);
          setUserRole(null);
          return;
        }
        if (clientProfile) {
          setUserRole('client'); // Infer role as 'client'
          return;
        }

        // 3. If not in staff or clients, role is undetermined
        console.warn('User not found in staff or clients table:', currentUser.id);
        setUserRole(null); // Or a default role like 'guest' or 'pending_setup'

      } catch (e) {
        console.error('Exception determining user role:', e);
        setUserRole(null);
      }
    };

    // Initial session check
    supabase.auth.getSession().then(async ({ data: { session: initialSession } }) => {
      setSession(initialSession);
      await determineUserRole(initialSession?.user || null);
      setLoading(false);
    });

    // Listen to auth state changes
    const { data: { subscription: authSubscription } } = supabase.auth.onAuthStateChange(
      async (_event: AuthChangeEvent, currentSession: Session | null) => {
        setSession(currentSession);
        await determineUserRole(currentSession?.user || null);
        if (loading) setLoading(false);
      }
    );

    return () => {
      authSubscription?.unsubscribe();
    };
  }, [loading]);

  if (loading) {
    return null;
  }

  return (
    <NavigationContainer>
      <Stack.Navigator>
        {session && session.user ? (
          userRole === 'staff' ? (
            <Stack.Screen
              name="StaffDashboard"
              component={StaffDashboardScreen}
              options={{ title: 'Staff Dashboard' }}
            />
          ) : userRole === 'client' ? (
            <Stack.Screen
              name="ClientDashboard"
              component={ClientDashboardScreen}
              options={{ title: 'Client Dashboard' }}
            />
          ) : (
            <Stack.Screen
              name="Home"
              component={HomeScreen}
              options={{ title: 'Welcome (Role Undetermined)' }} // Updated title for clarity
            />
          )
        ) : (
          <>
            <Stack.Screen
              name="Login"
              component={LoginScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="SignUp"
              component={SignUpScreen}
              options={{ title: 'Create Account' }}
            />
          </>
        )}
      </Stack.Navigator>
      <StatusBar style="auto" />
    </NavigationContainer>
  );
}
