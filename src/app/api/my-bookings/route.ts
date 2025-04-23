import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

// Define expected structure for the response
// Adapt based on the actual data you need in the UI
type ClientBookingDetails = {
    booking_id: number;
    start_time: string;
    end_time: string;
    service_type: string | null;
    status: string;
    field_id: number;
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
    field_id: number;
    booking_pets: {
        pets: {
            id: number;
            name: string;
        } | null; // The pet relation might be null if the pet was deleted?
    }[]; // booking_pets is an array
};

export async function GET() {
    const supabase = await createClient()

    // 1. Authentication & Get Client ID
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    let clientId: number;
    try {
        const { data: clientData, error: clientError } = await supabase
            .from('clients')
            .select('id')
            .eq('user_id', user.id)
            .single();
        if (clientError) throw clientError;
        if (!clientData) throw new Error('Client profile not found.');
        clientId = clientData.id;
    } catch (error) {
         console.error('Error fetching client ID for my-bookings:', error);
         const message = error instanceof Error ? error.message : 'Failed to retrieve client profile';
         // Return 404 specifically if client profile not found
         const status = (error instanceof Error && error.message.includes('Client profile not found')) ? 404 : 500;
         return NextResponse.json({ error: message }, { status });
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
                field_id,
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
            field_id: booking.field_id,
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