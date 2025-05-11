Project Summary for AI Assistant (booking-and-accounts)

**Overall Goal:** Build a booking and multi-site management platform, initially for doggy daycare services, adaptable for other pet businesses, with web and mobile frontends.

**System Overview:**
- **Tech Stack:** Next.js (App Router), Supabase (Auth & PostgreSQL), React, Expo (for mobile).
- **User Roles:** Admin, Staff, Client.
- **Data Fetching:** Primarily within dashboard components. Mobile app uses direct Supabase calls via shared services.

**Code Sharing and Monorepo Strategy (Implemented):**
- **Motivation:** Maximize code reuse between Next.js web (`apps/web`) and Expo mobile (`apps/mobile`) applications.
- **Structure:** PNPM monorepo.
  - **`apps/web/`:** Next.js application.
  - **`apps/mobile/`:** Expo mobile application.
    - *Status: Basic auth, navigation, and Staff "My Schedule" tab (using `react-native-calendars` with a patch) are implemented.*
  - **Shared Packages (`packages/`):**
    - **`shared-types/` (`@booking-and-accounts-monorepo/shared-types`):** TypeScript definitions.
    - **`api-services/` (`@booking-and-accounts-monorepo/api-services`):** Encapsulates data interaction.
        - For web: Client-side `fetch` calls to Next.js backend API routes.
        - For mobile: Direct Supabase calls (passing the mobile Supabase client), avoiding the need for the Next.js server to be running for mobile development/use. Functions adapted (e.g., `fetchBookingsDirect`).
    - **`utils/` (`@booking-and-accounts-monorepo/utils`):** Shared utilities, Supabase client helpers (adapted for mobile with `expo-secure-store`).
- **Benefits:** Consistency, reduced duplication, simplified dependency management.

**Key Web Features (Summary):**
- **Authentication:** Supabase Auth, role-based access (`staff`, `clients` tables).
- **Admin/Staff UI:** User/Client/Site/Field/Service/Booking/Vehicle/Staff Availability management.
- **Client UI:** Booking interface, Pet management, "My Bookings."
- *Detailed component interactions and API calls for web are primarily handled through `api-services`.*

**Database Schema Summary:**
- Core tables: `auth.users`, `profiles`, `clients`, `staff`, `staff_availability`, `user_business_affiliations`, `sites`, `fields`, `services`, `service_availability`, `bookings`, `booking_clients`, `pets`, `booking_pets`, `vehicles`.
- *Refer to `types_db.ts` for detailed column definitions and relationships.*

**API Route Reference (for Web Backend):**
- The Next.js app (`apps/web`) exposes various API routes (e.g., `/api/users`, `/api/clients`, `/api/bookings`, `/api/available-slots`).
- Web frontend components interact with these primarily via the `api-services` shared package.
- Mobile app largely bypasses these by using direct Supabase calls through modified functions in `api-services`.

**Component/File Structure (Web - `apps/web`):**
- `src/app/page.tsx`: Main entry, auth, role/business context determination, dashboard rendering.
- `src/components/...`: Admin, client, staff dashboards and sub-components.
- *Most data fetching and actions are delegated to `api-services`.*

**SQL/Data Insertion Best Practices:**
- New user signup via `AuthForm` triggers `handle_new_user` in Supabase (via `options.data` in `signUp`).
- Trigger populates `profiles`, `clients`, and `user_business_affiliations`.

**Best Practices for LLMs/Developers:**
- **Multi-Frontend Architecture:** System supports multiple web frontends and a mobile app on a single backend.
- **User Affiliation & Business Context:** Use `user_business_affiliations` and application-defined context.
- **Shared Code & Monorepo:** Heavily leverage shared packages.

**React Native / Expo Mobile App Development Plan & Status:**

**I. Philosophy: What to Reuse, What to Rebuild**
- **Reuse (from Monorepo Shared Packages):**
    - **Business Logic:** From `@booking-and-accounts-monorepo/utils`.
    - **Data Interaction Logic:** Modified services from `@booking-and-accounts-monorepo/api-services` (using direct Supabase calls for mobile).
    - **Type Definitions:** From `@booking-and-accounts-monorepo/shared-types`.
    - **Supabase Client Integration:** Core setup from `@booking-and-accounts-monorepo/utils`, adapted with `expo-secure-store` for mobile token storage (`apps/mobile/src/services/supabaseClient.ts`).
- **Rebuild/Adapt (Mobile-Specific):**
    - **UI Components:** Using React Native components.
    - **Styling:** React Native StyleSheet.
    - **Navigation:** `react-navigation` (v7.x).
    - **Authentication Flow (UI):** Login/Signup screens built with RN components, using shared auth logic.

