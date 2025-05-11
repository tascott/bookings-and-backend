import { SupabaseClient } from '@supabase/supabase-js'; // Will be removed if no Supabase direct functions remain
import { Booking, UpdateBookingPayload, CreateBookingPayload, Service, Pet } from '@booking-and-accounts-monorepo/shared-types';

// Configuration for the API base URL - this should be set by the calling environment.
// e.g., in mobile: const API_URL = Constants.expoConfig.extra.apiBaseUrl;
// e.g., in web: const API_URL = process.env.NEXT_PUBLIC_API_BASE_URL;
// For now, functions will require it as a parameter or use a placeholder.
let configuredApiBaseUrl = '';

export function configureApiBaseUrl(baseUrl: string) {
    configuredApiBaseUrl = baseUrl;
}

function getApiBaseUrl(): string {
    if (!configuredApiBaseUrl) {
        // In a real app, you might throw an error or have a more robust fallback/check.
        // For development, especially if Next.js and mobile emulator are on the same machine,
        // localhost might work for Next.js dev server, but won't for deployed mobile app.
        console.warn('API Base URL not configured. Falling back to placeholder or empty string.');
        // return 'http://localhost:3000'; // Example placeholder, USE WITH CAUTION.
    }
    return configuredApiBaseUrl;
}

export interface UpdateBookingStatusPayload {
    is_paid?: boolean;
    status?: string;
}

interface FetchBookingsAPIOptions {
    assigned_staff_id?: string;
    client_user_id?: string;
    start_date?: string;
    end_date?: string;
}

/**
 * Fetches bookings from the API (e.g., Next.js backend).
 */
export async function fetchBookingsAPI(apiBaseUrl: string, options?: FetchBookingsAPIOptions): Promise<Booking[]> {
    let url = `${apiBaseUrl}/api/bookings`;
    const queryParams = new URLSearchParams();

    if (options?.assigned_staff_id) {
        queryParams.append('assigned_staff_id', options.assigned_staff_id);
    }
    if (options?.client_user_id) {
        queryParams.append('client_user_id', options.client_user_id);
    }
    if (options?.start_date) {
        queryParams.append('start_date', options.start_date);
    }
    if (options?.end_date) {
        queryParams.append('end_date', options.end_date);
    }

    if (queryParams.toString()) {
        url += `?${queryParams.toString()}`;
    }

    console.log(`[api-services] Fetching bookings from API: ${url}`);
    const response = await fetch(url);

    if (!response.ok) {
        const errorBody = await response.text();
        console.error(`[api-services] API Error (${response.status}) fetching bookings:`, errorBody);
        throw new Error(`Failed to fetch bookings: ${response.status} ${errorBody}`);
    }
    try {
        return await response.json();
    } catch (e) {
        console.error('[api-services] Failed to parse bookings JSON response:', e);
        throw new Error('Invalid JSON response when fetching bookings.');
    }
}

/**
 * Fetches bookings for the currently authenticated client.
 */
export async function fetchMyBookingsAPI(apiBaseUrl: string): Promise<Booking[]> {
    const url = `${apiBaseUrl}/api/my-bookings`;
    console.log(`[api-services] Fetching my bookings from API: ${url}`);
    const response = await fetch(url);
    if (!response.ok) {
        const errorBody = await response.text();
        console.error(`[api-services] API Error (${response.status}) fetching my bookings:`, errorBody);
        throw new Error(`Failed to fetch client bookings: ${response.status} ${errorBody}`);
    }
    return response.json();
}


/**
 * Creates one or more bookings as a client.
 */
