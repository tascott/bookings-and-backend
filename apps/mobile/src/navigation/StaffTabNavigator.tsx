import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { NavigatorScreenParams } from '@react-navigation/native';
import MyScheduleScreen from '../screens/staff/MyScheduleScreen';
import MyClientsScreen from '../screens/staff/MyClientsScreen';
import BookingManagementScreen from '../screens/staff/BookingManagementScreen';
import SessionBookingsScreen from '../screens/staff/SessionBookingsScreen';
import ClientDetailsScreen from '../screens/staff/ClientDetailsScreen';
import MyProfileScreen from '../screens/staff/MyProfileScreen';
import PetMediaStackNavigator, { PetMediaStackParamList } from './PetMediaStackNavigator';

export type BookingStackParamList = {
  BookingManagement: { userId: string };
  SessionBookings: { userId: string; dateKey: string; session: string };
  ClientDetails: { clientId: string };
};

// Define param list for the new Schedule Stack
export type ScheduleStackParamList = {
  MyScheduleHome: { userId: string }; // Renaming for clarity within its own stack
  SessionBookings: { userId: string; dateKey: string; session: string };
  ClientDetails: { clientId: string }; // Add ClientDetails here
};

export type StaffTabParamList = {
  MySchedule: NavigatorScreenParams<ScheduleStackParamList> & { userId: string };
  MyClients: { userId: string };
  BookingManagement: NavigatorScreenParams<BookingStackParamList> & { userId: string };
  PetMedia: NavigatorScreenParams<PetMediaStackParamList>;
  MyProfile: { userId: string };
};

const Tab = createBottomTabNavigator<StaffTabParamList>();
const BookingStack = createNativeStackNavigator<BookingStackParamList>();
const ScheduleStack = createNativeStackNavigator<ScheduleStackParamList>(); // Create new stack navigator

// New Stack Navigator for the Schedule Tab
function ScheduleStackNavigator({ userId }: { userId: string }) {
  return (
    <ScheduleStack.Navigator initialRouteName="MyScheduleHome">
      <ScheduleStack.Screen
        name="MyScheduleHome"
        component={MyScheduleScreen}
        initialParams={{ userId }}
        options={{ title: 'Schedule' }} // Or use headerTitle from MyScheduleScreen if preferred
      />
      <ScheduleStack.Screen
        name="SessionBookings"
        component={SessionBookingsScreen} // Re-using the same screen component
        options={{ title: 'Session Details' }} // Title for this screen when in this stack
      />
      {/* Add ClientDetailsScreen to the ScheduleStack */}
      <ScheduleStack.Screen
        name="ClientDetails"
        component={ClientDetailsScreen}
        options={{ title: 'Client Details' }}
      />
    </ScheduleStack.Navigator>
  );
}

function BookingStackNavigator({ userId }: { userId: string }) {
  return (
    <BookingStack.Navigator initialRouteName="BookingManagement">
      <BookingStack.Screen
        name="BookingManagement"
        component={BookingManagementScreen}
        initialParams={{ userId }}
        options={{ title: 'Bookings' }}
      />
      <BookingStack.Screen
        name="SessionBookings"
        component={SessionBookingsScreen}
        options={{ title: 'Session Bookings' }}
      />
      <BookingStack.Screen
        name="ClientDetails"
        component={ClientDetailsScreen}
        options={{ title: 'Client Details' }}
      />
    </BookingStack.Navigator>
  );
}

interface StaffTabNavigatorProps {
  userId: string;
}

const StaffTabNavigator: React.FC<StaffTabNavigatorProps> = ({ userId }) => {
  return (
    <Tab.Navigator>
      <Tab.Screen
        name="MySchedule"
        children={() => <ScheduleStackNavigator userId={userId} />} // Use the new stack navigator
        options={{
          title: 'Schedule', // This sets the tab bar label
          headerShown: false // This will hide the Tab navigator's header for this tab
        }}
      />
      <Tab.Screen
        name="MyClients"
        component={MyClientsScreen}
        initialParams={{ userId: userId }}
        options={{ title: 'Clients' }}
      />
      <Tab.Screen
        name="BookingManagement"
        children={() => <BookingStackNavigator userId={userId} />}
        options={{
          title: 'Bookings', // This sets the tab bar label
          headerShown: false // This will hide the Tab navigator's header for this tab
        }}
      />
      <Tab.Screen
        name="MyProfile"
        component={MyProfileScreen}
        initialParams={{ userId: userId }}
        options={{ title: 'Profile' }}
      />
      <Tab.Screen
        name="PetMedia"
        component={PetMediaStackNavigator}
        options={{
          title: 'Pet Media',
          headerShown: false,
        }}
      />
    </Tab.Navigator>
  );
};

export default StaffTabNavigator;