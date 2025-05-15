# Expo Mobile App Development Guide (booking-and-accounts)

**Objective:** Develop an Expo (React Native) mobile app for iOS and Android, reusing code from the existing Next.js web application via a pnpm monorepo structure.

**Current Status & Key Achievements:**
- Expo project initialized in `apps/mobile`.
- Core navigation structure with React Navigation (v7.x) is in place (`AppNavigator.tsx`).
- Authentication (Login, Signup) using Supabase client (with `expo-secure-store`) is functional.
- Role-based navigation directs users to `StaffDashboardScreen` or `ClientDashboardScreen` (placeholders exist).
- Staff Dashboard: "My Schedule" tab implemented using `react-native-calendars` (`Agenda` component), fetching data directly from Supabase via shared `api-services`.

**I. Monorepo Code Sharing Strategy:**

The project leverages a pnpm monorepo to share code between `apps/web` (Next.js) and `apps/mobile` (Expo).
- **`@booking-and-accounts-monorepo/shared-types`:** Consistent TypeScript type definitions.
- **`@booking-and-accounts-monorepo/utils`:** Shared utility functions. Supabase client setup is adapted in `apps/mobile/src/services/supabaseClient.ts` using `expo-secure-store` for token persistence.
- **`@booking-and-accounts-monorepo/api-services`:** Crucial for data interaction.
    - **Web:** Services make `fetch` calls to the Next.js backend API routes.
    - **Mobile:** Services have been adapted (e.g., `fetchBookingsDirect`, `fetchServices` modified) to accept the mobile Supabase client instance and perform *direct Supabase database calls*. This strategy avoids dependency on a running Next.js server for mobile development/operation.

**II. Core Mobile App Structure (`apps/mobile/src/`)**
- **`App.tsx`:** Main entry point, manages global auth state and navigation root.
- **`navigation/`:** React Navigation stacks and tabs (e.g., `AppNavigator.tsx`, `StaffTabNavigator.tsx`).
- **`screens/`:** Top-level views (e.g., `LoginScreen.tsx`, `SignUpScreen.tsx`, `MyScheduleScreen.tsx`, dashboard placeholders).
- **`components/`:** Reusable mobile-specific UI components.
- **`services/`:** Contains `supabaseClient.ts` (mobile-specific Supabase client initialization).
- **`hooks/`, `utils/`, `types/`:** For mobile-specific logic if not suitable for shared packages.
- **`assets/`:** Static assets.

**III. Key Implementation Details & Learnings:**

1.  **Supabase Integration & Data Fetching:**
    - Mobile Supabase client (`apps/mobile/src/services/supabaseClient.ts`) uses `EXPO_PUBLIC_` environment variables and `expo-secure-store`.
    - Data for screens like "My Schedule" is fetched using functions from the shared `api-services` package (e.g., `bookingService.fetchBookingsDirect(supabaseClient, ...)`), which perform direct database queries.

2.  **Authentication Flow:**
    - `LoginScreen.tsx` and `SignUpScreen.tsx` use the mobile Supabase client for auth operations.
    - `App.tsx` handles `onAuthStateChange` to navigate users appropriately.
    - `determineUserRole` function queries `staff` and `clients` tables for role-based redirection.

3.  **UI & Navigation:**
    - `react-navigation` (v7.x) for stack and tab navigation.
    - `react-native-calendars` (`Agenda` component) used for the "My Schedule" tab.

4.  **Bundling & Compatibility Gotchas:**
    - **Node.js Polyfills:** `@supabase/supabase-js` and other libraries may require Node.js core module polyfills. This was addressed by:
        - Installing `react-native-url-polyfill`, `react-native-get-random-values`, `events`, `stream-browserify`, `buffer`, etc.
        - Configuring `metro.config.js` to use `node-libs-react-native` or explicitly providing fallbacks in `extraNodeModules` and `resolver.sourceExts`.
        ```javascript // Example metro.config.js snippet
        // const defaultSourceExts = require('metro-config/src/defaults/defaults').sourceExts;
        // resolver: {
        //   extraNodeModules: require('node-libs-react-native'),
        //   sourceExts: process.env.RN_SRC_EXT
        //     ? [...process.env.RN_SRC_EXT.split(',').concat(defaultSourceExts), 'svg']
        //     : [...defaultSourceExts, 'svg'],
        // }
        ```
    - **`react-native-calendars` Patch:** The `Agenda` component had a "Maximum update depth exceeded" error. A patch was applied from a GitHub commit to `node_modules/react-native-calendars/src/agenda/reservation-list/index.js`. The patch was created and managed using `pnpm patch` and `pnpm patch-commit`, and is listed in `pnpm.patchedDependencies` in the root `package.json`.
    - **React Versioning:** Ensured `react` version in `apps/mobile` is strictly compatible with its `react-native` version (e.g., React 19.0.0 for RN 0.79.2) to avoid `react-native-renderer` and "Invalid hook call" errors. The web app can use a different compatible React version (e.g., 19.1.0).

