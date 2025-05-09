import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'

// Define type for the potential update payload
// Mirroring the updatable fields in the bookings table
type BookingUpdatePayload = {
  field_id?: number;
  start_time?: string; // ISO string
  end_time?: string; // ISO string
  service_type?: string;
  status?: string;
  max_capacity?: number | null;
}

// PUT (Update) a specific booking
export async function PUT(request: Request, { params }: { params: { bookingId: string } }) {
    const supabase = await createClient()
    const supabaseAdmin = await createAdminClient()
    const bookingId = parseInt(params.bookingId, 10);

    if (isNaN(bookingId)) {
        return NextResponse.json({ error: 'Invalid Booking ID format' }, { status: 400 });
    }

    // 1. Check auth & role (Admin/Staff)
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }
    const { data: staffData, error: staffError } = await supabase
        .from('staff')
        .select('role')
        .eq('user_id', user.id)
        .single()
    if (staffError || !staffData || !['admin', 'staff'].includes(staffData.role || '')) {
        return NextResponse.json({ error: 'Forbidden: Requires admin or staff role' }, { status: 403 })
    }

    // 2. Parse request body for update data
    const updatePayload: BookingUpdatePayload = {}; // Use the specific type
    try {
        const body = await request.json();

        // Validate and add fields one by one if present in body
        if (body.field_id !== undefined) {
            const fieldIdNum = parseInt(body.field_id, 10);
            if (isNaN(fieldIdNum)) throw new Error('Invalid field_id');
            updatePayload.field_id = fieldIdNum;
        }
        if (body.start_time !== undefined) {
            const startTime = new Date(body.start_time);
            if (isNaN(startTime.getTime())) throw new Error('Invalid start_time format');
            updatePayload.start_time = startTime.toISOString();
        }
        if (body.end_time !== undefined) {
            const endTime = new Date(body.end_time);
            if (isNaN(endTime.getTime())) throw new Error('Invalid end_time format');
            updatePayload.end_time = endTime.toISOString();
        }
        if (body.service_type !== undefined) {
            updatePayload.service_type = String(body.service_type);
        }
        if (body.status !== undefined) {
            updatePayload.status = String(body.status);
        }
        if (body.max_capacity !== undefined) {
            if (body.max_capacity === null) {
                updatePayload.max_capacity = null;
            } else {
                const capacityNum = parseInt(body.max_capacity, 10);
                if (isNaN(capacityNum)) throw new Error('Invalid max_capacity');
                updatePayload.max_capacity = capacityNum;
            }
        }

        // Check time consistency if both are being updated
        if (updatePayload.start_time && updatePayload.end_time && new Date(updatePayload.end_time) <= new Date(updatePayload.start_time)) {
            throw new Error('End time must be after start time');
        }

        // Ensure at least one field is being updated
        if (Object.keys(updatePayload).length === 0) {
            throw new Error('No valid fields provided for update.');
        }

    } catch (e) {
        const errorMessage = e instanceof Error ? e.message : 'Invalid request body';
        return NextResponse.json({ error: errorMessage }, { status: 400 })
    }

    // 3. Update the booking using the constructed payload
    try {
        const { data: updatedBooking, error: updateError } = await supabaseAdmin
            .from('bookings')
            .update(updatePayload) // Use the directly constructed payload
            .eq('id', bookingId)
            .select()
            .single();

        if (updateError) {
            console.error('Error updating booking:', updateError)
            if (updateError.code === 'PGRST116') { // Row not found
                return NextResponse.json({ error: 'Booking not found.' }, { status: 404 });
            }
             if (updateError.code === '23503') { // Foreign key violation (e.g., bad field_id)
                 return NextResponse.json({ error: `Update failed: Invalid reference (e.g., field_id). ${updateError.message}` }, { status: 400 });
            }
            throw updateError;
        }

        if (!updatedBooking) {
            // This case should ideally be caught by PGRST116, but as a fallback
            return NextResponse.json({ error: 'Booking not found.' }, { status: 404 });
        }

        // TODO: Consider if updating linked clients/pets is needed here? (More complex)

        return NextResponse.json(updatedBooking);

    } catch (error: unknown) {
        console.error('Error processing booking update:', error);
        const message = error instanceof Error ? error.message : 'Failed to update booking';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

// DELETE a specific booking
export async function DELETE(request: Request, { params }: { params: { bookingId: string } }) {
    const supabase = await createClient()
    const supabaseAdmin = await createAdminClient()
    const bookingId = parseInt(params.bookingId, 10);

    if (isNaN(bookingId)) {
        return NextResponse.json({ error: 'Invalid Booking ID format' }, { status: 400 });
    }

    // 1. Check auth & role (Admin/Staff)
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }
    const { data: staffData, error: staffError } = await supabase
        .from('staff')
        .select('role')
        .eq('user_id', user.id)
        .single()
    if (staffError || !staffData || !['admin', 'staff'].includes(staffData.role || '')) {
        return NextResponse.json({ error: 'Forbidden: Requires admin or staff role' }, { status: 403 })
    }

    // 2. Delete the booking
    // Note: Assumes ON DELETE CASCADE is set for booking_clients and booking_pets FKs
    try {
        const { error: deleteError, count } = await supabaseAdmin
            .from('bookings')
            .delete({ count: 'exact' })
            .eq('id', bookingId);

        if (deleteError) {
            console.error('Error deleting booking:', deleteError);
            throw deleteError;
        }

        // Check if a row was actually deleted
        if (count === 0) {
            return NextResponse.json({ error: 'Booking not found.' }, { status: 404 });
        }

        return NextResponse.json({ message: 'Booking deleted successfully' }, { status: 200 }); // 200 OK

    } catch (error: unknown) {
        console.error('Error processing booking deletion:', error);
        const message = error instanceof Error ? error.message : 'Failed to delete booking';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}