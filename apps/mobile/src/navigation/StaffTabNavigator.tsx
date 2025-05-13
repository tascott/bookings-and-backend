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

export type BookingStackParamList = {
  BookingManagement: { userId: string };
  SessionBookings: { userId: string; dateKey: string; session: string };
  ClientDetails: { clientId: string };
};

export type StaffTabParamList = {
  MySchedule: { userId: string };
  MyClients: { userId: string };
  BookingManagement: NavigatorScreenParams<BookingStackParamList> & { userId: string };
  MyProfile: { userId: string };
};

const Tab = createBottomTabNavigator<StaffTabParamList>();
const BookingStack = createNativeStackNavigator<BookingStackParamList>();

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
        component={MyScheduleScreen}
        initialParams={{ userId: userId }}
        options={{ title: 'Schedule' }}
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
        options={{ title: 'Bookings' }}
      />
      <Tab.Screen
        name="MyProfile"
        component={MyProfileScreen}
        initialParams={{ userId: userId }}
        options={{ title: 'Profile' }}
      />
    </Tab.Navigator>
  );
};

export default StaffTabNavigator;