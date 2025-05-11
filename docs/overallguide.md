Project Summary for AI Assistant (booking-and-accounts)

**Overall Goal:** Build a booking and multi-site management platform, initially for doggy daycare services, designed to be adaptable for other pet businesses.

**System Overview:**
- **Tech Stack:** Next.js (App Router), Supabase (Auth & PostgreSQL), React.
- **User Roles:** Admin, Staff, Client. Role-based access is enforced throughout the UI and API.
- **Data Fetching:** Data is primarily fetched within the relevant dashboard component (Admin, Staff, Client) after authentication and role determination, rather than being passed down from the main page.

**Code Sharing and Monorepo Strategy (Implemented):**
- **Motivation:** To maximize code reuse between the Next.js web application and future native mobile apps (planned with Expo/React Native), and to improve overall code organization and maintainability.
- **Monorepo Structure:** The project has been migrated to a monorepo structure, likely managed by a tool like PNPM workspaces. This involves a `packages/` directory at the root.
  - **`packages/web/`:** Contains the Next.js web application (previously the `src/`, `public/` etc. at the root).
  - **`packages/mobile/`:** Will contain the Expo/React Native mobile application (to be developed).
  - **Shared Packages:**
    - **`packages/shared-types/`:** Houses all shared TypeScript type definitions (e.g., `types.ts` for application types, `types_db.ts` for Supabase generated types). This code is consumable via the alias `@booking-and-accounts-monorepo/shared-types`.
    - **`packages/api-services/`:** Contains a crucial layer of modules that encapsulate client-side `fetch` calls to the backend API routes (e.g., `bookingService.ts`, `petService.ts`). Frontend components import and use these services (e.g., `import { bookingService } from '@booking-and-accounts-monorepo/api-services';`). This promotes consistency, simplifies component logic, and makes API interaction logic highly reusable.
    - **`packages/utils/`:** Contains shared utility functions, including Supabase client initialization (`supabase/client.ts`, `supabase/server.ts`, `supabase/admin.ts`) and authentication helpers (`authUtils.ts`). This code is consumable via the alias `@booking-and-accounts-monorepo/utils`.
- **Benefits:** This setup ensures consistency, simplifies dependency management, and makes code reuse between the web and mobile applications more robust and maintainable.

**Key Features:**
- **Authentication:**
  - Supabase Auth for user sign-up/login.
  - Role-based access: roles are managed in the `staff` table (for staff/admin) and inferred for clients via the `clients` table.
  - Sign-up/Login UI (`src/components/AuthForm.tsx`) adapts fields for each mode.
  - Welcome message (`src/app/page.tsx`) displays user name (from profiles) instead of email.
- **Admin/Staff UI:**
  - **User Management (`src/components/admin/UserManagement.tsx` located within `packages/web`):**
    - View all staff/admin users.
    - Assign roles (client/staff/admin) via API (leveraging `userService` from `@booking-and-accounts-monorepo/api-services`).
    - Promote clients to staff/admin using an autocomplete search (server-side, via `/api/clients`).
    - Assign default vehicles to staff members.
  - **Client Management (`src/components/admin/ClientManagement.tsx` located within `packages/web`):**
    - Paginated, searchable list of clients (excludes staff/admin users).
    - Assign a default staff member to each client via a dropdown.
    - Displays default staff member name (or "Unassigned").
    - Edit client profiles, manage their pets (add/edit/delete/confirm pets) - all actions utilize relevant API services from `@booking-and-accounts-monorepo/api-services`.
  - **Site & Field Management:** Create/view sites and fields (actions via `siteService` from `@booking-and-accounts-monorepo/api-services`).
  - **Service Management:**
    - Create/view services, including setting a mandatory `service_type` ('Field Hire' or 'Daycare').
    - Manage service availability rules (actions via `serviceService` from `@booking-and-accounts-monorepo/api-services`).
  - **Booking Management:** Create/view bookings, link bookings to clients and pets (actions via `bookingService` from `@booking-and-accounts-monorepo/api-services`).
  - **Vehicle Management:**
    - Admins can view/add/delete vehicles and assign them to staff (actions via `vehicleService` from `@booking-and-accounts-monorepo/api-services`).
    - Staff can view their own vehicles.
  - **Staff Availability Management:** UI to manage staff working hours/days off via `staff_availability` table (actions via `staffAvailabilityService` from `@booking-and-accounts-monorepo/api-services`).
