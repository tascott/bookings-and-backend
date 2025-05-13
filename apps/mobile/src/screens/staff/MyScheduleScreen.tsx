import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { Agenda, AgendaEntry, AgendaSchedule } from 'react-native-calendars';
import { supabase } from '../../services/supabaseClient';
import type { Booking, Service } from '@booking-and-accounts-monorepo/shared-types';
import { fetchServices } from '@booking-and-accounts-monorepo/api-services/serviceService';
import { fetchBookingsDirect } from '@booking-and-accounts-monorepo/api-services/bookingService';
import { RouteProp, useNavigation } from '@react-navigation/native';
import { StaffTabParamList, ScheduleStackParamList } from '../../navigation/StaffTabNavigator';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

// Helper to format date to 'YYYY-MM-DD' string
const dateToString = (date: Date): string => {
  return date.toISOString().split('T')[0];
};

// Define the structure for individual booking entries
export interface MyAgendaEntry extends AgendaEntry {
  id: string; // Booking ID
  name: string; // Service type (used within group for consistency or if displayed)
  details: string; // e.g., Client name, pets
  time: string;
  bookingData?: Booking; // Optional: store original booking data
  // height is not strictly needed here as Agenda renders groups, but can be for internal styling
}

// Define the structure for agenda item groups (a session with its bookings)
interface MyAgendaItemGroupEntry extends AgendaEntry {
  id: string; // Unique ID for the group, e.g., date-sessionName
  name: string; // Session Name for the group header (this is AgendaEntry.name)
  day: string;  // Date string 'YYYY-MM-DD'
  height: number; // Calculated total height for the entire group
  sessionBookings: MyAgendaEntry[]; // Array of individual bookings for this session
}

// Type for the parameters of the SessionBookings screen (remains the same)
type SessionBookingsParams = { userId: string; dateKey: string; session: string };

// Navigation prop for the MyScheduleScreen, now within its own stack
// It navigates to SessionBookings within the ScheduleStack
// The screen itself is 'MyScheduleHome' in the ScheduleStackParamList

type MyScheduleNavigationProp = NativeStackNavigationProp<ScheduleStackParamList, 'MyScheduleHome'>;

// The route prop is for MyScheduleHome within ScheduleStackParamList, passed via StaffTabParamList
// This needs careful review. MyScheduleScreen (now MyScheduleHome) gets its params when ScheduleStackNavigator is set up.
// The `route` prop for MyScheduleScreen will be RouteProp<ScheduleStackParamList, 'MyScheduleHome'>.

type MyScheduleScreenRouteProp = RouteProp<ScheduleStackParamList, 'MyScheduleHome'>;

interface Props {
  route: MyScheduleScreenRouteProp;
}

