import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { Agenda, AgendaEntry, AgendaSchedule } from 'react-native-calendars';
import { supabase } from '../../services/supabaseClient';
import type { Booking, Service } from '@booking-and-accounts-monorepo/shared-types';
import { fetchServices } from '@booking-and-accounts-monorepo/api-services/serviceService';
import { fetchBookingsDirect } from '@booking-and-accounts-monorepo/api-services/bookingService';
import { RouteProp } from '@react-navigation/native';
import { StaffTabParamList } from '../../navigation/StaffTabNavigator';

// Helper to format date to 'YYYY-MM-DD' string
const dateToString = (date: Date): string => {
  return date.toISOString().split('T')[0];
};

// Define the structure for our agenda items
export interface MyAgendaEntry extends AgendaEntry {
  id: string; // Booking ID
  name: string; // Service type or other identifier
  details: string; // e.g., Client name, pets
  time: string;
  bookingData?: Booking; // Optional: store original booking data
}

type MyScheduleScreenRouteProp = RouteProp<StaffTabParamList, 'MySchedule'>;

interface Props {
  route: MyScheduleScreenRouteProp;
}

const MyScheduleScreen: React.FC<Props> = ({ route }) => {
  console.log("[MyScheduleScreen] Component rendered/re-rendered");
  const { userId } = route.params;
  const [items, setItems] = useState<AgendaSchedule>({});
  const [allServices, setAllServices] = useState<Service[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingServices, setIsLoadingServices] = useState(true);
  const [servicesError, setServicesError] = useState<string | null>(null);
  const [bookingsError, setBookingsError] = useState<string | null>(null);
  const [currentDate, setCurrentDate] = useState(() => {
    const initialDate = dateToString(new Date());
    console.log("[MyScheduleScreen] Initializing currentDate:", initialDate);
    return initialDate;
  });

  useEffect(() => {
    console.log("[MyScheduleScreen] useEffect for loadServices triggered.");
    const loadServices = async () => {
      console.log("[MyScheduleScreen] loadServices: Fetching...");
      setIsLoadingServices(true);
      setServicesError(null);
      try {
        const servicesData = await fetchServices(supabase);
        console.log("[MyScheduleScreen] loadServices: Fetched servicesData. Count:", servicesData?.length);
        setAllServices(servicesData || []);
      } catch (e) {
        console.error('Failed to fetch services:', e);
        setServicesError(e instanceof Error ? e.message : 'Could not load services.');
        setAllServices([]); // Ensure it's an empty array on error to avoid null issues
      } finally {
        setIsLoadingServices(false);
      }
    };
    loadServices();
  }, []);

  const fetchAndProcessBookings = useCallback(async (fetchForDate?: string) => {
    console.log(`[MyScheduleScreen] fetchAndProcessBookings: Called for date: ${fetchForDate}, allServices is ${allServices === null ? 'null' : 'available'}`);
    if (allServices === null) {
      console.log("[MyScheduleScreen] fetchAndProcessBookings: allServices is null, returning.");
      return;
    }

    console.log("[MyScheduleScreen] fetchAndProcessBookings: Setting isLoading to true.");
    setIsLoading(true);
    setBookingsError(null);

    try {
      console.log(`[MyScheduleScreen] fetchAndProcessBookings: Calling fetchBookingsDirect with userId: ${userId}`);
      const bookingsData = await fetchBookingsDirect(supabase, { assigned_staff_id: userId });
      console.log("[MyScheduleScreen] fetchAndProcessBookings: Fetched bookingsData. Count:", bookingsData?.length);

      const newItems: AgendaSchedule = {};
      bookingsData?.forEach((booking: Booking) => {
        const bookingDateStr = dateToString(new Date(booking.start_time));
        if (!newItems[bookingDateStr]) {
          newItems[bookingDateStr] = [];
        }
        const startTime = new Date(booking.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
        const endTime = new Date(booking.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });

        let foundService: Service | undefined = undefined;
        if (typeof booking.service_type === 'string' && allServices) {
            foundService = allServices.find(s =>
                s.name === booking.service_type ||
                s.id.toString() === booking.service_type
            );
        }

        const serviceName = foundService?.name || (typeof booking.service_type === 'string' ? booking.service_type : 'Booking');

        const entry: MyAgendaEntry = {
          id: booking.id.toString(),
          name: serviceName,
          details: booking.client_name || 'N/A',
          height: 80,
          day: bookingDateStr,
          time: `${startTime} - ${endTime}`,
          bookingData: booking,
        };
        (newItems[bookingDateStr] as MyAgendaEntry[]).push(entry);
      });

      console.log("[MyScheduleScreen] fetchAndProcessBookings: Preparing to call setItems with newItems. Date keys:", Object.keys(newItems));
      // setTimeout(() => { // Removed the test delay
      setItems(newItems);
      console.log("[MyScheduleScreen] fetchAndProcessBookings: setItems has been called.");
      // }, 100);

    } catch (e) {
      console.error('Failed to fetch or process schedule bookings directly from Supabase:', e);
      setBookingsError(e instanceof Error ? e.message : 'Could not fetch schedule bookings');
    } finally {
      console.log("[MyScheduleScreen] fetchAndProcessBookings: Setting isLoading to false.");
      setIsLoading(false);
    }
  }, [userId, allServices]);

  useEffect(() => {
    console.log("[MyScheduleScreen] useEffect for fetchAndProcessBookings triggered. Deps - isLoadingServices:", isLoadingServices, "servicesError:", servicesError, "allServices:", allServices !== null, "currentDate:", currentDate, "userId:", userId);
    if (!isLoadingServices && !servicesError && allServices !== null) {
        console.log("[MyScheduleScreen] useEffect for fetchAndProcessBookings: Conditions met, calling fetchAndProcessBookings for date:", currentDate);
        fetchAndProcessBookings(currentDate);
    } else {
      console.log("[MyScheduleScreen] useEffect for fetchAndProcessBookings: Conditions NOT met.");
    }
  }, [isLoadingServices, servicesError, allServices, currentDate, userId]);

  const renderItem = useCallback((reservation: MyAgendaEntry, isFirst: boolean) => {
    return (
      <TouchableOpacity
        style={[styles.item, { height: reservation.height }]}
        onPress={() => console.log('Item pressed:', reservation.id, reservation.bookingData)}
      >
        <Text style={styles.itemTextName}>{reservation.name}</Text>
        <Text style={styles.itemTextTime}>{reservation.time}</Text>
        <Text style={styles.itemTextDetails}>{reservation.details}</Text>
      </TouchableOpacity>
    );
  }, []);

  const renderEmptyDate = useCallback(() => {
    return (
      <View style={styles.emptyDate}>
        <Text>No bookings for this day.</Text>
      </View>
    );
  }, []);

  const loadItems = useCallback(() => {
    console.log("[MyScheduleScreen] loadItems: Called (now a NOP)");
    // No operation
  }, []);

  if ((isLoading || isLoadingServices) && Object.keys(items).length === 0 && !servicesError && !bookingsError) {
    return <View style={styles.centered}><ActivityIndicator size="large" /><Text>Loading schedule...</Text></View>;
  }

  if (servicesError) {
    return <View style={styles.centered}><Text style={styles.errorText}>Service Error: {servicesError}</Text></View>;
  }
  if (bookingsError) {
    return <View style={styles.centered}><Text style={styles.errorText}>Booking Error: {bookingsError}</Text></View>;
  }

  return (
    <Agenda
      items={items}
      loadItemsForMonth={loadItems} // NOP version
      // selected={currentDate} // Temporarily commented out
      onDayPress={(day) => {
        // Temporarily only log, don't call setCurrentDate
        console.log(`[MyScheduleScreen] onDayPress: Agenda day pressed: ${day.dateString}`);
      }}
      renderItem={renderItem as any}
      renderEmptyDate={renderEmptyDate}
      showClosingKnob={true}
      theme={{
        agendaDayTextColor: '#333',
        agendaDayNumColor: '#333',
        agendaTodayColor: '#00adf5',
        agendaKnobColor: '#00adf5'
      }}
      pastScrollRange={12}
      futureScrollRange={12}
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
  item: {
    backgroundColor: 'white',
    flex: 1,
    borderRadius: 5,
    padding: 10,
    marginRight: 10,
    marginTop: 17,
    justifyContent: 'center',
  },
  itemTextName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  itemTextTime: {
    fontSize: 14,
    color: '#555',
    marginTop: 4,
  },
  itemTextDetails: {
    fontSize: 14,
    color: '#777',
    marginTop: 4,
  },
  emptyDate: {
    height: 15,
    flex: 1,
    paddingTop: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default MyScheduleScreen;