- **Client UI:**
  - **Booking Interface (`src/components/client/ClientBooking.tsx` located within `packages/web`):**
    - Select service/date, view available slots (fetches via `availabilityService` from `@booking-and-accounts-monorepo/api-services` calling `/api/available-slots`).
    - Book services (no same-day bookings). Performs capacity/availability checks. Booking submission via `bookingService` from `@booking-and-accounts-monorepo/api-services`.
  - **Pet Management:**
    - Add/edit/delete pets, view all pets (actions via `petService` from `@booking-and-accounts-monorepo/api-services`).
  - **My Bookings:**
    - View past/upcoming bookings, see details and linked pets (fetches via `bookingService` from `@booking-and-accounts-monorepo/api-services`).

**Database Schema Summary:**
- **auth.users:** Managed by Supabase Auth. Columns: id (uuid, PK), email, etc.
- **profiles:** user_id (uuid, PK, FK to users.id), first_name, last_name, phone, email_allow_promotional, email_allow_informational. (No business_type).
- **clients:** id (serial PK), user_id (uuid, FK to profiles.user_id), email, default_staff_id (integer, FK to staff.id). (No profile fields directly).
- **staff:** id (serial PK), user_id (uuid, FK to profiles.user_id), role (admin/staff), notes, default_vehicle_id (bigint, FK to vehicles.id).
- **staff_availability:** id (bigint PK), staff_id (integer, FK to staff.id), start_time, end_time, days_of_week (integer[]), specific_date (date), is_available (boolean), created_at, updated_at.
- **user_business_affiliations:** user_id (uuid, PK, FK to auth.users), business_type (TEXT, PK), created_at (timestamptz). Links users to business areas.
- **sites, fields, services, service_availability, bookings, booking_clients, pets, booking_pets, payments, vehicles:** See below for details.

**Table Details:**
- **profiles:** (See Schema Summary) - Does not contain `business_type`. Names/phone stored here.
- **user_business_affiliations:**
    - user_id (uuid, PK, FK to users.id)
    - business_type (TEXT, PK) - e.g., 'Pet Services', 'Field Hire'
    - created_at (timestamptz)
- **sites:** id, name, address, is_active
- **fields:** id, site_id (FK), name, field_type
- **services:** id, name, description, created_at, requires_field_selection, default_price, service_type (TEXT NOT NULL CHECK(service_type IN ('Field Hire', 'Daycare')))
- **service_availability:**
    - id (bigint PK)
    - service_id (FK)
    - field_ids (integer[] NOT NULL) -- Now always required
    - start_time, end_time (time without timezone)
    - days_of_week (integer[] | null) -- Array of numbers 1-7 (Mon-Sun)
    - specific_date (date | null)
    - use_staff_vehicle_capacity (boolean NOT NULL DEFAULT FALSE) -- If TRUE, capacity uses assigned staff vehicle; otherwise capacity is effectively unlimited unless further field/service constraints are applied.
    - is_active (boolean)
    - created_at (timestamptz)
    - override_price (numeric | null)
    - CHECK constraint: `use_staff_vehicle_capacity = TRUE OR (field_ids IS NOT NULL AND array_length(field_ids, 1) > 0)`
- **bookings:** id, field_id (FK), start_time, end_time, service_type (varchar), status, max_capacity, assigned_staff_id (uuid, FK to auth.users), vehicle_id (integer, FK to vehicles.id), assignment_notes, is_paid (boolean).
- **booking_clients:** id, booking_id (FK), client_id (FK)
- **pets:** id, client_id (FK), name, breed, size, is_confirmed
- **booking_pets:** id, booking_id (FK), pet_id (FK)
- **payments:** id, client_id (FK), booking_id (FK), amount, currency, status, created_at
- **vehicles:** id, make, model, year, color, license_plate, notes, pet_capacity.
- **staff_availability:** (See schema summary)

