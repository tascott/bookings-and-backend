import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator } from 'react-native';
import { fetchBookingsDirect } from '@booking-and-accounts-monorepo/api-services/bookingService';
import { supabase } from '../../services/supabaseClient';
import type { Booking } from '@booking-and-accounts-monorepo/shared-types';
import { RouteProp } from '@react-navigation/native';
import { StaffTabParamList } from '../../navigation/StaffTabNavigator';

// Accept userId from route params
type BookingManagementScreenRouteProp = RouteProp<StaffTabParamList, 'BookingManagement'>;
interface Props {
  route: BookingManagementScreenRouteProp;
}

const BookingManagementScreen: React.FC<Props> = ({ route }) => {
  const { userId } = route.params;
  console.log('BookingManagementScreen: userId', userId);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    console.log('BookingManagementScreen useEffect running');
    let isMounted = true;
    setIsLoading(true);
    setError(null);
    fetchBookingsDirect(supabase, { assigned_staff_id: userId })
      .then(data => {
        console.log('fetchBookingsDirect result', data);
        if (isMounted) setBookings(data || []);
      })
      .catch(e => {
        console.log('fetchBookingsDirect error', e);
        if (isMounted) setError(e.message || 'Failed to fetch bookings');
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });
    return () => { isMounted = false; };
  }, [userId]);

  if (isLoading) {
    return <View style={styles.centered}><ActivityIndicator size="large" /><Text>Loading bookings...</Text></View>;
  }
  if (error) {
    return <View style={styles.centered}><Text style={styles.errorText}>{error}</Text></View>;
  }
  if (!bookings.length) {
    return <View style={styles.centered}><Text>No bookings found.</Text></View>;
  }

  return (
    <FlatList
      data={bookings}
      keyExtractor={item => item.id.toString()}
      contentContainerStyle={styles.listContent}
      renderItem={({ item }) => (
        <View style={styles.bookingItem}>
          <Text style={styles.bookingTitle}>{item.service_type || 'Booking'}</Text>
          <Text style={styles.bookingTime}>{new Date(item.start_time).toLocaleString()} - {new Date(item.end_time).toLocaleTimeString()}</Text>
          <Text style={styles.bookingClient}>{item.client_name || 'N/A'}</Text>
        </View>
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
  bookingClient: {
    fontSize: 14,
    color: '#777',
    marginTop: 4,
  },
});

export default BookingManagementScreen;