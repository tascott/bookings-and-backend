import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import HomeScreen from '../screens/HomeScreen';
import LoginScreen from '../screens/LoginScreen';
import SignUpScreen from '../screens/SignUpScreen';

export type RootStackParamList = {
  Home: undefined; // No parameters expected for HomeScreen
  Login: undefined;
  SignUp: undefined;
  // ... other screens can be added here later
};

const Stack = createNativeStackNavigator<RootStackParamList>();

const AppNavigator = () => {
  return (
    <Stack.Navigator initialRouteName="Login">
      <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
      <Stack.Screen name="SignUp" component={SignUpScreen} options={{ title: 'Create Account' }} />
      <Stack.Screen name="Home" component={HomeScreen} options={{ title: 'Welcome' }} />
      {/* Add other screens here */}
    </Stack.Navigator>
  );
};

export default AppNavigator;