**Foreign Key Relationships:**
- profiles.user_id → users.id
- user_business_affiliations.user_id → auth.users.id
- clients.user_id → profiles.user_id
- clients.default_staff_id → staff.id
- staff.user_id → profiles.user_id
- staff.default_vehicle_id → vehicles.id
- staff_availability.staff_id → staff.id
- pets.client_id → clients.id
// - vehicles.staff_id → staff.id (This FK seems incorrect based on current usage - vehicles aren't directly linked to staff, staff have a default_vehicle_id)
- bookings.field_id → fields.id
- bookings.assigned_staff_id → auth.users.id
- bookings.vehicle_id → vehicles.id
- booking_clients.booking_id → bookings.id
- booking_clients.client_id → clients.id
- booking_pets.booking_id → bookings.id
- booking_pets.pet_id → pets.id

**API Route Reference:**
(Note: Frontend components now interact with these APIs primarily through the service modules, e.g., `import { bookingService } from '@booking-and-accounts-monorepo/api-services';`)
- **/api/users**
  - Purpose: Manage all users (admin, staff, client) and assign roles.
  - Usage: Used for role management and admin-level user queries.
  - Not for client search or client-specific data.
- **/api/clients**
  - **GET:**
    - Purpose: Fetch client data (search, pagination, profile, pets, default staff name).
    - Usage: Used for client lists and management in the UI.
    - Excludes users who are also present in the `staff` table.
    - Supports `search`, `limit`, `offset` query params. Returns `{ clients: [...], total: N }`. Includes flattened profile and `default_staff_name`.
    - Supports `assigned_staff_id=me` query param. If present and the user is authenticated staff, returns only clients where `clients.default_staff_id` matches the staff member's ID. Excludes `default_staff_name` in this mode.
  - **POST:** Create a new client record (Admin only).
- **/api/clients/[clientId]**
    - **GET:** Fetch specific client details including pets.
    - **PUT:** Update client details. Handles updates to both `clients` table (`email`, `default_staff_id`) and `profiles` table (`first_name`, `last_name`, `phone`) based on incoming data.
- **/api/staff**
  - **GET:** Fetches a list of staff members (`id`, `first_name`, `last_name`) excluding admins. Used for populating assignment dropdowns.
- **/api/staff/assignment**
  - **PATCH:** Assigns a `default_vehicle_id` to a staff member.
- **/api/vehicles**
  - GET: Admins fetch all vehicles or filter by staff; staff fetch their own vehicles.
  - POST: Admins add a new vehicle.
  - DELETE: Admins delete a vehicle by ID.
- **/api/pets**, **/api/pets/[petId]**, **/api/clients/[clientId]/pets**:
  - CRUD for pets, linked to clients.
  - `/api/clients/[clientId]/pets` specifically used by admin/staff to fetch a client's pets.
- **/api/bookings**, **/api/client-booking**, **/api/my-bookings**, **/api/bookings/[bookingId]/status**:
  - Bookings CRUD, client booking flow, viewing client bookings, updating payment status.
  - `POST /api/client-booking`: Handles client-initiated bookings. Now accepts an array payload `{ bookings: [...] }` to handle multiple slot bookings in one request.
      - Performs capacity checks for each requested booking based on the matched `service_availability` rule:
      - Finds the active rule matching service/date/time.
      - If `use_staff_vehicle_capacity` is TRUE:
          - Checks client's `default_staff_id` is set, available (`staff_availability`), and has a default vehicle.
          - Sets `max_effective_capacity` to the vehicle's `pet_capacity`.
          - Checks overlaps based on bookings assigned to that specific staff member (`assigned_staff_id`).
          - Finds an available field from the rule's `field_ids` not fully booked by other services/staff.
          - Assigns the determined `field_id`, `assigned_staff_id`, and `vehicle_id` to the new booking.
      - If `use_staff_vehicle_capacity` is FALSE:
          - Sets `max_effective_capacity` to a very high number (effectively unlimited for this specific rule check).
          - Checks overlaps based on bookings in *any* of the rule's `field_ids`.
          - Determines `field_id` based on client selection (if `requires_field_selection`) or assigns the first available.
          - Sets `assigned_staff_id` and `vehicle_id` to `null`.
      - Compares requested pets against remaining capacity.
      - Returns `201 Created` if all bookings succeed.
      - Returns `207 Multi-Status` if some succeed and some fail, detailing outcomes in `successfulBookings` and `failedBookings` arrays.
      - Sends a single confirmation email (`BookingConfirmationClient`/`Admin`) for a single successful booking or a summary email (`BookingSummaryClient`/`Admin`) for multiple successful bookings.
  - **/api/admin-booking**:
    - **POST:** Handles admin/staff-initiated bookings. Bypasses some standard checks.
    - **Pet Verification:** Checks that selected pets belong to the selected client but *does not* currently check if pets are marked as `is_active` or `is_confirmed`. This allows admins to book for any pet owned by the client.
