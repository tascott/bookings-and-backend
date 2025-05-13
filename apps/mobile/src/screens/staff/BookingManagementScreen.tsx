import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, SectionList, ActivityIndicator, TouchableOpacity, Alert } from 'react-native';
import { fetchBookingsDirect } from '@booking-and-accounts-monorepo/api-services/bookingService';
import { supabase } from '../../services/supabaseClient';
import type { Booking } from '@booking-and-accounts-monorepo/shared-types';
import { RouteProp, useNavigation } from '@react-navigation/native';
import { StaffTabParamList } from '../../navigation/StaffTabNavigator';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

// Define the Stack param list including SessionBookings
type BookingStackParamList = {
  BookingManagement: { userId: string };
  SessionBookings: { userId: string; dateKey: string; session: string };
};

// Define the navigation prop type using the Stack param list
type BookingManagementNavigationProp = NativeStackNavigationProp<BookingStackParamList, 'BookingManagement'>;

// Accept userId from route params
type BookingManagementScreenRouteProp = RouteProp<BookingStackParamList, 'BookingManagement'>;
interface Props {
  route: BookingManagementScreenRouteProp;
}

// Helper to format date as 'YYYY-MM-DD'
const formatDate = (dateStr: string) => {
  const d = new Date(dateStr);
  return d.toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
};

const BOOKINGS_PER_PAGE = 10;

const BookingManagementScreen: React.FC<Props> = ({ route }) => {
  const { userId } = route.params;
  const navigation = useNavigation<BookingManagementNavigationProp>();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [visibleDates, setVisibleDates] = useState<string[]>([]); // Dates currently shown

  // Fetch all bookings for this staff member
  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);
    setError(null);
    fetchBookingsDirect(supabase, { assigned_staff_id: userId })
      .then(data => {
        if (isMounted) {
          setBookings(data || []);
          // Only set visibleDates if it is empty (initial load)
          if (!visibleDates.length) {
            const allDates = Array.from(new Set((data || []).map(b => b.start_time.slice(0, 10)))).sort((a, b) => b.localeCompare(a));
            setVisibleDates(allDates.slice(0, BOOKINGS_PER_PAGE));
          }
        }
      })
      .catch(e => {
        if (isMounted) setError(e.message || 'Failed to fetch bookings');
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });
    return () => { isMounted = false; };
  }, [userId]);

  // Group bookings by date, then by session (service_type)
  const groupedSections = React.useMemo(() => {
    if (!visibleDates.length) return [];
    // Group by date
    const byDate: { [date: string]: Booking[] } = {};
    bookings.forEach(b => {
      const dateKey = b.start_time.slice(0, 10); // 'YYYY-MM-DD'
      if (!byDate[dateKey]) byDate[dateKey] = [];
      byDate[dateKey].push(b);
    });
    // Only use visibleDates
    const pagedDates = visibleDates;
    // Group by session within each date
    const sections = pagedDates.map(dateKey => {
      const bookingsForDate = byDate[dateKey] || [];
      // Group by session (service_type)
      const bySession: { [session: string]: Booking[] } = {};
      bookingsForDate.forEach(b => {
        const session = b.service_type || 'Session';
        if (!bySession[session]) bySession[session] = [];
        bySession[session].push(b);
      });
      // Prepare session groups for rendering
      const sessionGroups = Object.entries(bySession).map(([session, sessionBookings]) => ({
        session,
        bookings: sessionBookings,
      }));
      return {
        title: formatDate(dateKey),
        dateKey,
        data: sessionGroups,
      };
    });
    console.log('visibleDates:', visibleDates);
    console.log('groupedSections.length:', sections.length);
    return sections;
  }, [bookings, visibleDates]);

  // Infinite scroll: load more dates
  const handleEndReached = useCallback(() => {
    // Find all unique dates, sorted descending
    const allDates = Array.from(new Set(bookings.map(b => b.start_time.slice(0, 10)))).sort((a, b) => b.localeCompare(a));
    const currentlyVisible = visibleDates.length || BOOKINGS_PER_PAGE;
    if (currentlyVisible < allDates.length) {
      // Append more dates, not replace
      setVisibleDates(prev => [
        ...prev,
        ...allDates.slice(prev.length, prev.length + BOOKINGS_PER_PAGE)
      ]);
    }
  }, [bookings, visibleDates]);

  if (isLoading || !visibleDates.length) {
    return <View style={styles.centered}><ActivityIndicator size="large" /><Text>Loading bookings...</Text></View>;
  }
  if (error) {
    return <View style={styles.centered}><Text style={styles.errorText}>{error}</Text></View>;
  }
  if (!bookings.length) {
    return <View style={styles.centered}><Text>No bookings found.</Text></View>;
  }

  return (
    <SectionList
      sections={groupedSections}
      keyExtractor={(_, idx) => idx.toString()}
      contentContainerStyle={styles.listContent}
      onEndReached={handleEndReached}
      onEndReachedThreshold={0.5}
      renderSectionHeader={({ section }) => (
        <Text style={styles.dateHeader}>{section.title}</Text>
      )}
      renderItem={({ item, section }) => (
        <TouchableOpacity
          style={styles.sessionCard}
          onPress={() => {
            // Navigate to session details page with section.dateKey and item.session
            navigation.navigate('SessionBookings', {
              userId: userId,
              dateKey: section.dateKey,
              session: item.session,
            });
          }}
        >
          <Text style={styles.sessionTitle}>{item.session}</Text>
          <Text style={styles.sessionCount}>{item.bookings.length} booking{item.bookings.length !== 1 ? 's' : ''}</Text>
        </TouchableOpacity>
      )}
      ListFooterComponent={groupedSections.length * BOOKINGS_PER_PAGE < bookings.length ? <ActivityIndicator /> : null}
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
  dateHeader: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  sessionCard: {
    backgroundColor: 'white',
    borderRadius: 6,
    padding: 14,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  sessionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  sessionCount: {
    fontSize: 14,
    color: '#555',
    marginTop: 4,
  },
});

export default BookingManagementScreen;