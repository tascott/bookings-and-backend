# App Development Guide

This document outlines key development steps and decisions made during the app build process.

## Feature Implementation Log

### My Schedule Screen (`MyScheduleScreen.tsx`)

**Goal:** Display staff member's schedule using `react-native-calendars` `Agenda` component.
**Environment:** React Native (Expo)

**Steps & File Path:** `apps/mobile/src/screens/staff/MyScheduleScreen.tsx`

1.  **Initial Setup:** Implemented `Agenda` component to show bookings.
2.  **Fix Day Selection:** Modified `onDayPress` and `selected` prop to link calendar strip selection to the displayed date.
3.  **Fix Empty State:** Ensured `renderEmptyDate` correctly displays when no bookings exist for the selected date.
4.  **List Filtering:** Adjusted `items` prop to filter the list view to only show bookings for the `selected` date.
5.  **Event Dots:** Re-introduced event indicator dots for all dates with bookings by using the `markedDates` prop, separating the data source for dots from the data source for the filtered list (`items`).
6.  **UI Refinement (Knob Removal):** Hid the pull-down calendar knob using `hideKnob={true}` and `renderKnob={() => null}` to simplify the UI and bypass a bug with the week strip becoming unresponsive after interacting with the full calendar.
7.  **UI Refinement (Compactness):** Adjusted theme font sizes (`textDayHeaderFontSize`, `textDayFontSize`) and reduced padding/margins (`styles.emptyDate`, `styles.item`) to make the calendar strip and list area more compact.
8.  **Booking Display - Group by Session:**
    *   Implemented session-based grouping for bookings displayed in the `Agenda` component.
    *   This involved updating data processing in `fetchAndProcessBookings` (using `MyAgendaItemGroupEntry` structure) and modifying `renderItem` logic.
    *   File affected: `apps/mobile/src/screens/staff/MyScheduleScreen.tsx`.
9.  **Navigation - Direct to Client Details & Stack Implementation:**
    *   Refactored navigation from the "My Schedule" tab to go directly to `ClientDetailsScreen` from a schedule item.
    *   Introduced `ScheduleStackNavigator` in `apps/mobile/src/navigation/StaffTabNavigator.tsx` to manage the "MySchedule" tab's navigation stack (containing `MyScheduleHome`, `ClientDetailsScreen`, `SessionBookingsScreen`), improving navigation logic and resolving back-button issues.

### Booking Management Screen (`BookingManagementScreen.tsx`)

**Goal:** Display a paginated list of all bookings for the staff member, grouped by date and session, with navigation to session details and then client details.

**Steps & File Paths:**
*   `apps/mobile/src/screens/staff/BookingManagementScreen.tsx`
*   `apps/mobile/src/screens/staff/SessionBookingsScreen.tsx`
*   `apps/mobile/src/screens/staff/ClientDetailsScreen.tsx`
*   `apps/mobile/src/navigation/StaffTabNavigator.tsx`
*   `packages/shared-types/types.ts`

1.  **Initial Setup (Booking List):** Created `BookingManagementScreen.tsx` to fetch and display all bookings for the `userId` passed via route params (`fetchBookingsDirect`). Implemented loading, error, and empty states.
2.  **Grouping:** Used `SectionList` to group bookings first by date (descending) and then by session (`service_type`). Added date headers (`formatDate`).
3.  **Pagination:** Implemented infinite scroll. Fetches all bookings initially but only displays `BOOKINGS_PER_PAGE` (10) dates. `handleEndReached` loads the next page of dates into `visibleDates` state, triggering a re-render of `groupedSections`.
4.  **Session Details Screen:** Created `SessionBookingsScreen.tsx` to display all bookings for a specific session on a specific date. It receives `userId`, `dateKey`, and `session` via route params. Fetches all staff bookings then filters client-side.
5.  **Client Details Screen Setup:** Created `ClientDetailsScreen.tsx` to display details for a client, receiving `clientId` via route params.
6.  **Navigation Stack:**
    *   Implemented a Stack Navigator (`BookingStackNavigator`) within the "Bookings" tab in `StaffTabNavigator.tsx` using `@react-navigation/native-stack`.
    *   Screens in stack: `BookingManagementScreen` -> `SessionBookingsScreen` -> `ClientDetailsScreen`.
    *   Updated `BookingManagementScreen.tsx` to navigate to `SessionBookingsScreen` on session card press.
    *   Updated `SessionBookingsScreen.tsx` to navigate to `ClientDetailsScreen` on booking item press, passing `client_id`.