- **/api/available-slots:**
  - Returns available booking slots for a service/date, requires auth.
  - Calls `calculate_available_slots` RPC, passing client's `default_staff_id`.
  - RPC returns potential time slots based on rules, including:
      - `slot_start_time`, `slot_end_time` (Now generated based on 'Europe/London' timezone)
      - `slot_remaining_capacity`: Calculated capacity based on rules/overlaps (NULL if unlimited).
      - `rule_uses_staff_capacity`: Boolean flag.
      - `associated_field_ids`: Array of field IDs for the slot.
  - RPC Capacity Logic:
      - If `rule_uses_staff_capacity`=TRUE: Checks availability/vehicle capacity/overlaps for the passed-in `in_client_default_staff_id`. Returns remaining vehicle capacity, or 0 if staff unavailable/no vehicle/all associated fields booked.
      - If `rule_uses_staff_capacity`=FALSE: Calculates remaining capacity based on total bookings across all `associated_field_ids` (no specific base limit applied at this level).
      - **Note:** The RPC returns slots even if the calculated `slot_remaining_capacity` is 0.
  - API formats capacity for display, filters out past slots, and returns the list.
  - Returns available booking slots for a service/date range, requires auth.
  - Fetches the service's `default_price`.
  - Fetches active `service_availability` rules for the service that could apply.
  - Calls `calculate_available_slots` RPC, passing client's `default_staff_id`.
  - RPC returns potential time slots based on rules, including:
      - `slot_start_time`, `slot_end_time`
      - `slot_remaining_capacity`: Calculated capacity based on rules/overlaps (NULL if unlimited).
      - `rule_uses_staff_capacity`: Boolean flag.
      - `associated_field_ids`: Array of field IDs for the slot.
  - RPC Capacity Logic (Detailed):
      - If `rule_uses_staff_capacity`=TRUE:
          - Checks if the passed-in `in_client_default_staff_id` is set, has a default vehicle with `pet_capacity` > 0, and is generally available via `staff_availability` for the slot time.
          - If staff/vehicle checks pass: Calculates the total number of pets already assigned to the *same staff member* in other bookings that *overlap* with the potential `slot_start_time` and `slot_end_time`.
          - Subtracts the calculated `total_assigned_pets` from the staff's default vehicle `pet_capacity`.
          - Returns this difference as `slot_remaining_capacity` (minimum 0).
          - Returns 0 if staff is unavailable, has no vehicle, or vehicle capacity is 0.
          - **Note:** Associated fields (`associated_field_ids`) are returned for informational purposes or potential assignment later, but they **do not** impose a capacity limit in this mode. The vehicle capacity is the sole constraint.
      - If `rule_uses_staff_capacity`=FALSE:
          - Calculates remaining capacity based on total bookings across all `associated_field_ids` (no specific base limit applied at this level).
          - **Note:** The RPC returns slots even if the calculated `slot_remaining_capacity` is 0.
  - **API Route Processing:**
      - For each slot returned by the RPC, the API route determines the applicable price:
          - Finds the best matching active `service_availability` rule (specific date rule > recurring day rule).
          - Uses the rule's `override_price` if set, otherwise uses the service's `default_price` (defaults to 0 if neither is set).
      - Formats a `capacity_display` string for the UI.
      - Filters out slots starting today or earlier.
      - Returns the list of slots, including the calculated `price_per_pet`.