export async function createClientBookingAPI(apiBaseUrl: string, payload: CreateBookingPayload[]): Promise<Booking[]> {
    const url = `${apiBaseUrl}/api/client-booking`;
    const body = { bookings: payload };
    console.log(`[api-services] Creating client booking at API: ${url}`);

    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });

    if (response.status === 207) { // Multi-Status
        console.warn('[api-services] Client booking resulted in partial success (207 Multi-Status).');
        return response.json();
    }

    if (!response.ok) {
        const errorBody = await response.text();
        let errorMessage = `Failed to create client booking(s): ${response.status} ${errorBody}`;
        try {
             const errorJson = JSON.parse(errorBody);
             errorMessage = errorJson.error || errorMessage;
             if (errorJson.details) {
                 errorMessage += ` Details: ${JSON.stringify(errorJson.details)}`;
             }
        } catch {}
        console.error(`[api-services] API Error creating client booking:`, errorMessage);
        throw new Error(errorMessage);
    }
    return response.json();
}

/**
 * Creates a booking as an admin.
 */
export async function createAdminBookingAPI(apiBaseUrl: string, payload: CreateBookingPayload): Promise<Booking> {
    const url = `${apiBaseUrl}/api/admin-booking`;
    console.log(`[api-services] Creating admin booking at API: ${url}`);
    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    if (!response.ok) {
        const errorBody = await response.text();
        console.error(`[api-services] API Error creating admin booking:`, errorBody);
        throw new Error(`Failed to create admin booking: ${response.status} ${errorBody}`);
    }
    return response.json();
}

/**
 * Updates the status (e.g., paid status) of a booking.
 */