7.  **Populate Client Details:**
    *   Updated `ClientDetailsScreen.tsx` to fetch client data from the `clients` table and associated profile data (name, phone) from the `profiles` table using Supabase direct calls.
    *   Fetches associated pets from the `pets` table.
    *   Displays full client contact information and a list of their pets with details (name, breed, age, notes).
8.  **Type Update (`Pet`):** Added optional `age` (number) and `notes` (string) fields to the `Pet` type definition in `packages/shared-types/types.ts` to support displaying more pet information.

### Navigation Enhancements (`StaffTabNavigator.tsx`)

1.  **Header Display Fix for Nested Stacks:**
    *   Resolved an issue where screens within tabs that used nested StackNavigators (i.e., "MySchedule" and "BookingManagement" tabs) displayed duplicate header titles.
    *   The fix involved setting `headerShown: false` in the `options` for the respective `Tab.Screen` components in `StaffTabNavigator.tsx`. This allows the header of the nested StackNavigator to be the single source of truth for the screen's title, while the `title` option in the `Tab.Screen` continues to provide the label for the bottom tab bar.

### Pet Image Management (Core Infrastructure)

**Goal:** Establish the backend and shared infrastructure for allowing staff to upload images for pets, and for clients to view them.

**Steps & File Paths:**
*   Database: `pet_images` table (SQL migration `create_pet_images_table_v3`)
*   Storage: Supabase bucket `pet-images` (created manually, private)
*   Shared Types: `packages/shared-types/types.ts` (added `PetImage` type, updated `Pet` type)
*   API Services: `packages/api-services/src/image-service.ts`

1.  **Database Schema (`pet_images` table):**
    *   Created a new table `pet_images` to store metadata for pet photos (ID, `pet_id`, `uploaded_by_staff_id`, `storage_object_path`, `caption`, `file_name`, `mime_type`, `size_bytes`, `created_at`).
    *   Foreign keys link to `pets.id` (integer) and `staff.id` (integer).
    *   `ON DELETE CASCADE` for `pet_id` ensures images are removed if a pet is deleted.
    *   `ON DELETE SET NULL` for `uploaded_by_staff_id` preserves images if a staff member is deleted.
2.  **Row Level Security (RLS) for `pet_images`:**
    *   Implemented RLS policies (migration `create_pet_images_rls_policies`):
        *   Staff can insert images (checking `staff.user_id` against `auth.uid()` and ensuring `uploaded_by_staff_id` matches their `staff.id`).
        *   Staff can select all pet images (can be refined later).
        *   Staff can update captions of images they uploaded.
        *   Staff can delete images they uploaded.
        *   Clients can select images for their own pets (joining through `pets` and `clients` tables to `auth.uid()`)
3.  **Supabase Storage Bucket:**
    *   Manually created a **private** storage bucket named `pet-images` to store the image files.
4.  **Shared TypeScript Definitions (`packages/shared-types/types.ts`):**
    *   Added a `PetImage` interface to define the structure for image metadata, including an optional `image_url` for fetched (signed) URLs.
    *   Updated the `Pet` interface to include an optional `images?: PetImage[];` array.
