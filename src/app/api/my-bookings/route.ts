import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { getUserAuthInfo } from '@/utils/auth-helpers'

// Define expected structure for the response
// Adapt based on the actual data you need in the UI
type ClientBookingDetails = {
    booking_id: number;
    start_time: string;
    end_time: string;
    service_type: string | null;
    status: string;
    booking_field_ids?: number[];
    // Add field name if needed by joining?
    // field_name: string | null;
    pets: { id: number; name: string }[]; // Array of pets linked to this booking
}

// Define the expected nested structure returned by the Supabase query
type BookingWithNestedPets = {
    id: number;
    start_time: string;
    end_time: string;
    service_type: string | null;
    status: string;
    booking_field_ids?: number[];
    booking_pets: {
        pets: {
            id: number;
            name: string;
        } | null; // The pet relation might be null if the pet was deleted?
    }[]; // booking_pets is an array
};

export async function GET() {
    const supabase = await createClient()

    // Get user auth info from our helper
    const { clientId, error, status } = await getUserAuthInfo(supabase);

    // Return early if there was an auth error
    if (error) {
        return NextResponse.json({ error }, { status: status || 401 });
    }

    // For this endpoint, a client ID is required
    if (!clientId) {
        return NextResponse.json({ error: 'Client profile not found' }, { status: 404 });
    }

    // 2. Fetch Bookings and Associated Pets for the Client
    try {
        // Fetch booking IDs linked to the client
        const { data: clientBookingLinks, error: clientLinksError } = await supabase
            .from('booking_clients')
            .select('booking_id')
            .eq('client_id', clientId);

        if (clientLinksError) throw clientLinksError;
        if (!clientBookingLinks || clientBookingLinks.length === 0) {
            return NextResponse.json([]); // No bookings found for this client
        }

        const bookingIds = clientBookingLinks.map(link => link.booking_id);

        // Fetch details for these bookings AND their linked pets
        const { data: bookingsWithPets, error: bookingsError } = await supabase
            .from('bookings')
            .select(`
                id,
                start_time,
                end_time,
                service_type,
                status,
                booking_field_ids,
                booking_pets ( pets ( id, name ) )
            `)
            .in('id', bookingIds)
            .returns<BookingWithNestedPets[]>() // Specify the expected return type structure
            .order('start_time', { ascending: false });

        if (bookingsError) throw bookingsError;

        // 3. Process the data into the desired structure
        const results: ClientBookingDetails[] = (bookingsWithPets || []).map((booking: BookingWithNestedPets) => ({
            booking_id: booking.id,
            start_time: booking.start_time,
            end_time: booking.end_time,
            service_type: booking.service_type,
            status: booking.status,
            booking_field_ids: booking.booking_field_ids,
            // Extract pet info using the defined types
            pets: booking.booking_pets
                    .map(bp => bp.pets) // Get the pet object (or null)
                    .filter((pet): pet is { id: number; name: string } => pet !== null) // Type guard to filter out nulls and assert type
                    // The || [] at the end is likely redundant now due to filter
        }));

        return NextResponse.json(results);

    } catch (error: unknown) {
        console.error('Error fetching client bookings:', error);
        const message = error instanceof Error ? error.message : 'Failed to fetch bookings';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}