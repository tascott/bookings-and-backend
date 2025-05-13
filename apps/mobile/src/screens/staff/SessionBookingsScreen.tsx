import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity } from 'react-native';
import { fetchBookingsDirect } from '@booking-and-accounts-monorepo/api-services/bookingService';
import { supabase } from '../../services/supabaseClient';
import type { Booking } from '@booking-and-accounts-monorepo/shared-types';
import { RouteProp, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { StaffTabParamList } from '../../navigation/StaffTabNavigator';

// Define the Stack param list used in this part of the navigation
// This should match the one defined in StaffTabNavigator or include the relevant parts
type BookingStackParamList = {
  BookingManagement: { userId: string };
  SessionBookings: { userId: string; dateKey: string; session: string };
  ClientDetails: { clientId: string }; // Include ClientDetails screen params
};

// Route params for this screen
interface SessionBookingsScreenRouteParams {
  userId: string;
  dateKey: string; // 'YYYY-MM-DD'
  session: string;
}

// Define the navigation prop type using the Stack param list
type SessionBookingsNavigationProp = NativeStackNavigationProp<BookingStackParamList, 'SessionBookings'>;

// Update RouteProp to use the extended BookingStackParamList
type SessionBookingsScreenRouteProp = RouteProp<BookingStackParamList, 'SessionBookings'>;

interface Props {
  route: SessionBookingsScreenRouteProp;
}

const SessionBookingsScreen: React.FC<Props> = ({ route }) => {
  const { userId, dateKey, session } = route.params;
  const navigation = useNavigation<SessionBookingsNavigationProp>(); // Get navigation object
  console.log('SessionBookingsScreen Params:', { userId, dateKey, session }); // Log received params
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);
    setError(null);
    console.log('Fetching all bookings for user:', userId); // Log fetch start
    fetchBookingsDirect(supabase, { assigned_staff_id: userId })
      .then(data => {
        if (isMounted) {
          console.log('Fetched total bookings:', data?.length ?? 0); // Log total fetched
          // Filter bookings for this date and session
          const filtered = (data || []).filter(b =>
            b.start_time.slice(0, 10) === dateKey && (b.service_type || 'Session') === session
          );
          console.log('Filtered bookings:', filtered.length); // Log filtered count
          setBookings(filtered);
        }
      })
      .catch(e => {
        if (isMounted) {
            console.error('Error fetching bookings:', e); // Log error
            setError(e.message || 'Failed to fetch bookings');
        }
      })
      .finally(() => {
        if (isMounted) {
            console.log('Finished loading.'); // Log loading finish
            setIsLoading(false);
        }
      });
    return () => { isMounted = false; };
  }, [userId, dateKey, session]);

  if (isLoading) {
    return <View style={styles.centered}><ActivityIndicator size="large" /><Text>Loading session bookings...</Text></View>;
  }
  if (error) {
    return <View style={styles.centered}><Text style={styles.errorText}>{error}</Text></View>;
  }
  if (!bookings.length) {
    return <View style={styles.centered}><Text>No bookings found for this session.</Text></View>;
  }

  return (
    <FlatList
      data={bookings}
      keyExtractor={item => item.id.toString()}
      contentContainerStyle={styles.listContent}
      renderItem={({ item }) => (
        <TouchableOpacity
          style={styles.bookingItem}
          onPress={() => {
            // Check if client_id exists before navigating
            if (item.client_id) {
              navigation.navigate('ClientDetails', { clientId: item.client_id });
            } else {
              console.warn('No client_id found for this booking:', item.id);
              // Optionally show an alert to the user
              // Alert.alert('Navigation Error', 'Could not find client details for this booking.');
            }
          }}
        >
          <Text style={styles.bookingTitle}>{item.client_name || 'N/A'}</Text>
          <Text style={styles.bookingTime}>{new Date(item.start_time).toLocaleTimeString()} - {new Date(item.end_time).toLocaleTimeString()}</Text>
          <Text style={styles.bookingDetails}>{item.status || ''}</Text>
        </TouchableOpacity>
      )}
    />
  );
};

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    color: 'red',
    fontSize: 16,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  listContent: {
    padding: 16,
  },
  bookingItem: {
    backgroundColor: 'white',
    borderRadius: 6,
    padding: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  bookingTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  bookingTime: {
    fontSize: 14,
    color: '#555',
    marginTop: 4,
  },
  bookingDetails: {
    fontSize: 14,
    color: '#777',
    marginTop: 4,
  },
});

export default SessionBookingsScreen;