**II. Current Status & Key Implementation Details (`apps/mobile`)**
1.  **Project Setup:** Expo app in `apps/mobile` within the pnpm monorepo. Standard `src/` structure (components, screens, navigation, services).
2.  **Authentication & Basic Navigation:**
    - Login (`LoginScreen.tsx`) and Sign-Up (`SignUpScreen.tsx`) implemented using Supabase auth.
    - Central auth state management in `App.tsx` (`useEffect`, `onAuthStateChange`).
    - Role-based navigation (`determineUserRole` checking `staff` then `clients`) to `StaffDashboardScreen` or `ClientDashboardScreen` (placeholders exist).
    - Navigation uses `@react-navigation/native`, `@react-navigation/native-stack`, `@react-navigation/bottom-tabs` (v7.x).
3.  **Staff Dashboard - "My Schedule" Tab:**
    - Implemented in `MyScheduleScreen.tsx` within a tab navigator (`StaffTabNavigator.tsx`).
    - Uses `react-native-calendars` (`Agenda` component) to display bookings.
    - Data fetched via `fetchBookingsDirect` and `fetchServices` (modified) from `@booking-and-accounts-monorepo/api-services`, which take the mobile Supabase client.
4.  **Environment Variables:** Using `EXPO_PUBLIC_` prefixed variables (e.g., in `.env`), accessed via `app.config.js` if dynamic configuration is needed, or directly.

**III. Key Learnings & Gotchas for Mobile Development:**
1.  **Bundling & Polyfills:**
    - `@supabase/supabase-js` (and other Node.js-dependent libraries) required polyfills for Node core modules.
    - Solution: Installed `react-native-url-polyfill`, `react-native-get-random-values`, `node-libs-react-native`.
    - Configured `metro.config.js` to use `node-libs-react-native`.
2.  **`react-native-calendars` Patching:**
    - Encountered "Maximum update depth exceeded" error with `Agenda` component when updating items.
    - Applied a patch manually from a GitHub commit to `node_modules/react-native-calendars/src/agenda/reservation-list/index.js`.
    - Generated and committed patch file using `pnpm patch` and `pnpm patch-commit`. Added to `pnpm.patchedDependencies` in root `package.json`.
3.  **React Version Compatibility:**
    - Initial "Invalid hook call / useImperativeHandle of null" after patching was due to React version mismatches.
    - `react-native` (e.g., v0.79.2) has strict peer dependencies on `react` (e.g., v19.0.0 for `react-native-renderer`).
    - Ensured `apps/mobile/package.json` uses the React version compatible with its `react-native` version, while `apps/web` can use a slightly different compatible version (e.g., React 19.1.0). PNPM handles this separation.
4.  **Data Fetching for Mobile:**
    - Shifted from attempting to call Next.js API routes to direct Supabase calls from `api-services`. This avoids needing the Next.js dev server for mobile development and simplifies mobile data logic. Shared service functions were refactored to accept a Supabase client instance.
5.  **Expo Configuration:**
    - Renamed `app.json` to `app.config.js` for dynamic configuration (e.g., `extra.apiBaseUrl` if calling external APIs, though less relevant now for core data).

**IV. Mobile App Roadmap (Updated):**

*   **Phase 1: Foundation & Core Staff Features (Largely Complete)**
    *   [x] Monorepo Setup & Shared Package Integration
    *   [x] Expo Project Initialization & Basic Structure
    *   [x] Authentication (Login, Signup, Session Management)
    *   [x] Role-Based Navigation (Staff/Client Dashboards)
    *   [x] Staff Dashboard: "My Schedule" Tab (View bookings with `react-native-calendars`)
    *   [ ] Staff Dashboard: "My Clients" Tab (List assigned clients & basic details)
    *   [ ] Staff Dashboard: Other core tabs (e.g., simplified view of their availability)

*   **Phase 2: Core Client Features**
    *   [ ] Client Dashboard: "My Bookings" Tab (View their bookings)
    *   [ ] Client Dashboard: Basic "Book Service" Interface (service/date selection, view availability - reusing `calculate_available_slots` logic via `api-services`)
    *   [ ] Client Dashboard: "My Pets" Tab (View pets, potentially add/edit if straightforward)

*   **Phase 3: Native Feature Integration (as prioritized)**
    *   [ ] Camera Access (e.g., for pet images by staff) - `expo-image-picker`
    *   [ ] Push Notifications (e.g., booking confirmations/reminders) - `expo-notifications`
    *   [ ] GPS/Location (if specific use cases are defined) - `expo-location`

*   **Phase 4: Testing, Refinement, and Deployment (Ongoing)**
    *   UI/UX Polish for mobile.
    *   Performance optimization.
    *   Thorough testing on devices.
    *   EAS Build and submission preparation.

**V. Monorepo Structure (Conceptual):**
  \`\`\`
  booking-and-accounts/ (monorepo-root)
  ├── apps/
  │   ├── web/             # Next.js app
  │   └── mobile/          # Expo app
  ├── packages/
  │   ├── shared-types/
  │   ├── api-services/
  │   └── utils/
  ├── package.json         # Root pnpm workspace config
  ├── pnpm-workspace.yaml
  └── ...
  \`\`\`
- Both `apps/web` and `apps/mobile` depend on shared packages.

This guide provides a snapshot. For detailed, up-to-the-minute status of web features or database schema, direct code inspection or more specific queries are best.