5.  **Environment Variables:** Use `EXPO_PUBLIC_` prefix for client-side access. Configured in `.env` files. If dynamic values are needed at build time, `app.config.js` can be used.

**IV. Mobile App Development Roadmap:**

*   **Phase 1: Foundation & Core Staff Features (Current Focus)**
    *   [x] Monorepo & Shared Package Integration
    *   [x] Expo Project Init & Structure
    *   [x] Authentication & Role-Based Navigation
    *   [x] Staff Dashboard: "My Schedule" Tab (View bookings with `react-native-calendars`)
    *   **Next Up:**
        *   [ ] Staff Dashboard: "My Clients" Tab (List assigned clients, view basic details & pets, using direct Supabase calls via `api-services`).
        *   [ ] Staff Dashboard: Placeholder tabs for other staff functionalities (e.g., simplified availability view).

*   **Phase 2: Core Client Features**
    *   [ ] Client Dashboard: Shell and basic navigation.
    *   [ ] Client Dashboard: "My Bookings" Tab (View their bookings, direct Supabase calls via `api-services`).
    *   [ ] Client Dashboard: Basic "Book Service" Interface (service/date selection, view availability - adapting `calculate_available_slots` logic for direct Supabase calls via `api-services`).
    *   [ ] Client Dashboard: "My Pets" Tab (View pets; add/edit if time permits, direct Supabase calls via `api-services`).

*   **Phase 3: Native Feature Integration (Prioritized as needed)**
    *   [ ] Camera Access for Staff (Pet Images): `expo-image-picker` for taking/selecting photos, upload to Supabase Storage.
    *   [ ] Push Notifications: `expo-notifications` for booking confirmations, reminders. Requires backend setup (Supabase Functions) to trigger notifications.
    *   [ ] GPS/Location: `expo-location` if a clear use case emerges (e.g., staff check-ins, site finding).

*   **Phase 4: Testing, Refinement, Deployment (Ongoing)**
    *   Continuous UI/UX polish for mobile-first experience.
    *   Performance monitoring and optimization.
    *   Testing on physical iOS and Android devices.
    *   EAS Build configuration and submission preparation for app stores.

**V. Key Considerations (Recap):**
- **UI/UX Adaptation:** Web UIs require re-imagining for mobile. Focus on mobile-first design patterns.
- **Offline Support:** Not currently planned. If needed, would require AsyncStorage or a local DB.
- **Security:** Maintain secure practices for Supabase client access and data handling.

**VI. Deployment:**
- Expo Application Services (EAS) Build is the recommended method for creating production binaries (`.ipa`, `.aab`).
- EAS CLI will bundle the `apps/mobile` project, including resolved dependencies from shared packages, for cloud builds.

This guide focuses on the mobile application development within the monorepo context. For backend details, database schema, or web application specifics, refer to `overallguide.md` or the codebase directly.




**I. Philosophy: What to Reuse, What to Rebuild**

*   **Reuse (from Monorepo Shared Packages):**
    *   **Business Logic:** Pure JavaScript/TypeScript functions from `packages/utils` (imported via `@booking-and-accounts-monorepo/utils`).
    *   **API Service Calls:** The logic for making requests using services from `packages/api-services` (imported via `@booking-and-accounts-monorepo/api-services`). Your backend API routes remain the same.
    *   **Type Definitions:** All types from `packages/shared-types` (imported via `@booking-and-accounts-monorepo/shared-types`).
    *   **Supabase Client Integration:** The core Supabase client setup from `packages/utils` (imported via `@booking-and-accounts-monorepo/utils`), adapted for a mobile environment using Expo SecureStore.
    *   **State Management (if applicable):** If you're using a state management library like Zustand, Redux, or Jotai in a way that's decoupled from React components, some of this logic might be reusable.