export async function updateBookingStatusAPI(apiBaseUrl: string, bookingId: number, payload: UpdateBookingStatusPayload): Promise<{ id: number; is_paid?: boolean; status?: string }> {
    const url = `${apiBaseUrl}/api/bookings/${bookingId}/status`;
    console.log(`[api-services] Updating booking status at API: ${url}`);
    const response = await fetch(url, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    if (!response.ok) {
        const errorBody = await response.text();
        console.error(`[api-services] API Error updating booking status:`, errorBody);
        throw new Error(`Failed to update booking status: ${response.status} ${errorBody}`);
    }
    return response.json();
}

/**
 * Updates the details of a booking.
 */
export async function updateBookingDetailsAPI(apiBaseUrl: string, bookingId: number, payload: UpdateBookingPayload): Promise<Booking> {
    const url = `${apiBaseUrl}/api/bookings/${bookingId}`;
    console.log(`[api-services] Updating booking details at API: ${url}`);
    const response = await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    if (!response.ok) {
        const errorBody = await response.text();
        console.error(`[api-services] API Error updating booking details:`, errorBody);
        throw new Error(`Failed to update booking details: ${response.status} ${errorBody}`);
    }
    return response.json();
}

/**
 * Deletes a booking.
 */
export async function deleteBookingAPI(apiBaseUrl: string, bookingId: number): Promise<void> {
    const url = `${apiBaseUrl}/api/bookings/${bookingId}`;
    console.log(`[api-services] Deleting booking at API: ${url}`);
    const response = await fetch(url, {
        method: 'DELETE',
    });
    if (!response.ok && response.status !== 204) { // Allow 204 No Content as success
        const errorBody = await response.text();
        console.error(`[api-services] API Error deleting booking:`, errorBody);
        throw new Error(`Failed to delete booking: ${response.status} ${errorBody}`);
    }
    // DELETE typically returns 204 No Content, so no JSON to parse.
}

// --- NEW FUNCTION FOR DIRECT SUPABASE FETCH ---

interface FetchBookingsDirectOptions {
    assigned_staff_id?: string; // UUID
    client_user_id?: string;    // UUID
    start_date?: string;        // YYYY-MM-DD
    end_date?: string;          // YYYY-MM-DD
    // status?: string; // Example of another potential filter
}

/**
 * Fetches bookings directly from Supabase with necessary joins and transformations.
 */
export async function fetchBookingsDirect(
    supabase: SupabaseClient,
    options?: FetchBookingsDirectOptions
): Promise<Booking[]> {
    console.log('[api-services] Fetching bookings directly from Supabase with options:', options);

    let internalClientId: number | undefined;
    if (options?.client_user_id) {
        const { data: clientData, error: clientError } = await supabase
            .from('clients')
            .select('id')
            .eq('user_id', options.client_user_id)
            .single();

        if (clientError) {
            console.error('[api-services] Error fetching client internal ID for direct booking fetch:', clientError);
            throw new Error(`Failed to find client for direct booking fetch: ${clientError.message}`);
        }
        if (!clientData) {
            console.warn('[api-services] Client not found for user_id during direct booking fetch:', options.client_user_id);
            return [];
        }
        internalClientId = clientData.id;
    }

    const selectString = `
        id, service_type, start_time, end_time, status, assigned_staff_id,
        vehicle_id, assignment_notes, booking_field_ids, is_paid, max_capacity,
        booking_clients!inner(
            client_id,
            clients!inner(
                id, user_id, email,
                profiles!inner(first_name, last_name)
            )
        ),
        booking_pets(
            pets!inner(id, name, breed, client_id)
        )
    `;

    let query = supabase.from('bookings').select(selectString);

    if (options?.assigned_staff_id) {
        query = query.eq('assigned_staff_id', options.assigned_staff_id);
    }

    if (internalClientId !== undefined) {
        query = query.eq('booking_clients.client_id', internalClientId);
    }

    if (options?.start_date) {
        query = query.gte('start_time', `${options.start_date}T00:00:00.000Z`);
    }
    if (options?.end_date) {
        // Fetch bookings that START on or before the end_date.
        // If you need bookings that are *active during* the end_date, this logic would need to check end_time too.
        query = query.lte('start_time', `${options.end_date}T23:59:59.999Z`);
    }

    query = query.order('start_time', { ascending: true });

    const { data: rawData, error: queryError } = await query;

    if (queryError) {
        console.error('[api-services] Error fetching bookings directly from Supabase:', queryError);
        throw new Error(`Failed to fetch bookings directly: ${queryError.message}`);
    }

    if (!rawData) {
        return [];
    }

    const bookings: Booking[] = rawData.map((rawBooking: any) => {
        const bcClientEntry = rawBooking.booking_clients?.[0]?.clients;
        const clientProfile = bcClientEntry?.profiles;
        const clientName = clientProfile ? `${clientProfile.first_name || ''} ${clientProfile.last_name || ''}`.trim() : 'N/A';

        const pets: Pet[] = rawBooking.booking_pets?.map((bp: any) => ({
            id: bp.pets.id,
            name: bp.pets.name,
            breed: bp.pets.breed,
            client_id: bp.pets.client_id,
            // Ensure other Pet fields from shared-types are mapped if they exist and are selected
        })).filter(Boolean) || [];

        // Ensure all fields expected by the Booking type in shared-types are mapped.
        // This includes direct fields from rawBooking and transformed/joined fields.
        return {
            id: rawBooking.id,
            service_type: rawBooking.service_type,
            start_time: rawBooking.start_time,
            end_time: rawBooking.end_time,
            status: rawBooking.status,
            assigned_staff_id: rawBooking.assigned_staff_id,
            vehicle_id: rawBooking.vehicle_id,
            assignment_notes: rawBooking.assignment_notes,
            booking_field_ids: rawBooking.booking_field_ids,
            is_paid: rawBooking.is_paid,
            max_capacity: rawBooking.max_capacity,
            created_at: rawBooking.created_at, // Assuming created_at is part of bookings table & Booking type

            // Joined/Derived fields (ensure these match your Booking shared type)
            client_id: bcClientEntry?.id,
            client_user_id: bcClientEntry?.user_id,
            client_name: clientName,
            client_email: bcClientEntry?.email, // Assuming email is needed from clients table
            pets: pets,

            // Fields from Booking that might not be directly on the 'bookings' table
            // but are expected by the type need to be sourced or defaulted.
            // E.g., if Booking type has 'service_name' but we only have 'service_type'
            // service_name: rawBooking.service_type, // if service_type directly used as name

        } as Booking; // Casting to Booking type
    });

    console.log(`[api-services] Successfully fetched ${bookings.length} bookings directly.`);
    return bookings;
}

// Remove the Supabase-direct functions that were duplicates or not aligned with API-first approach for bookings.