- **/api/fields, /api/sites, /api/services, /api/service-availability, /api/service-availability/[ruleId]**:
  - CRUD for fields, sites, services, and service availability rules.
  - `GET /api/services`: Returns services including `service_type`. Supports `?active=true` filter.
  - `POST /api/services`: Requires `name` and `service_type` ('Field Hire' or 'Daycare').
  - `PUT /api/services/[serviceId]`: Allows updating fields including `service_type`.
  - `service-availability` endpoints now handle `use_staff_vehicle_capacity` (boolean) instead of `capacity_type` and require `field_ids` (array). No longer uses `base_capacity`.

**Component/File Structure:**
- **src/app/page.tsx (within `packages/web`):** Main entry point.
  - Handles authentication state.
  - Fetches user profile (`profiles`) and business affiliations (`user_business_affiliations`).
  - Determines user role (`staff`, `client`, or `admin`).
  - Determines the *current* business context. **For now, it prioritizes 'Pet Services' if the user is affiliated.** Passes this context (`businessType`) to the relevant dashboard.
  - Renders the correct dashboard (Admin, Staff, Client) based on role.
- **src/components/admin/AdminDashboard.tsx (within `packages/web`):** Container for admin features. Fetches and manages state for users, sites, fields, services, vehicles, bookings, availability etc., needed for its child components (UserManagement, SiteFieldManagement, ServiceManagement...). Contains action handlers. (API calls refactored to use services from `@booking-and-accounts-monorepo/api-services`)
- **src/components/admin/UserManagement.tsx (within `packages/web`):** View staff/admin, assign roles/vehicles. (Uses `userService` from `@booking-and-accounts-monorepo/api-services`)
- **src/components/admin/ClientManagement.tsx (within `packages/web`):** List/search clients (clients only), assign default staff, manage client info/pets via modal. Fetches its own client data. (Uses `clientService`, `petService` from `@booking-and-accounts-monorepo/api-services`)
- **src/components/admin/BookingManagement.tsx (within `packages/web`):** Create/manage bookings. (Uses `bookingService`, `clientService`, `petService`, `availabilityService` from `@booking-and-accounts-monorepo/api-services`)
- **src/components/admin/ServiceManagement.tsx (within `packages/web`):** Manage services. Includes dropdown for `service_type` on add/edit and filtering by type. (Uses `serviceService` from `@booking-and-accounts-monorepo/api-services`)
- **src/components/admin/SiteFieldManagement.tsx (within `packages/web`):** Manage sites/fields. (Uses `siteService` from `@booking-and-accounts-monorepo/api-services`)
- **src/components/admin/ServiceAvailabilityManagement.tsx (within `packages/web`):** Manage service availability rules. UI updated to use `use_staff_vehicle_capacity` checkbox instead of `capacity_type`; field selection is always present. No longer uses `base_capacity` field. (Uses `serviceService` from `@booking-and-accounts-monorepo/api-services`)
- **src/components/client/ClientDashboard.tsx (within `packages/web`):** Container for client features.
  - Receives `user` and the current `businessType` context as props.
  - Fetches data relevant to the client view (e.g., profile details, services).
  - Uses the `businessType` prop to conditionally render UI elements (e.g., hides 'My Pets' navigation if `businessType` is 'Field Hire').
  - Contains child components like `ClientBooking`, `PetManagement`, `MyBookings`. (These children use relevant API services from `@booking-and-accounts-monorepo/api-services`)
- **src/components/client/ClientBooking.tsx (within `packages/web`):** Client booking UI.
  - Fetches availability using `availabilityService` (which calls `calculate_available_slots` RPC via `/api/available-slots`).
  - Displays slots in calendar and list format.
  - Uses `isSlotBookedBySelectedPets` to check for existing bookings for selected pets.
  - Disables slots in the list view and provides visual cues (text suffix) if already booked or full.
  - Uses `eventStyleGetter` in CalendarView to visually distinguish already booked slots (greyed out).
  - Slot selection (via calendar or list) uses the original timestamp string as the key for consistency.
  - Booking submission uses `bookingService` (which calls `POST /api/client-booking`).
  - Supports selecting multiple available slots.
  - Booking submission collects all selected slots and sends a single request to `bookingService` using the `{ bookings: [...] }` format.
