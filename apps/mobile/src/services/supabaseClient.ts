import 'react-native-url-polyfill/auto'; // Handles URL polyfill for React Native
// We will no longer use SecureStore for Supabase auth here, as the shared client handles storage.
// import * as SecureStore from 'expo-secure-store';

// Import the centralized createClient function
import { createClient } from '@booking-and-accounts-monorepo/utils/supabase/client';

// Create and export the client instance using the shared utility.
// This client is already configured for React Native with AsyncStorage.
export const supabase = createClient();

// The old ExpoSecureStoreAdapter and direct client creation are no longer needed here
// for Supabase, as the shared utility handles platform-specific client setup.