import { Booking, UpdateBookingPayload, CreateBookingPayload } from '../types/types';

// Define potential payload type for creating bookings (adjust as needed)
// export interface CreateBookingPayload { // MOVED TO ../types/types
//     service_id: number;
//     start_time: string; // ISO string
//     end_time: string; // ISO string
//     field_ids?: number[];
//     pet_ids?: number[];
//     client_id?: number; // For admin booking
//     assigned_staff_id?: string; // For admin booking
//     vehicle_id?: number; // For admin booking
//     notes?: string; // For admin booking
// }

export interface UpdateBookingStatusPayload {
    is_paid?: boolean;
    status?: string; // Add other updatable fields if needed
}

/**
 * Fetches bookings for the currently authenticated client.
 */
export async function fetchMyBookings(): Promise<Booking[]> {
    const response = await fetch('/api/my-bookings');
    if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Failed to fetch client bookings: ${response.status} ${errorBody}`);
    }
    return response.json();
}

interface FetchBookingsOptions {
    assigned_staff_id?: string;
    // Add other potential filters: date range, client_id, etc.
}

/**
 * Fetches bookings, potentially filtered (e.g., for staff or admin).
 */
export async function fetchBookings(options?: FetchBookingsOptions): Promise<Booking[]> {
    let url = '/api/bookings';
    const queryParams = new URLSearchParams();

    if (options?.assigned_staff_id) {
        queryParams.append('assigned_staff_id', options.assigned_staff_id);
    }
    // Add other query params based on options

    if (queryParams.toString()) {
        url += `?${queryParams.toString()}`;
    }

    const response = await fetch(url);
    if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Failed to fetch bookings: ${response.status} ${errorBody}`);
    }
    return response.json();
}

/**
 * Creates one or more bookings as a client.
 */
export async function createClientBooking(payload: CreateBookingPayload[]): Promise<Booking[]> {
    const body = { bookings: payload };

    const response = await fetch('/api/client-booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });

    if (response.status === 207) {
        console.warn('Client booking resulted in partial success (207 Multi-Status).');
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
        throw new Error(errorMessage);
    }

    return response.json();
}

/**
 * Creates a booking as an admin.
 */
export async function createAdminBooking(payload: CreateBookingPayload): Promise<Booking> {
    const response = await fetch('/api/admin-booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Failed to create admin booking: ${response.status} ${errorBody}`);
    }
    return response.json();
}

/**
 * Updates the status (e.g., paid status) of a booking.
 */
export async function updateBookingStatus(bookingId: number, payload: UpdateBookingStatusPayload): Promise<{ id: number; is_paid?: boolean; status?: string }> {
    const response = await fetch(`/api/bookings/${bookingId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Failed to update booking status: ${response.status} ${errorBody}`);
    }
    return response.json();
}

/**
 * Updates the details of a booking.
 */
export async function updateBookingDetails(bookingId: number, payload: UpdateBookingPayload): Promise<Booking> {
    const response = await fetch(`/api/bookings/${bookingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Failed to update booking details: ${response.status} ${errorBody}`);
    }
    return response.json();
}

/**
 * Deletes a booking.
 */
export async function deleteBooking(bookingId: number): Promise<void> {
    const response = await fetch(`/api/bookings/${bookingId}`, {
        method: 'DELETE',
    });
    if (!response.ok) {
        const errorBody = await response.text();
        // For 204 No Content, response.ok might be true, but text() can cause issues if body is empty.
        // However, if not ok, then there's definitely an error.
        throw new Error(`Failed to delete booking: ${response.status} ${errorBody}`);
    }
    // DELETE typically returns 204 No Content, so no JSON to parse.
    // If there's a specific success message/object, adjust accordingly.
    if (response.status !== 204) {
        // Optionally, handle cases where it's OK but not 204, if your API does that.
        console.warn(`Booking deletion returned status ${response.status}`);
    }
}