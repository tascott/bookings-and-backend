import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, ScrollView } from 'react-native';
import { RouteProp } from '@react-navigation/native';
import { StaffTabParamList } from '../../navigation/StaffTabNavigator'; // To get userId
import { supabase } from '../../services/supabaseClient';
import type { Staff, Profile } from '@booking-and-accounts-monorepo/shared-types';

// Define route prop for this screen to get userId
type MyProfileScreenRouteProp = RouteProp<StaffTabParamList, 'MyProfile'>;

interface Props {
  route: MyProfileScreenRouteProp;
}

// Helper type for combined Staff and Profile data
interface StaffProfile extends Staff, Omit<Profile, 'user_id'> {
  email?: string; // Email might come from auth user, not directly from profile/staff table
}

const MyProfileScreen: React.FC<Props> = ({ route }) => {
  const { userId } = route.params;
  const [staffProfile, setStaffProfile] = useState<StaffProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    console.log('MyProfileScreen userId:', userId);

    const fetchStaffProfile = async () => {
      if (!userId) {
        setError('User ID not provided');
        setIsLoading(false);
        return;
      }
      console.log('[MyProfileScreen] Setting isLoading to true');
      setIsLoading(true);
      setError(null);
      try {
        console.log(`[MyProfileScreen] Attempting to fetch staff data for userId: ${userId}`);
        const { data: staffData, error: staffError } = await supabase
          .from('staff')
          .select('*, profiles (*)')
          .eq('user_id', userId)
          .single();

        console.log(`[MyProfileScreen] Staff fetch complete. Has staffData: ${!!staffData}. Has staffError: ${!!staffError}`);
        if (staffData) console.log('[MyProfileScreen] staffData:', JSON.stringify(staffData, null, 2));
        if (staffError) console.log('[MyProfileScreen] staffError:', JSON.stringify(staffError, null, 2));

        if (!isMounted) {
            console.log('[MyProfileScreen] Component unmounted after staff fetch');
            return;
        }

        if (staffError) {
          console.warn(`[MyProfileScreen] staffError encountered. Message: ${staffError.message}, Code: ${staffError.code}`);
          if (staffError.code === 'PGRST116') {
            throw new Error('Staff profile not found.');
          } else {
            throw staffError;
          }
        }
        if (!staffData) {
            console.warn('[MyProfileScreen] staffData is null/undefined after successful fetch.');
            throw new Error('Staff data not found (null/undefined after fetch)');
        }
        console.log(`[MyProfileScreen] staffData.profiles (before cast): ${staffData.profiles ? JSON.stringify(staffData.profiles, null, 2) : 'null/undefined'}`);

        console.log('[MyProfileScreen] Attempting to fetch auth user');
        const { data: { user }, error: userError } = await supabase.auth.getUser();

        console.log(`[MyProfileScreen] Auth user fetch complete. User email: ${user?.email ?? 'No user or email'}`);
        if (userError) console.log('[MyProfileScreen] Auth user error:', JSON.stringify(userError, null, 2));

        if (!isMounted) {
            console.log('[MyProfileScreen] Component unmounted after auth user fetch');
            return;
        }
        if (userError) {
          console.warn(`[MyProfileScreen] Error fetching auth user (non-fatal). Message: ${userError.message}`);
        }

        const profile = staffData.profiles as Profile | null;
        console.log(`[MyProfileScreen] 'profile' variable (after cast from staffData.profiles): ${profile ? JSON.stringify(profile, null, 2) : 'null/undefined'}`);

        const combinedData: StaffProfile = {
          ...staffData,
          first_name: profile?.first_name || null,
          last_name: profile?.last_name || null,
          phone: profile?.phone || null,
          email_allow_promotional: profile?.email_allow_promotional || null,
          email_allow_informational: profile?.email_allow_informational || null,
          address_line_1: profile?.address_line_1 || null,
          address_line_2: profile?.address_line_2 || null,
          town_or_city: profile?.town_or_city || null,
          county: profile?.county || null,
          postcode: profile?.postcode || null,
          country: profile?.country || null,
          latitude: profile?.latitude || null,
          longitude: profile?.longitude || null,
          email: user?.email || null,
        };
        console.log('[MyProfileScreen] Combined data prepared:', JSON.stringify(combinedData, null, 2));

        setStaffProfile(combinedData);
        console.log('[MyProfileScreen] setStaffProfile called.');

      } catch (err: any) {
        console.error(`[MyProfileScreen] Error in fetchStaffProfile try block. Message: ${err.message}, Stack: ${err.stack}`);
        if (isMounted) {
          setError(err.message || 'Failed to load profile');
        }
      } finally {
        console.log('[MyProfileScreen] Entering finally block.');
        if (isMounted) {
          console.log('[MyProfileScreen] Setting isLoading to false in finally block.');
          setIsLoading(false);
        }
      }
    };

    fetchStaffProfile();

    return () => { isMounted = false; };
  }, [userId]);

  if (isLoading) {
    return <View style={styles.centered}><ActivityIndicator size="large" /><Text>Loading profile...</Text></View>;
  }

  if (error) {
    return <View style={styles.centered}><Text style={styles.errorText}>{error}</Text></View>;
  }

  if (!staffProfile) {
    return <View style={styles.centered}><Text>Profile information not available.</Text></View>;
  }

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.header}>My Profile</Text>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Personal Information</Text>
        <Text style={styles.label}>Name:</Text>
        <Text style={styles.value}>{staffProfile.first_name || ''} {staffProfile.last_name || ''}</Text>

        <Text style={styles.label}>Email:</Text>
        <Text style={styles.value}>{staffProfile.email || 'N/A'}</Text>

        <Text style={styles.label}>Phone:</Text>
        <Text style={styles.value}>{staffProfile.phone || 'N/A'}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Role & Responsibilities</Text>
        <Text style={styles.label}>Role:</Text>
        <Text style={styles.value}>{staffProfile.role || 'N/A'}</Text>
        {staffProfile.notes && (
          <>
            <Text style={styles.label}>Notes:</Text>
            <Text style={styles.value}>{staffProfile.notes}</Text>
          </>
        )}
      </View>

      {/* TODO: Add Address Section if needed */}
      {/* TODO: Add Email Preferences Section if needed */}
      {/* TODO: Add Logout Button */}

    </ScrollView>
  );
};

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  container: {
    flex: 1,
    padding: 20,
  },
  header: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  section: {
    marginBottom: 20,
    padding: 15,
    backgroundColor: '#fff',
    borderRadius: 8,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
  },
  label: {
    fontSize: 14,
    color: '#555',
    marginTop: 5,
  },
  value: {
    fontSize: 16,
    color: '#333',
    marginBottom: 10,
  },
  errorText: {
    color: 'red',
    fontSize: 16,
    textAlign: 'center',
  },
});

export default MyProfileScreen;