5.  **API Service (`packages/api-services/src/image-service.ts`):**
    *   Created `image-service.ts` with functions for image and pet-list retrieval:
        *   `uploadPetImage`: Handles image uploads to the `pet-images` bucket and records metadata in the `pet_images` table. Includes basic handling for web (`File`) and mobile (`{uri: string}`) inputs, with a note that mobile URI-to-blob conversion needs robust implementation.
        *   `getPetImages`: Fetches image metadata for a pet and enhances it by generating **signed URLs** (valid for 1 hour) for accessing images from the private bucket.
        *   `deletePetImage`: Deletes an image from storage and its corresponding database record.
        *   `getAllPetsWithClientNames`: Fetches a list of all pets in the system (`PetWithDetails[]`, including client names by joining with `clients` and `profiles`). Returns `PetWithDetails[]`.
        *   `getTodaysPetsForStaff`: Fetches a list of pets (`PetWithDetails[]`, including client names) that are part of bookings assigned to the staff member for the current day. This involves checking `bookings.assigned_staff_id` (which is a staff `user_id` UUID) and joining through `booking_pets` to `pets`, then to `clients` and `profiles`. Returns `PetWithDetails[]`.
    *   Added `PetWithDetails` type to `packages/shared-types/types.ts` (extends `Pet` with `client_name`). Updated `Pet` type to make `name` and `is_confirmed` nullable to match database schema.
    *   Ensured Supabase client calls are correctly typed after regenerating `packages/shared-types/types_db.ts` to include the `pet_images` table and reflect correct column types.

### Phase 2: Web App Implementation (`apps/web`)

**Goal:** Provide staff users with a web interface to select pets and manage their images (view, upload, delete).
**Environment:** Next.js (React)

**File Paths & Key Components:**
*   `apps/web/src/components/staff/media/PetMediaSelector.tsx`: Component for selecting a pet. Fetches "Today's Pets" and "All Pets" for staff. Navigates to the individual pet's image gallery page.
*   `apps/web/src/app/dashboard/staff/media/page.tsx`: Route page that renders the `PetMediaSelector`.
*   `apps/web/src/app/dashboard/staff/media/[petId]/page.tsx`: Dynamic route page for displaying and managing images for a specific pet.

**Key Features & Implementation Details for `[petId]/page.tsx`:**
1.  **Pet ID Handling:** Extracts `petId` from dynamic route parameters. Resolved Next.js warning regarding `params` access by using `React.use(paramsPromise)`.
2.  **Image Display:** Fetches and displays existing images for the selected pet using `getPetImages` from `image-service.ts`. Signed URLs are generated for viewing images from the private `pet-images` bucket.
3.  **Image Upload:**
    *   Provides a file input (`<input type="file" accept="image/*">`) and an optional caption field.
    *   Uses the `uploadPetImage` service function to handle file upload to Supabase Storage and record metadata in the `pet_images` database table.
    *   The `useUser` hook (placeholder for actual auth logic) is used to retrieve the `staffId` required for associating the upload with the correct staff member.
4.  **Image Deletion:**
    *   Adds a "Delete" button to each image card.
    *   Prompts the user with a confirmation dialog (`window.confirm`) before proceeding.
    *   Uses the `deletePetImage` service function to remove the image from Supabase Storage and its corresponding record from the `pet_images` database table.
5.  **Signed URL Handling & UI Robustness:**
    *   To handle potential delays in Supabase Storage replication (where a newly uploaded file might not be immediately available for signed URL generation), the following approach is used:
        *   The `uploadPetImage` service attempts to generate a signed URL immediately after upload (with a brief internal retry for "Object not found" errors).
        *   If this fails, the image is still added to the UI optimistically (possibly showing "Image URL not available").
        *   The gallery page then triggers a delayed re-fetch of all images for the pet a few seconds after an upload completes. This second fetch is more likely to successfully generate the signed URL.
6.  **State Management:** Manages loading states for fetching images, uploading, and deleting, as well as error states for these operations, providing feedback to the user.
7.  **Required Storage RLS Policies for `pet-images` bucket (for authenticated staff):**
    *   **INSERT:** To allow uploading new image files.
        *   `EXISTS (SELECT 1 FROM staff WHERE staff.user_id = auth.uid())`
    *   **SELECT:** To allow reading image files (necessary for generating signed URLs).
        *   `EXISTS (SELECT 1 FROM staff WHERE staff.user_id = auth.uid())`
    *   **DELETE:** To allow deleting image files, ensuring staff can only delete images they uploaded.
        *   `EXISTS (SELECT 1 FROM public.staff s JOIN public.pet_images pi ON s.id = pi.uploaded_by_staff_id WHERE s.user_id = auth.uid() AND pi.storage_object_path = name)`

### Phase 3: Mobile App Implementation (`apps/mobile`)

**Goal:** Provide staff users with a mobile interface to select pets and manage their images (view, upload, delete), leveraging existing API services.
**Environment:** React Native (Expo)

