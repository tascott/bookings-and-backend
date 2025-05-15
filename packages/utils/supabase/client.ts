import { createBrowserClient } from '@supabase/ssr'
import { createClient as createJSClient } from '@supabase/supabase-js'
// DO NOT import Platform or AsyncStorage from react-native packages at the top level here

// Ensure these are defined in your environment files
// For web (e.g., Next.js in apps/web): .env.local with NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY
// For mobile (e.g., Expo in apps/mobile): .env with EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY

export function createClient() {
  let supabaseUrl: string | undefined;
  let supabaseAnonKey: string | undefined;
  let isWebEnvironment = false;

  // Check for Next.js specific environment variables to determine if this is a web environment
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    isWebEnvironment = true;
  }
  // Check for Expo specific environment variables for React Native environment
  else if (process.env.EXPO_PUBLIC_SUPABASE_URL && process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY) {
    supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
    isWebEnvironment = false;
  } else {
    // If neither set of environment variables is found, throw an error.
    let message = 'Supabase URL and Anon Key are required but not found. ';
    message += 'Ensure NEXT_PUBLIC_SUPABASE_URL/KEY (for web) or EXPO_PUBLIC_SUPABASE_URL/KEY (for mobile) are set and accessible in your environment.';
    throw new Error(message);
  }

  if (isWebEnvironment) {
    // Web environment: use createBrowserClient from @supabase/ssr
    return createBrowserClient(supabaseUrl!, supabaseAnonKey!);
  } else {
    // React Native environment: use createClient from @supabase/supabase-js with AsyncStorage
    // Conditionally require AsyncStorage to prevent web bundler errors.
    try {
      const AsyncStorage = require('@react-native-async-storage/async-storage').default;
      return createJSClient(supabaseUrl!, supabaseAnonKey!, {
        auth: {
          storage: AsyncStorage,
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: false, // Not relevant for React Native
        },
      });
    } catch (e) {
      console.error(
        "Failed to load AsyncStorage for React Native Supabase client. " +
        "Ensure '@react-native-async-storage/async-storage' is installed in your mobile app. " +
        "Falling back to in-memory session persistence.",
        e
      );
      // Fallback to in-memory client if AsyncStorage fails (session won't persist across app closes)
      return createJSClient(supabaseUrl!, supabaseAnonKey!, {
        auth: {
            autoRefreshToken: true,
            persistSession: true, // This will be in-memory
            detectSessionInUrl: false,
        }
      });
    }
  }
}