import React from 'react';
import StaffTabNavigator from '../navigation/StaffTabNavigator';

interface StaffDashboardScreenProps {
  userId: string;
  // We might also receive navigation and route props if passed from Stack.Screen children render prop
  // For now, only explicitly define userId as it's what we intend to pass through.
}

const StaffDashboardScreen: React.FC<StaffDashboardScreenProps> = ({ userId }) => {
  return <StaffTabNavigator userId={userId} />;
};

export default StaffDashboardScreen;