const MyScheduleScreen: React.FC<Props> = ({ route }) => {
  console.log("[MyScheduleScreen] Component rendered/re-rendered");
  const { userId } = route.params;
  const navigation = useNavigation<MyScheduleNavigationProp>();
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

      const groupedByDate: { [date: string]: Booking[] } = {};
      bookingsData?.forEach((booking: Booking) => {
        const bookingDateStr = dateToString(new Date(booking.start_time));
        if (!groupedByDate[bookingDateStr]) {
          groupedByDate[bookingDateStr] = [];
        }
        groupedByDate[bookingDateStr].push(booking);
      });

      const newAgendaSchedule: AgendaSchedule = {};

      for (const dateKey in groupedByDate) {
        const dailyBookings = groupedByDate[dateKey];
        const bookingsBySession: { [sessionName: string]: Booking[] } = {};

        dailyBookings.forEach(booking => {
          let foundService: Service | undefined = undefined;
          if (typeof booking.service_type === 'string' && allServices) {
              foundService = allServices.find(s =>
                  s.name === booking.service_type ||
                  s.id.toString() === booking.service_type
              );
          }
          const serviceName = foundService?.name || (typeof booking.service_type === 'string' ? booking.service_type : 'Booking');

          if (!bookingsBySession[serviceName]) {
            bookingsBySession[serviceName] = [];
          }
          bookingsBySession[serviceName].push(booking);
        });

        const sessionGroupsForDate: MyAgendaItemGroupEntry[] = [];
        Object.keys(bookingsBySession).forEach(sessionName => {
          const bookingsInSession = bookingsBySession[sessionName];
          const sessionAgendaEntries: MyAgendaEntry[] = bookingsInSession.map(booking => {
            const startTime = new Date(booking.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
            const endTime = new Date(booking.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });

            return {
              id: booking.id.toString(),
              name: sessionName, // Individual booking entry's name is the session name
              details: booking.client_name || 'N/A',
              day: dateKey,
              time: `${startTime} - ${endTime}`,
              bookingData: booking,
              height: 45, // Add a nominal height to satisfy MyAgendaEntry interface if it requires it
            };
          });

          const SESSION_HEADER_HEIGHT = 30; // Approx height for session name text
          const BOOKING_ITEM_IN_GROUP_HEIGHT = 45; // Approx height for time + details line
          const PADDING_BELOW_HEADER = 5;
          const PADDING_BOTTOM_GROUP = 10;
          const groupHeight = SESSION_HEADER_HEIGHT + PADDING_BELOW_HEADER + (sessionAgendaEntries.length * BOOKING_ITEM_IN_GROUP_HEIGHT) + PADDING_BOTTOM_GROUP;

          sessionGroupsForDate.push({
            id: `${dateKey}-${sessionName.replace(/\s+/g, '_')}`, // Group unique ID
            name: sessionName, // This is the AgendaEntry.name, which will be the session header
            day: dateKey,
            height: groupHeight,
            sessionBookings: sessionAgendaEntries,
          });
        });

        // Sort session groups by the start time of their first booking, then by name
        sessionGroupsForDate.sort((a, b) => {
          const firstBookingTimeA = a.sessionBookings.length > 0 ? new Date(a.sessionBookings[0].bookingData!.start_time).getTime() : Infinity;
          const firstBookingTimeB = b.sessionBookings.length > 0 ? new Date(b.sessionBookings[0].bookingData!.start_time).getTime() : Infinity;

          if (firstBookingTimeA !== firstBookingTimeB) {
            return firstBookingTimeA - firstBookingTimeB;
          }
          return a.name.localeCompare(b.name);
        });
        newAgendaSchedule[dateKey] = sessionGroupsForDate;
      }

      console.log("[MyScheduleScreen] fetchAndProcessBookings: Preparing to call setItems with newAgendaSchedule. Date keys:", Object.keys(newAgendaSchedule));
      setItems(newAgendaSchedule);
      console.log("[MyScheduleScreen] fetchAndProcessBookings: setItems has been called.");

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

  const renderItem = useCallback((group: MyAgendaItemGroupEntry, isFirst: boolean) => {
    // The 'group' parameter is an instance of MyAgendaItemGroupEntry
    return (
      <View style={[styles.groupItemContainer, { height: group.height }]}>
        <Text style={styles.groupSessionName}>{group.name}</Text>
        {group.sessionBookings.map((bookingEntry: MyAgendaEntry) => (
          <TouchableOpacity
            key={bookingEntry.id}
            style={styles.bookingInGroupItem}
            onPress={() => {
              console.log('Booking item pressed (for Client Details):', bookingEntry.id, bookingEntry.bookingData);
              if (bookingEntry.bookingData && typeof bookingEntry.bookingData.client_id === 'number') {
                navigation.navigate('ClientDetails', {
                  clientId: bookingEntry.bookingData.client_id.toString(),
                });
              } else {
                console.warn('No bookingData or valid client_id found for this booking item.');
              }
            }}
          >
            <Text style={styles.bookingTimeText}>{bookingEntry.time}</Text>
            <Text style={styles.bookingDetailsText}>{bookingEntry.details}</Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  }, [navigation, userId]);

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

  console.log("[MyScheduleScreen] Rendering Agenda. CurrentDate:", currentDate, "Items for selected day:", itemsForSelectedDayOnly[currentDate]?.length);
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
  groupItemContainer: {
    backgroundColor: 'white',
    borderRadius: 5,
    padding: 10,
    marginRight: 10,
    marginTop: 17, // Matches original 'item' marginTop
    flex: 1, // Important for Agenda item layout
  },
  groupSessionName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  bookingInGroupItem: {
    paddingVertical: 6,
    // If you need lines or specific spacing:
    // borderBottomWidth: 1,
    // borderBottomColor: '#eee',
  },
  bookingTimeText: {
    fontSize: 14,
    color: '#555',
  },
  bookingDetailsText: {
    fontSize: 14,
    color: '#777',
    marginTop: 2,
  },
});

export default MyScheduleScreen;