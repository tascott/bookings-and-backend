# App Requirements & Tech Stack

Overall Goal: Build a booking and multi-site management platform for doggy daycare and related services, allowing clients to easily reserve times, staff to coordinate events, and admins to oversee operations. It should be flexible enough to expand into other types of field rentals or classes, with streamlined payments and role-specific dashboards.

Purpose: A doggy daycare booking and multi-site management platform.

## Overview
- Monorepo structure.
- Client-facing mobile (React Native) and web (Next.js) apps.
- Admin/Staff dashboard (Next.js web) with role-based access.
- Backend-as-a-Service (BaaS) for data storage, authentication, real-time updates.
- Payment integrations.

## Tech Stack
1. **Next.js** (for web frontend & admin)
2. **React Native** (for iOS/Android)
3. **Turborepo** (or Nx) for monorepo organization.
4. **Supabase** (or Firebase) as the BaaS.
5. **Serverless Functions** (if needed for advanced logic/payment webhooks).
6. **Git** for version control.

## Requirements
- Users can create and manage bookings.
- Staff can assign themselves to bookings, handle capacity.
- Roles (client, staff, admin) each see data relevant to them.
- Payment flow supports multiple services (daycare, rentals, classes, etc.).
- Minimal overhead for a solo developer (simple deployment/config).

## Steps to Complete
1. **Initialize Monorepo**
   - Create a Turborepo project.
   - Define sub-projects: `apps/web`, `apps/mobile`, shared config.
2. **Set Up BaaS**
   - Configure Supabase project (or Firebase) for auth, data.
   - Create or import DB tables (SQL is separate).
   - Implement row-level security or rules for roles.
3. **Implement Next.js Web**
   - Admin/staff dashboards for booking oversight.
   - Role-based routing and data fetches from BaaS.
4. **Implement React Native App**
   - Client-facing features: sign up, view/book fields, pay.
   - Possibly staff login if combined.
5. **Integrate Payments**
   - Use Stripe or direct BaaS payment APIs.
   - Handle transaction status updates.
6. **Role-Based Access**
   - Align user roles in BaaS with front-end.
   - Show/hide fields based on user type.
7. **Testing & Deployment**
   - CI/CD pipeline for monorepo.
   - Deploy web via Vercel (or Netlify).
   - Use Expo for mobile builds.
8. **Enhancements** (Optional)
   - Map integration.
   - Calendar UI for booking.
   - Notifications via push or email.

_Refer to the existing SQL schema (not included here) for data definitions._


## UI Structure: Role-Based Tabbed Dashboards

The application features a tabbed interface structure to provide role-appropriate dashboards for each user type. Each dashboard shows only the relevant features to that user role:

### Admin Dashboard Tabs
- **User Management**: Control user roles and permissions
- **Sites & Fields**: Manage physical locations and fields
- **Bookings**: View and manage all bookings across the system
- **Services**: Configure the services offered (daycare, training, etc.)
- **Service Availability**: Set times when services are available
- **Client Management**: Manage client information and pets

### Staff Dashboard Tabs
- **My Schedule**: View personal shift schedule and assignments
- **Today's Bookings**: View bookings for the current day
- **My Clients**: Access details of clients assigned to staff's shifts

### Client Dashboard Tabs
- **Book Services**: Make new bookings
- **My Bookings**: View personal booking history
- **My Pets**: Add and manage pet information
- **My Account**: View/edit personal account information

## Implementation Details
The tabbed interface is built as a reusable component (`TabNavigation`) that can be configured for each user role. This provides consistent UX across the application while displaying only the permissions-appropriate content to each user type.


Current TODOS:

- addresses/map view/multi-map view (staff/admin)
- add email template editing UI
- remove all inline CSS for a design system (different file for button, nav, colors, etc)
- Implement Email Preference Checks: We added email_allow_promotional and email_allow_informational flags to the profiles table, but we haven't added logic



// Codebase Improvement Todos
- refactor code, reduce codebase, update docs
- split large files
- repomix
- error handling, tests
- caching throughout specially for api calls, combine them? we fetch multiple things every time Next reloads or we even look at the page.
- Think about how we'll use the same code for "field hire" clients. Fork it, or everyone in same DB/code just with a flag?

// Payment specific
- stripe integration (supabase) linked to bookings via the `payments` table.
- booking refunds (maybe hold cash until day of booking?)
- referral system


Future:
- discount feature for additional pets but set to 0% for nows - per client basis