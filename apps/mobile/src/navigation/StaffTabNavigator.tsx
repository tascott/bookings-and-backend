import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import MyScheduleScreen from '../screens/staff/MyScheduleScreen';
import MyClientsScreen from '../screens/staff/MyClientsScreen';
import BookingManagementScreen from '../screens/staff/BookingManagementScreen';
import MyProfileScreen from '../screens/staff/MyProfileScreen';

export type StaffTabParamList = {
  MySchedule: { userId: string };
  MyClients: { userId: string };
  BookingManagement: { userId: string };
  MyProfile: { userId: string };
};

const Tab = createBottomTabNavigator<StaffTabParamList>();

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
        component={BookingManagementScreen}
        initialParams={{ userId: userId }}
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