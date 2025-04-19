# Current Application Architecture & Features

## 1. Overall Goal

Build a booking and multi-site management platform for doggy daycare and related services, allowing clients to easily reserve times, staff to coordinate events, and admins to oversee operations. It should be flexible enough to expand into other types of field rentals or classes, with streamlined payments and role-specific dashboards. Designed to be simple enough for potential resale.

## 2. Tech Stack

-   **Framework:** Next.js (App Router)
-   **Frontend:** React (within Next.js)
-   **Styling:** CSS Modules
-   **Monorepo:** Turborepo (implied from `steps.txt`)
-   **Backend:** Supabase (BaaS for Auth, Database)
-   **Database:** PostgreSQL (via Supabase)
-   **Authentication:** Supabase Auth with `@supabase/ssr` library

## 3. Database Schema Overview

Key tables currently implemented:

-   **`auth.users` (Supabase Internal):** Handles core user authentication details (email, password hash, user ID).
-   **`public.clients`:** Stores application-specific client profiles. Linked to `auth.users` via `user_id`. Includes `name`, `email`. New users are automatically added here via a database trigger.
-   **`public.staff`:** Stores staff/admin profiles. Linked to `auth.users` via `user_id`. Includes `name`, `role` ('admin', 'staff'), `phone_number`, etc.
-   **`public.sites`:** Represents physical locations (e.g., "Downtown Site"). Contains `name`, `address`, `is_active`.
-   **`public.fields`:** Represents bookable areas within a Site (e.g., "Field A"). Contains `site_id` (FK to `sites`), `name`, `capacity`, `field_type`.
-   **`public.services`:** Defines the types of services offered (e.g., "Doggy Daycare AM", "Full Day Field Hire"). Contains `name`, `description`.
-   **`public.service_availability`:** Defines the rules for when and where services are available. Links `service_id` to an array of applicable `field_ids`. Contains time rules (`start_time`, `end_time`), recurrence rules (`days_of_week` array [1-7 for Mon-Sun], `specific_date`), optional `base_capacity`, and `is_active` flag.
-   **`public.bookings`:** Stores actual booking instances (created manually by admin/staff via UI currently). Contains `field_id`, `start_time`, `end_time`, `service_type`, `status`, `max_capacity`.
-   **`public.booking_clients`:** (Exists in schema) Join table to link `bookings` to `clients`. **Not yet utilized** in the booking creation flow.
-   **`public.pets`:** (Exists in schema) Table to store client pets. **Not yet implemented** in the UI/API.
-   **`public.payments`:** (Exists in schema) Placeholder for payment tracking. **Not yet implemented**.

## 4. Authentication & Authorization

-   Uses Supabase Auth with email/password (and potentially OAuth providers later via UI).
-   Leverages the `@supabase/ssr` library with client (`client.ts`), server (`server.ts`), and admin (`admin.ts`) utility functions in `src/utils/supabase`.
-   Middleware (`src/middleware.ts` using `src/utils/supabase/middleware.ts`) handles session refreshing.
-   Upon signup, a database trigger (`handle_new_user`) automatically creates a corresponding entry in the `public.clients` table.
-   User roles ('admin', 'staff', 'client') are determined by checking the `staff` and `clients` tables after login.
-   Authorization checks are implemented in API routes to restrict actions (e.g., creating sites/services/availability) to admins.

## 5. Implemented UI Features (`src/app/page.tsx`)

-   **Login/Signup:** Custom form using Server Actions (`src/app/actions.ts`) for email/password login and signup (collects name during signup).
-   **Role Display:** Shows logged-in user's email and determined role.
-   **Admin Dashboard Sections:**
    -   **User Management:** Lists all registered users (`auth.users`), determines their role from `staff`/`clients`, allows admins to assign roles ('client', 'staff', 'admin') via API calls.
    -   **Site & Field Management:** Lists existing sites and their fields. Forms allow admins to add new sites and add new fields to existing sites.
    -   **Booking Management:** Lists existing bookings. Form allows admins/staff to manually create new bookings (low-level record creation).
    -   **Service Management:** Lists existing services. Form allows admins to add new services.
    -   **Service Availability Management:** Lists existing service availability rules. Form allows admins to define new rules, linking a service to multiple fields and specifying time/recurrence.

## 6. Implemented API Routes

-   `/api/users`: `GET` (list users+roles for admin), `POST` (assign roles for admin).
-   `/api/sites`: `GET` (list sites for admin/staff), `POST` (create site for admin).
-   `/api/fields`: `GET` (list fields for admin/staff), `POST` (create field for admin).
-   `/api/bookings`: `GET` (list bookings for admin/staff), `POST` (create booking for admin/staff).
-   `/api/services`: `GET` (list services for logged-in users), `POST` (create service for admin).
-   `/api/service-availability`: `GET` (list rules for admin/staff), `POST` (create rule for admin).
-   `/auth/confirm`: Handles email verification callback (if enabled).
-   `/error`: Basic error display page.

## 7. Current State Summary

The application has foundational authentication, role management, and admin interfaces for managing the core data entities (Sites, Fields, Services, Availability Rules, Users). A basic manual booking creation/viewing tool exists for admins/staff. The next major step involves implementing the client-facing booking logic based on the defined service availability rules.