*   **Rebuild/Adapt:**
    *   **UI Components:** Next.js/React web components (using `<div>`, `<img>`, `<input>`, etc.) will be rebuilt using React Native components (`<View>`, `<Image>`, `<TextInput>`, etc.).
    *   **Styling:** CSS styles will be translated to React Native's StyleSheet API (which uses JavaScript objects and is similar to CSS-in-JS, with Flexbox as the primary layout model). Global CSS files won't work directly.
    *   **Navigation:** Web routing (Next.js App Router) will be replaced with a mobile navigation solution, typically `react-navigation`.
    *   **Authentication Flow (UI):** The `AuthForm.tsx` UI will be rebuilt, but the underlying logic of calling Supabase Auth can be reused.
    *   **Platform-Specific Interactions:** Touch gestures, mobile-specific UX patterns.
    *   **Access to Native Features:** This will be new code using Expo APIs.


5.  **Proposed Directory Structure for \`apps/mobile\`:**
    \`\`\`
    apps/mobile/
    ├── assets/              # Static assets like images, fonts
    ├── src/
    │   ├── components/      # Reusable UI components (mobile-specific)
    │   ├── screens/         # Top-level screen components (e.g., LoginScreen, ClientDashboardScreen)
    │   ├── navigation/      # Navigation setup (using react-navigation)
    │   ├── services/        # Mobile-specific services (e.g., Supabase client for mobile - see Section III)
    │   ├── hooks/           # Custom React hooks for mobile
    │   ├── utils/           # Mobile-specific utility functions (prefer shared utils where possible)
    │   └── types/           # Mobile-specific types (prefer shared types where possible)
    ├── .expo/               # Expo-generated directory (add to .gitignore at root)
    ├── .gitignore           # Specific ignores for the mobile app (e.g., .expo/, node_modules/ if not handled by root)
    ├── App.tsx              # Main entry point for the Expo app (likely in src/ after setup)
    ├── index.ts             # Entry point registered with Expo
    ├── babel.config.js      # Babel configuration for the Expo app
    ├── tsconfig.json        # TypeScript configuration for the Expo app
    └── package.json         # Expo app's own package.json
    \`\`\`


**III. Migrating Core Logic & Services (Leveraging Monorepo Shared Packages)**

1.  **Type Definitions:**
    *   Import directly: `import { MyType } from '@booking-and-accounts-monorepo/shared-types';`
2.  **Supabase Integration:**
    *   Install the Supabase client: \`pnpm add @supabase/supabase-js\` (run from monorepo root, targeting the mobile app workspace if necessary, or add to \`apps/mobile/package.json\` and run \`pnpm install\` from root)
    *   Install a secure storage mechanism for tokens: \`npx expo install expo-secure-store\` (run from within \`apps/mobile\`)
    *   Create \`apps/mobile/src/services/supabaseClient.ts\` (or similar)
    *   **Environment Variables:** Ensure \`EXPO_PUBLIC_\` prefixed environment variables are set up for the mobile app.
3.  **Utility Functions:**
    *   Import directly from \`@booking-and-accounts-monorepo/utils\` for shared utilities.
    *   Mobile-specific utilities can reside in \`apps/mobile/src/utils/\`.
4.  **API Interaction (Reusing Backend Endpoints & Shared Services):**
    *   Your Next.js API routes (\`/api/...\`) remain the backend.
    *   Import and use API service functions directly from \`@booking-and-accounts-monorepo/api-services\`.
    *   Example: \`apps/mobile/src/services/someMobileFeatureApi.ts\` (if you need to wrap a shared service or add mobile specific logic)
        ```typescript
        import { getClientDetails as sharedGetClientDetails } from '@booking-and-accounts-monorepo/api-services';
        import type { Client } from '@booking-and-accounts-monorepo/shared-types';

        // Example of using a shared service directly or wrapping it
        export const getClientDetailsForMobile = async (clientId: string): Promise<Client | null> => {
          return sharedGetClientDetails(clientId);
        };
        ```

**IV. Building UI & Navigation**

1.  **Install Navigation:**
    ```bash
    npm install @react-navigation/native
    expo install react-native-screens react-native-safe-area-context
    npm install @react-navigation/native-stack # For stack navigator
    # Or @react-navigation/bottom-tabs, @react-navigation/drawer for other patterns
    ```
2.  **Set up Navigation (`src/navigation/AppNavigator.tsx`):**
    *   Define your navigation structure (e.g., an auth stack for login/signup, and a main app stack for once logged in).
    *   Refer to `react-navigation` documentation for detailed setup.
3.  **Authentication Screens (Adapting `AuthForm.tsx`):**
    *   Create `src/screens/LoginScreen.tsx`, `src/screens/SignUpScreen.tsx`.
    *   Use React Native components:
        *   `<View>` instead of `<div>`.
        *   `<Text>` instead of `<p>`, `<h1>`, etc.
        *   `<TextInput>` for input fields.
        *   `<TouchableOpacity>` or `<Pressable>` for buttons.
        *   `<Button>` (basic built-in button).
    *   Use `StyleSheet.create({...})` for styling.
    *   The logic to call `supabase.auth.signInWithPassword()` or `supabase.auth.signUp()` remains very similar.
4.  **Dashboard Screens (`ClientDashboard.tsx`, `StaffDashboard.tsx` equivalents):**
    *   Create `src/screens/ClientDashboardScreen.tsx`, `src/screens/StaffDashboardScreen.tsx`.
    *   Fetch necessary data using your API service functions.
    *   Implement role-based rendering to show the correct dashboard.
5.  **Component Mapping (General):**
    *   **HTML Tag -> React Native Component:**
        *   `div`, `section`, `article`, `nav`, `aside` -> `<View>`
        *   `p`, `span`, `h1-h6`, `label` -> `<Text>`
        *   `img` -> `<Image source={{ uri: '...' }} />` or `require('../assets/image.png')`
        *   `button` -> `<TouchableOpacity onPress={...}><Text>Button</Text></TouchableOpacity>`, or `<Button title="Button" onPress={...} />`
        *   `input` -> `<TextInput value={...} onChangeText={...} />`
        *   `ul`, `ol` -> `<FlatList data={...} renderItem={...} />` or `<ScrollView>` + `map`
        *   `a` (for navigation) -> Handled by `react-navigation` (e.g., `navigation.navigate('ScreenName')`)
        *   `a` (for external links) -> `Linking.openURL('...')` from `react-native`.
    *   **Styling:**
        *   Styles are JavaScript objects: `StyleSheet.create({ container: { flex: 1, padding: 10 } })`.
        *   Flexbox is the primary layout engine. It works similarly to web but with some RN-specific properties (e.g., `flexDirection` defaults to `column`).
        *   No CSS cascading. Styles are usually scoped to components.

**V. Implementing Native Features (Using Expo Modules)**

1.  **Camera Access (`expo-image-picker`):**
    *   `expo install expo-image-picker`
    *   In your staff profile or pet image upload section:
        ```typescript
        import * as ImagePicker from 'expo-image-picker';

        const pickImage = async () => {
          // Request camera roll permissions
          const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (status !== 'granted') {
            alert('Sorry, we need camera roll permissions to make this work!');
            return;
          }

          let result = await ImagePicker.launchImageLibraryAsync({ // or launchCameraAsync
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [4, 3],
            quality: 1,
          });

          if (!result.canceled) {
            const imageUri = result.assets[0].uri;
            // Now upload this imageUri to Supabase Storage
            // You'll need to convert the local URI to a Blob/File-like object for Supabase Storage.
            // A helper function might be needed for this conversion.
          }
        };
        ```
    *   **Uploading to Supabase Storage:** The `uri` from `expo-image-picker` is a local file URI. You'll need to fetch it as a blob and then upload.
        ```typescript
        // Helper (simplified, error handling needed)
        async function uploadImage(uri: string, path: string) {
            const response = await fetch(uri);
            const blob = await response.blob();
            const { data, error } = await supabase.storage
                .from('your-bucket-name') // e.g., 'pet-images'
                .upload(path, blob, {
                    cacheControl: '3600',
                    upsert: false, // or true if you want to overwrite
                    contentType: blob.type, // Make sure this is correct e.g. image/jpeg
                });
            if (error) throw error;
            return data;
        }
        // Usage:
        // const filePath = `pets/${petId}/${Date.now()}.jpg`; // Example path
        // await uploadImage(imageUri, filePath);
        // const { data: { publicUrl } } = supabase.storage.from('your-bucket-name').getPublicUrl(filePath);
        // Save publicUrl to your database.
        ```
    *   **Actual Implementation for Pet Image Management:**
        *   **Screens:** `PetSelectorScreen.tsx` allows staff to choose a pet, and `PetImageGalleryScreen.tsx` handles viewing, uploading, and deleting images for the selected pet. These are part of a dedicated `PetMediaStackNavigator` integrated into the `StaffTabNavigator`.
        *   **Image Picker:** `expo-image-picker` is used with `base64: false`, as the URI is the primary piece of information needed for uploads.
        *   **Upload Mechanism:** The shared `image-service.ts`'s `uploadPetImage` function was updated for mobile.
            *   Initially, attempts to upload base64-decoded `ArrayBuffer`s resulted in 0-byte files.
            *   **Solution:** The service now uses `FormData` for mobile uploads. An object containing the `uri` (from `expo-image-picker`), `name` (generated), and `type` (from `asset.mimeType`) is appended to `FormData`. This resolved the 0-byte file issues.
        *   **Supabase Client:** Ensured consistent use of the Supabase client from `packages/utils/supabase/client.ts` (configured with `AsyncStorage` for React Native) across the mobile app to resolve authentication and session persistence issues that affected data fetching and uploads.

2.  **GPS Access (`expo-location`):**
    *   `expo install expo-location`
    *   In the relevant component:
        ```typescript
        import *.Location from 'expo-location';

        const getLocation = async () => {
          let { status } = await Location.requestForegroundPermissionsAsync();
          if (status !== 'granted') {
            alert('Permission to access location was denied');
            return;
          }

          let location = await Location.getCurrentPositionAsync({});
          console.log(location.coords.latitude, location.coords.longitude);
          // Use the location
        };
        ```
3.  **Native Notifications (`expo-notifications`):**
    *   `expo install expo-notifications`
    *   **Setup:** This is more involved. You'll need to:
        *   Configure `expo-notifications` in your `App.tsx` (set notification handler).
        *   Request permissions.
        *   Get the Expo Push Token.
        *   Send this token to your backend and store it associated with the user.
        *   Your backend (e.g., using Supabase Functions triggered by database events, or from your Next.js API routes) will then use this token to send notifications via Expo's push service or directly via FCM/APNS if you configure that.
    *   Refer to the detailed `expo-notifications` documentation.

**VI. Code Sharing Strategy: Monorepo Implementation**

Our project has successfully implemented a monorepo structure to manage code sharing between the Next.js web app (\`apps/web\`) and the Expo mobile app (\`apps/mobile\`). This is the established and recommended approach for this project.

*   **Current Monorepo Structure:**
    \`\`\`
    monorepo-root/ (e.g., booking-and-accounts/)
    ├── apps/
    │   ├── web/               # Your Next.js app
    │   │   ├── src/
    │   │   └── ...
    │   ├── mobile/               <-- NEW: Your Expo project will live here
    │   │   ├── src/
    │   │   └── ...
    │   ├── shared-types/         <-- Shared TypeScript types
    │   │   └── src/ (or similar, containing types.ts, types_db.ts)
    │   │   └── package.json
    │   ├── api-services/         <-- Shared API client functions
    │   │   └── src/ (containing service files like bookingService.ts)
    │   │   └── package.json
    │   └── utils/                <-- Shared utilities (source for @booking-and-accounts-monorepo/utils)
    │       └── src/ (containing authUtils.ts, supabase client setup)
    │       └── package.json
    ├── .gitignore
    ├── package.json              <-- Root package.json for the monorepo (manages workspaces)
    ├── pnpm-workspace.yaml       <-- Defines the workspaces for PNPM (if using PNPM)
    └── README.md
    \`\`\`
*   **Benefits:**
    *   Both `web` and `mobile` apps depend on the shared packages (e.g., `@booking-and-accounts-monorepo/shared-types`, `@booking-and-accounts-monorepo/api-services`, `@booking-and-accounts-monorepo/utils`).
    *   This ensures consistency, reduces code duplication, and makes updates to shared logic straightforward through package manager linking (e.g., `pnpm install` at the root).
    *   Changes in shared packages are immediately available to both applications after a rebuild (if necessary) or by restarting development servers.


**Option 2: Using a Monorepo Tool (e.g., with PNPM Workspaces - a simpler monorepo tool)**

This is a more robust solution. PNPM is lightweight and good for this. Yarn Workspaces or NPM Workspaces are similar. Turborepo or Nx offer more features but have a steeper learning curve.

```
booking-and-accounts/       <-- Your existing Git repository root
├── .git/
├── docs/
├── packages/                 <-- Monorepo packages root
│   ├── web/                  <-- Your Next.js app
│   │   ├── src/
│   │   └── ...
│   ├── mobile/               <-- NEW: Your Expo project will live here
│   │   ├── src/
│   │   └── ...
│   ├── shared-types/         <-- Shared TypeScript types
│   │   └── src/ (or similar, containing types.ts, types_db.ts)
│   │   └── package.json
│   ├── api-services/         <-- Shared API client functions
│   │   └── src/ (containing service files like bookingService.ts)
│   │   └── package.json
│   └── utils/                <-- Shared utilities (source for @booking-and-accounts-monorepo/utils)
│       └── src/ (containing authUtils.ts, supabase client setup)
│       └── package.json
├── .gitignore
├── package.json              <-- Root package.json for the monorepo (manages workspaces)
├── pnpm-workspace.yaml       <-- Defines the workspaces for PNPM (if using PNPM)
└── README.md
```

**How this works (with PNPM as an example):**

1.  **Install Monorepo Manager (e.g., PNPM):** `npm install -g pnpm`
2.  **Structure:** The \`apps/\` directory holds applications, and \`packages/\` holds shared libraries:
    *   \`apps/web\`: Your Next.js application.
    *   \`apps/mobile\`: Your Expo application.
    *   \`packages/shared-types\`: Contains shared type definitions. Its \`package.json\` would name it \`@booking-and-accounts-monorepo/shared-types\`.
    *   \`packages/api-services\`: Contains shared API client functions. Its \`package.json\` would name it \`@booking-and-accounts-monorepo/api-services\`.
    *   \`packages/utils\`: Contains shared utilities. Its \`package.json\` would name it \`@booking-and-accounts-monorepo/utils\`.
3.  **Root `package.json` & Workspace Config:**
    *   The root `package.json` defines workspace settings (e.g., for PNPM, Yarn, or NPM).
    *   For PNPM, a `pnpm-workspace.yaml` file in the root lists the package locations (e.g., `packages/*`).
4.  **Initialize Expo App:** Initialize within \`apps/mobile\`.
5.  **Link Dependencies:**
    *   In \`apps/web/package.json\` and \`apps/mobile/package.json\`, add dependencies to the shared packages:
        \`"dependencies": { "@booking-and-accounts-monorepo/shared-types": "workspace:*", "@booking-and-accounts-monorepo/api-services": "workspace:*", "@booking-and-accounts-monorepo/utils": "workspace:*" }\`
    *   Run \`pnpm install\` (or equivalent for your chosen manager) in the root. This links the local packages.
6.  **Imports:**
    *   In \`apps/web\` and \`apps/mobile\`, import shared code using the package names:
        \`import { MyType } from '@booking-and-accounts-monorepo/shared-types';\`
        \`import { bookingService } from '@booking-and-accounts-monorepo/api-services';\`
7.  **Push to GitHub:** The entire monorepo structure is committed.

**How do I give only the Expo code to wherever hosts it? (Deployment)**

This is a key question and where build processes come in. Hosting platforms for mobile apps (App Store Connect for iOS, Google Play Console for Android) expect a compiled app binary (`.ipa` for iOS, `.aab` or `.apk` for Android), not your source code.

*   **Expo Application Services (EAS) Build:** This is the recommended way to build your Expo app for submission.
    1.  **Install EAS CLI:** `npm install -g eas-cli`
    2.  **Login:** `eas login`
    3.  **Configure:** \`eas build:configure\` (this creates an \`eas.json\` file in your \`apps/mobile\` directory).
    4.  **Build:** \`eas build -p android --profile preview\` (or \`-p ios\`, or \`--profile production\`).
        *   EAS Build will typically only look at the code within your Expo project directory (\`apps/mobile\`).
        *   It will bundle the necessary JavaScript and assets, including any code imported from your shared packages (e.g., \`@booking-and-accounts-monorepo/shared-types\`) because they are resolved as dependencies during the build process.
        *   It then builds the native binary in the cloud.
    5.  **Submit:** You download the built binary from EAS and upload it to the app stores.