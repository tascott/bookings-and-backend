import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import PetSelectorScreen from '../screens/staff/PetSelectorScreen'; // To be created
import PetImageGalleryScreen from '../screens/staff/PetImageGalleryScreen'; // To be created
import { PetWithDetails } from '@booking-and-accounts-monorepo/shared-types';

export type PetMediaStackParamList = {
  PetSelector: undefined; // No params for the selector screen itself
  PetImageGallery: { petId: number; petName?: string };
  // Potentially other screens like a dedicated image viewer/editor later
};

const Stack = createNativeStackNavigator<PetMediaStackParamList>();

export default function PetMediaStackNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        // headerShown: false, // Default to true, individual screens can override
      }}
    >
      <Stack.Screen
        name="PetSelector"
        component={PetSelectorScreen}
        options={{ title: 'Select Pet' }}
      />
      <Stack.Screen
        name="PetImageGallery"
        component={PetImageGalleryScreen}
        options={({ route }) => ({ title: route.params.petName ? `${route.params.petName} - Gallery` : 'Pet Images' })}
      />
    </Stack.Navigator>
  );
}