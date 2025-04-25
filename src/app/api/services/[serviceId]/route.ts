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

// PUT handler to update a service
export async function PUT(request: Request, { params }: { params: { serviceId: string } }) {
    const supabaseClientPromise = createServerClient();
    const supabaseAdmin = await createAdminClient();
    const serviceId = parseInt(params.serviceId, 10);

    if (!(await isAdmin(supabaseClientPromise))) {
        return NextResponse.json({ error: 'Forbidden: Requires admin role' }, { status: 403 });
    }

    if (isNaN(serviceId)) {
        return NextResponse.json({ error: 'Invalid service ID' }, { status: 400 });
    }

    // Parse request body
    let serviceData: { name?: string; description?: string; default_price?: number | null };
    try {
        const body = await request.json();

        // Validate price if provided
        let defaultPrice: number | null = null; // Initialize as null
        if (body.default_price !== undefined && body.default_price !== null) {
            const parsedPrice = parseFloat(String(body.default_price)); // Convert to string first
            if (isNaN(parsedPrice)) {
                throw new Error('Invalid format for default_price');
            }
            defaultPrice = parsedPrice;
        } else if (body.default_price === null) {
             defaultPrice = null;
        }
        // If body.default_price is undefined, defaultPrice remains null (no update)

        serviceData = {
            name: body.name,
            description: body.description,
            default_price: defaultPrice
        };

        // Filter out undefined fields so they don't overwrite existing values with null
        const updatePayload: Record<string, string | number | null> = {};
        if (serviceData.name !== undefined) updatePayload.name = serviceData.name;
        if (serviceData.description !== undefined) updatePayload.description = serviceData.description; // Allow empty string?
        if (serviceData.default_price !== undefined) updatePayload.default_price = serviceData.default_price; // Will be number or null

        if (Object.keys(updatePayload).length === 0) {
             throw new Error('No update fields provided or fields are invalid');
        }
        // Require name for PUT? Or allow partial update?
        // For now, allowing partial update.

    } catch (e) {
        const errorMessage = e instanceof Error ? e.message : 'Invalid request body';
        return NextResponse.json({ error: errorMessage }, { status: 400 });
    }

    // Perform update using filtered payload
    const { data: updatedService, error: updateError } = await supabaseAdmin
        .from('services')
        .update(serviceData) // Pass the validated and potentially filtered data
        .eq('id', serviceId)
        .select()
        .single();

    if (updateError) {
        console.error(`Error updating service ${serviceId}:`, updateError);
         if (updateError.code === '23505') { // Unique constraint violation
             return NextResponse.json({ error: `Service name "${serviceData.name}" already exists.` }, { status: 409 });
        }
        return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    if (!updatedService) {
        return NextResponse.json({ error: `Service with ID ${serviceId} not found.` }, { status: 404 });
    }

    return NextResponse.json(updatedService);
}

// DELETE handler to remove a service
export async function DELETE(request: Request, { params }: { params: { serviceId: string } }) {
    const supabaseClientPromise = createServerClient();
    const supabaseAdmin = await createAdminClient();
    const serviceId = parseInt(params.serviceId, 10);

    if (!(await isAdmin(supabaseClientPromise))) {
        return NextResponse.json({ error: 'Forbidden: Requires admin role' }, { status: 403 });
    }

    if (isNaN(serviceId)) {
        return NextResponse.json({ error: 'Invalid service ID' }, { status: 400 });
    }

    // Check dependencies (e.g., service_availability)
    const { data: availabilityRefs, error: checkError } = await supabaseAdmin
        .from('service_availability')
        .select('id', { count: 'exact', head: true }) // More efficient check
        .eq('service_id', serviceId);
        // Removed limit(1) - count is better

    if (checkError) {
        console.error("Error checking service dependencies:", checkError);
        return NextResponse.json({ error: 'Failed to check dependencies' }, { status: 500 });
    }
    // Check the count from the response header or count property
    const count = availabilityRefs?.length ?? 0; // Fallback if count isn't returned as expected
    if (count > 0) {
        return NextResponse.json({ error: `Cannot delete service: It is used in ${count} service availability rule(s).` }, { status: 409 }); // Conflict
    }

    // Perform delete
    const { error: deleteError } = await supabaseAdmin
        .from('services')
        .delete()
        .eq('id', serviceId);

    if (deleteError) {
        console.error(`Error deleting service ${serviceId}:`, deleteError);
        return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
}