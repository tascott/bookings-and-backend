import { NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';

// Helper function to check admin role
async function isAdmin(supabasePromise: ReturnType<typeof createServerClient>): Promise<boolean> {
    const supabase = await supabasePromise;
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return false;

    const { data: staffData, error: staffError } = await supabase
        .from('staff')
        .select('role')
        .eq('user_id', user.id)
        .single();

    return !staffError && staffData?.role === 'admin';
}

// PATCH handler to update booking is_paid status
export async function PATCH(request: Request, { params }: { params: { bookingId: string } }) {
    const supabaseClientPromise = createServerClient();
    const supabaseAdmin = await createAdminClient();
    const bookingId = parseInt(params.bookingId, 10);

    if (!(await isAdmin(supabaseClientPromise))) {
        return NextResponse.json({ error: 'Forbidden: Requires admin role' }, { status: 403 });
    }

    if (isNaN(bookingId)) {
        return NextResponse.json({ error: 'Invalid booking ID' }, { status: 400 });
    }

    let isPaid: boolean;
    try {
        const body = await request.json();
        if (typeof body.is_paid !== 'boolean') {
            throw new Error('Missing or invalid is_paid field (must be true or false)');
        }
        isPaid = body.is_paid;
    } catch (e) {
        const message = e instanceof Error ? e.message : 'Invalid request body';
        return NextResponse.json({ error: message }, { status: 400 });
    }

    // Perform update
    const { data: updatedBooking, error: updateError } = await supabaseAdmin
        .from('bookings')
        .update({ is_paid: isPaid })
        .eq('id', bookingId)
        .select('id, is_paid') // Select only relevant fields
        .single();

    if (updateError) {
        console.error(`Error updating booking ${bookingId} paid status:`, updateError);
        return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    if (!updatedBooking) {
        return NextResponse.json({ error: `Booking with ID ${bookingId} not found.` }, { status: 404 });
    }

    return NextResponse.json(updatedBooking);
}