- **src/components/client/PetManagement.tsx (within `packages/web`):** Client pet management UI. (Uses `petService` from `@booking-and-accounts-monorepo/api-services`)
- **src/components/client/MyBookings.tsx (within `packages/web`):** Client booking history/upcoming bookings. (Uses `bookingService` from `@booking-and-accounts-monorepo/api-services`)
- **src/components/staff/StaffDashboard.tsx (within `packages/web`):** Container for staff features. Fetches and manages state for bookings, services etc., needed for its child components. (API calls refactored to use services from `@booking-and-accounts-monorepo/api-services`)
  - **My Clients Tab:** Displays a list of clients for whom the logged-in staff member is the `default_staff_id`. Fetches data via `clientService` (calling `/api/clients?assigned_staff_id=me`). Shows client name, email, phone, and a nested list of their pets.
- **packages/utils/authUtils.ts:** Centralized authentication/authorization helpers. Consumed via `@booking-and-accounts-monorepo/utils`.
- **packages/utils/supabase/client.ts, server.ts, admin.ts:** Supabase client initializers. Consumed via `@booking-and-accounts-monorepo/utils`.
- **packages/shared-types/types.ts, types_db.ts:** Shared TypeScript definitions. Consumed via `@booking-and-accounts-monorepo/shared-types`.
- **packages/api-services/*:** Modules for client-side API interactions. Consumed via `@booking-and-accounts-monorepo/api-services`.

**SQL/Data Insertion Best Practices:**
- User signs up via `AuthForm`.
- `signup` server action calls `supabase.auth.signUp`, passing `first_name`, `last_name`, `phone`, and `business_type` (from the form dropdown) in `options.data`.
- `handle_new_user` trigger on `auth.users` table:
  - Inserts into `profiles` using metadata (`first_name`, `last_name`, `phone`).
  - Inserts into `clients` using `user_id` and `email`.
  - Inserts into `user_business_affiliations` using `user_id` and `business_type` from metadata.
- Only insert columns that exist in the table.
- Use `ON CONFLICT DO NOTHING` for idempotency where appropriate.
- `clients` table does not have `first_name`, `last_name`, `phone`, `created_at`.
- `staff` table gets names/phone via `profiles` join.

**Best Practices for LLMs/Developers:**
- **Multi-Frontend Architecture:** The system is designed for multiple frontends (e.g., `pet-services.app`, `field-hire.app`) sharing a single Supabase backend.
- **User Affiliation:** Use the `user_business_affiliations` table to check which business areas a user has access to.
- **Business Context:** Each frontend application is responsible for establishing its "business context" (e.g., 'Pet Services' or 'Field Hire'). UI elements and logic should be filtered based on both the user's affiliations and the current context.
- **Shared Code & Monorepo:** Leverage the monorepo structure and its shared packages (`@booking-and-accounts-monorepo/shared-types`, `@booking-and-accounts-monorepo/api-services`, `@booking-and-accounts-monorepo/utils`) for types, Supabase client setup, utility functions, and API service abstractions to ensure consistency and prepare for mobile app development.

**React Native / Expo Migration Plan (High-Level):**
This section outlines how to leverage the existing Next.js codebase, especially the monorepo's shared packages, to build a mobile app using Expo.

**I. Philosophy: What to Reuse, What to Rebuild**
- **Reuse (Primarily from Monorepo Shared Packages):**
    - **Business Logic:** Pure JavaScript/TypeScript functions from `packages/utils/` (imported via `@booking-and-accounts-monorepo/utils`).
    - **API Service Calls:** The logic for making requests via `packages/api-services/` (imported via `@booking-and-accounts-monorepo/api-services`). The backend API routes remain the same.
    - **Type Definitions:** All types from `packages/shared-types/` (imported via `@booking-and-accounts-monorepo/shared-types`).
    - **Supabase Client Integration:** The core Supabase client setup principles from `packages/utils/supabase/` (imported via `@booking-and-accounts-monorepo/utils`), adapted for a mobile environment (e.g., using Expo SecureStore for token storage).
    - **State Management (if applicable):** If using a state management library decoupled from React components, some logic might be reusable.
- **Rebuild/Adapt (Mobile-Specific):**
    - **UI Components:** Next.js/React web components will be rebuilt using React Native components (`<View>`, `<Image>`, `<TextInput>`, etc.).
    - **Styling:** CSS styles will be translated to React Native's StyleSheet API.
    - **Navigation:** Web routing will be replaced with a mobile navigation solution (e.g., `react-navigation`).
    - **Authentication Flow (UI):** The `AuthForm.tsx` UI will be rebuilt, but the underlying logic (calling Supabase Auth via `authService` or similar) can be reused.
    - **Platform-Specific Interactions & Native Features:** New code using Expo APIs for camera, GPS, notifications.

**II. Project Setup & Initial Structure (Expo App)**
1.  **Install Expo CLI & Create Project.**
2.  **Directory Structure Suggestion (within the mobile app):** Similar to web, e.g., `src/components/`, `src/screens/`, `src/navigation/`, `src/services/` (for any mobile-specific service wrappers if needed, though ideally most API logic is shared), `src/hooks/`, `src/utils/` (for mobile-specific utils).

**III. Migrating Core Logic & Services (Leveraging Monorepo Packages)**
1.  **Type Definitions:** Directly import from `@booking-and-accounts-monorepo/shared-types`.
2.  **Supabase Integration:**
    - Install `@supabase/supabase-js` and `expo-secure-store`.
    - Create a Supabase client instance in the mobile app (e.g., `packages/mobile/src/services/supabaseClient.ts`). This can leverage utilities from `@booking-and-accounts-monorepo/utils` but will use `ExpoSecureStoreAdapter` for session persistence.
3.  **Utility Functions:** Import directly from `@booking-and-accounts-monorepo/utils`.
4.  **API Interaction:** Import and use service functions directly from `@booking-and-accounts-monorepo/api-services`. The existing backend endpoints (`/api/...`) are called by these shared services.

**IV. Building UI & Navigation (Mobile-Specific)**
- Rebuild UI components using React Native equivalents.
- Implement mobile navigation using `react-navigation`.

**V. Implementing Native Features (Using Expo Modules)**
- Use `expo-image-picker`, `expo-location`, `expo-notifications` as needed.

**VI. Code Sharing Strategy (Monorepo Implemented)**
- The project now utilizes a monorepo structure.
- **Monorepo Structure:**
  ```
  booking-and-accounts/ (monorepo-root)
  ├── packages/
  │   ├── shared-types/    # Source for @booking-and-accounts-monorepo/shared-types
  │   ├── api-services/    # Source for @booking-and-accounts-monorepo/api-services
  │   ├── utils/           # Source for @booking-and-accounts-monorepo/utils
  │   ├── web/             # Next.js app
  │   └── mobile/          # Expo app (to be developed)
  ├── package.json         # Root package.json for managing workspaces (e.g., with PNPM)
  └── ...
  ```
- Both `web` (`packages/web`) and `mobile` (`packages/mobile`) apps depend on the shared packages (e.g., `@booking-and-accounts-monorepo/shared-types`), ensuring consistency and simplifying updates to shared logic.

**VII. AI Editor Context**
- This guide, especially with the monorepo structure and shared packages, provides strong architectural context for an AI editor.
- The AI can assist in: refactoring, suggesting React Native component equivalents, scaffolding, and writing API service calls based on the shared patterns.
- Limitations remain for UI/UX nuance and complex native debugging.

(Original Phase 1, 2, 3, Key Considerations, etc. from the previous guide version can follow here, but ensure paths and strategies are updated to reflect the `shared-code` and API service refactoring throughout those sections if they are retained in full detail.)