**Key Components & Navigation Structure:**
1.  **Navigation Setup (`apps/mobile/src/navigation/`):**
    *   `PetMediaStackNavigator.tsx`: A new stack navigator created to manage screens for pet image functionality. Includes routes for `PetSelectorScreen` and `PetImageGalleryScreen`.
    *   `StaffTabNavigator.tsx`: Updated to include a new "Pet Media" tab, which uses the `PetMediaStackNavigator` as its component. The tab navigator's header is hidden for this tab to allow the stack navigator to control its own header.
2.  **Pet Selection Screen (`apps/mobile/src/screens/staff/PetSelectorScreen.tsx`):
    *   Fetches and displays two lists of pets: "Today's Pets" (using `getTodaysPetsForStaff`) and "All Pets" (using `getAllPetsWithClientNames`) from the shared `image-service.ts`.
    *   Requires integration with mobile authentication to get `staffUserId` for fetching "Today's Pets".
    *   Uses `FlatList` to display pet items, which navigate to `PetImageGalleryScreen` on press, passing `petId` and `petName`.
    *   Includes basic loading and error handling states.
3.  **Pet Image Gallery Screen (`apps/mobile/src/screens/staff/PetImageGalleryScreen.tsx`):
    *   (Placeholder created) Will be responsible for fetching, displaying, uploading, and deleting images for a given `petId`.
    *   Will use `expo-image-picker` for selecting images from the device or taking new photos.
    *   Will utilize the `uploadPetImage`, `getPetImages`, and `deletePetImage` functions from the shared `image-service.ts`.

**Current Status:** Navigation and the pet selector screen structure are in place. Next steps involve implementing the detailed functionality of `PetSelectorScreen` (auth integration) and then building out `PetImageGalleryScreen`.

**Actual Implementation for Pet Image Management:**
*   **Screens:** `PetSelectorScreen.tsx` allows staff to choose a pet, and `PetImageGalleryScreen.tsx` handles viewing, uploading, and deleting images and videos for the selected pet. These are part of a dedicated `PetMediaStackNavigator` integrated into the `StaffTabNavigator`.
*   **Media Picker (`expo-image-picker`):**
    *   Configured with `mediaTypes: ImagePicker.MediaTypeOptions.All` to allow selection of both images and videos.
    *   `base64: false` is used, as the URI is the primary piece of information for uploads.
*   **Media Display (Mobile - `PetImageGalleryScreen.tsx`):**
    *   Conditionally renders an `<Image>` component for images or an `expo-av <Video>` component for videos based on the `mime_type` of the media item.
    *   The `expo-av` package was installed for video playback capabilities.
    *   A simple text label (e.g., "[Video]" or "[Image]") is displayed on each media item for easy identification.
*   **Upload Mechanism:** The shared `image-service.ts`'s `uploadPetImage` function handles both image and video files for mobile.
    *   Initial attempts to upload base64-decoded `ArrayBuffer`s resulted in 0-byte files.
    *   **Solution:** The service now uses `FormData` for mobile uploads. An object containing the `uri` (from `expo-image-picker`), `name` (generated), and `type` (from `asset.mimeType` or inferred) is appended to `FormData`. This resolved the 0-byte file issues and works for both images and videos.
*   **Supabase Client:** Ensured consistent use of the Supabase client from `packages/utils/supabase/client.ts` (configured with `AsyncStorage` for React Native) across the mobile app.
*   **Developer/LLM Notes for Future Extensions (Mobile):**
    *   **Advanced Video Player:** For a more customized UX, replace `expo-av`'s default controls with a custom video player interface.
    *   **Video Thumbnails:** Consider generating and displaying thumbnails for videos in the gallery (e.g., using a Supabase Function to extract a frame) for a better preview experience before loading/playing the full video.
    *   **Background Uploads:** For larger video files, implement background upload functionality to improve UX.
    *   **Video Editing/Trimming:** `expo-image-picker`'s `allowsEditing` might have limited support for videos; more advanced video editing/trimming would require dedicated libraries.
    *   **Optimized Video Loading:** For performance, explore techniques like progressive loading or adaptive bitrate streaming if video playback becomes a bottleneck.

2.  **GPS Access (`expo-location`):**