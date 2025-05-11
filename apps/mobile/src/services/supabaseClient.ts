import 'react-native-url-polyfill/auto'; // Handles URL polyfill for React Native
import * as SecureStore from 'expo-secure-store';
import { createClient } from '@supabase/supabase-js';
// Potentially import base Supabase URL and Anon Key from a shared config in @booking-and-accounts-monorepo/utils if not using env vars directly in mobile

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("ERROR: Supabase URL or Anon Key is missing from environment variables.");
  console.error("Ensure .env file is set up correctly in apps/mobile/ with EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.");
  // Consider throwing an error or providing a fallback/mock client for development if this occurs
  // to prevent the app from crashing silently or with obscure errors later.
}

const ExpoSecureStoreAdapter = {
  getItem: (key: string) => {
    return SecureStore.getItemAsync(key);
  },
  setItem: (key: string, value: string) => {
    SecureStore.setItemAsync(key, value);
  },
  removeItem: (key: string) => {
    SecureStore.deleteItemAsync(key);
  },
};

export const supabase = createClient(supabaseUrl!, supabaseAnonKey!, {
  auth: {
    storage: ExpoSecureStoreAdapter as any, // The `as any` is used in the guide, likely to reconcile types.
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});