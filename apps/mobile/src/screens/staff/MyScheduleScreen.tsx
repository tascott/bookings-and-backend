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
    console.log("[MyScheduleScreen] useEffect for fetchAndProcessBookings triggered. Deps - isLoadingServices:", isLoadingServices, "servicesError:", servicesError, "allServices:", allServices !== null, "userId:", userId);
    if (!isLoadingServices && !servicesError && allServices !== null) {
        console.log("[MyScheduleScreen] useEffect for fetchAndProcessBookings: Conditions met, calling fetchAndProcessBookings.");
        fetchAndProcessBookings();
    } else {
      console.log("[MyScheduleScreen] useEffect for fetchAndProcessBookings: Conditions NOT met.");
    }
  }, [isLoadingServices, servicesError, allServices, fetchAndProcessBookings, userId]);

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

  // Prepare items for the Agenda, ensuring the current selected date always has an entry
  // (empty array if no bookings) to allow renderEmptyDate to work correctly for the selected day.
  const itemsForAgenda: AgendaSchedule = {};
  if (items[currentDate]) {
    itemsForAgenda[currentDate] = items[currentDate];
  } else {
    // If there are no items for the currentDate (even after fetching),
    // provide an empty array for that date. This helps renderEmptyDate.
    itemsForAgenda[currentDate] = [];
  }
  // To ensure the calendar part of Agenda can show markings for other days,
  // we should provide all days that have items, not just the current one.
  // However, the list view below should only show the current day's items.
  // The Agenda component itself should handle displaying only the selected day's items
  // when the `selected` prop is correctly updated and `items` are structured properly.
  // Let's pass all loaded items and rely on `selected` prop.

  // Create a new object for the Agenda's items prop that only contains the currentDate's items
  // This directly addresses: "the list below doesn't exclusively show bookings for that single selected day"
  const displayedItems: AgendaSchedule = {};
  if (items[currentDate]) {
    displayedItems[currentDate] = items[currentDate];
  } else {
    // Ensure the selected date is present in the items prop for Agenda,
    // even if it's an empty array. This is crucial for renderEmptyDate.
    displayedItems[currentDate] = [];
  }
  // Also include other dates that have items in the `items` prop, so the calendar marks them.
  // However, the list view under the calendar should only show items for `currentDate`.
  // The react-native-calendars Agenda component, when provided with a `selected` date
  // and an `items` object, should ideally handle showing only the selected day's items
  // in the list view if that date has entries in `items`.
  // If it doesn't, explicitly filtering `items` like this (`displayedItems`) is necessary.

  // Let's try passing ALL items and see if `selected` prop works as expected.
  // If not, we revert to `displayedItems`.
  // The key is `items` should contain all data, and `selected` tells Agenda which one to focus on.
  // To ensure dots appear on days with events, 'items' must contain those events.

  const agendaItemsToShow = { ...items };
  if (!agendaItemsToShow[currentDate]) {
    // Ensure the selected date always has at least an empty array entry
    // This helps with renderEmptyDate and potentially with the Agenda's internal logic.
    agendaItemsToShow[currentDate] = [];
  }

  // New approach: Strictly pass only the current day's items to the Agenda's list rendering part.
  const itemsForSelectedDayOnly: AgendaSchedule = {};
  if (items[currentDate]) {
    itemsForSelectedDayOnly[currentDate] = items[currentDate];
  } else {
    itemsForSelectedDayOnly[currentDate] = []; // Ensure key exists for renderEmptyDate
  }

  // Prepare markedDates for the calendar strip
  const markedDatesObject: { [key: string]: { marked?: boolean; dotColor?: string; dots?: Array<{key?: string, color: string, selectedDotColor?: string}>; selected?: boolean; selectedColor?: string; } } = {};
  Object.keys(items).forEach(date => {
    if (items[date] && items[date].length > 0) {
      markedDatesObject[date] = { marked: true, dotColor: '#00adf5' }; // Using the agendaTodayColor for dots
    }
  });
  // Ensure the selected day also reflects its selection in markedDates if needed, though 'selected' prop handles main highlight
  if (markedDatesObject[currentDate]) {
      markedDatesObject[currentDate] = { ...markedDatesObject[currentDate], selected: true, selectedColor: '#00adf5' };
  } else {
      // If the selected day has no items, it won't be in markedDatesObject from the loop above
      // It will just be highlighted by the `selected` prop of Agenda. We don't need to add a dot for it if it's empty.
      // However, if we want a different style for the selected day via markedDates, we can add it:
      // markedDatesObject[currentDate] = { selected: true, selectedColor: '#00adf5', activeOpacity: 0 };
  }

  return (
    <Agenda
      items={itemsForSelectedDayOnly}
      loadItemsForMonth={loadItems}
      selected={currentDate}
      markedDates={markedDatesObject}
      onDayPress={(day) => {
        console.log(`[MyScheduleScreen] onDayPress: Agenda day pressed: ${day.dateString}`);
        setCurrentDate(day.dateString);
      }}
      renderItem={renderItem as any}
      renderEmptyDate={renderEmptyDate}
      renderKnob={() => null}
      hideKnob={true}
      showClosingKnob={false}
      theme={{
        agendaDayTextColor: '#333',
        agendaDayNumColor: '#333',
        agendaTodayColor: '#00adf5',
        agendaKnobColor: '#00adf5',
        textDayHeaderFontSize: 12,
        textDayFontSize: 14,
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
    marginTop: 10,
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
    paddingTop: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default MyScheduleScreen;