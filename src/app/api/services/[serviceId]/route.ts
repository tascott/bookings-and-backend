import { NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import type { Service } from '@/types'; // Import Service type

// Define the type for the PUT request body
type ServiceUpdateData = Partial<Omit<Service, 'id' | 'created_at'>>;

// Helper function to check admin role
async function isAdmin(supabase: Awaited<ReturnType<typeof createServerClient>>): Promise<boolean> {
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
    const supabase = await createServerClient(); // Await client creation
    const serviceId = parseInt(params.serviceId, 10);

    if (!(await isAdmin(supabase))) { // Pass the awaited client
        return NextResponse.json({ error: 'Forbidden: Requires admin role' }, { status: 403 });
    }

    if (isNaN(serviceId)) {
        return NextResponse.json({ error: 'Invalid service ID' }, { status: 400 });
    }

    let updateData: ServiceUpdateData;
    try {
        const body = await request.json();
        updateData = body;

        // Validate incoming data (add service_type validation)
        if (updateData.name !== undefined && (typeof updateData.name !== 'string' || updateData.name.trim() === '')) {
            throw new Error('Service name cannot be empty.');
        }
        if (updateData.service_type !== undefined && updateData.service_type !== null && updateData.service_type !== 'Field Hire' && updateData.service_type !== 'Daycare') {
            throw new Error('Invalid service_type. Must be \'Field Hire\', \'Daycare\', or null (if nullable).'); // Adjust if NOT NULL
        }
         // Allow null for default_price
        if (updateData.default_price !== undefined && updateData.default_price !== null && typeof updateData.default_price !== 'number') {
             const parsedPrice = parseFloat(updateData.default_price as string); // Assume it might be a string number
             if (isNaN(parsedPrice)) {
                 throw new Error('Invalid format for default_price');
             }
             updateData.default_price = parsedPrice;
        }
        // Trim description if present
        if (updateData.description !== undefined && updateData.description !== null) {
            updateData.description = updateData.description.trim();
        }

    } catch (e) {
        const errorMessage = e instanceof Error ? e.message : 'Invalid request body';
        return NextResponse.json({ error: errorMessage }, { status: 400 });
    }

    // Prevent updating id or created_at
    delete (updateData as Partial<Service>).id;
    delete (updateData as Partial<Service>).created_at;

    // Use admin client to perform the update
    const supabaseAdmin = await createAdminClient();
    const { data: updatedService, error: updateError } = await supabaseAdmin
        .from('services')
        .update(updateData)
        .eq('id', serviceId)
        .select()
        .single();

    if (updateError) {
        console.error(`Error updating service ${serviceId}:`, updateError);
        // Handle unique constraint violation for name if needed
        if (updateError.code === '23505') {
             return NextResponse.json({ error: `Service name "${updateData.name}" already exists.` }, { status: 409 });
        }
        // Handle check constraint violation for service_type
        if (updateError.code === '23514' && updateError.message.includes('services_service_type_check')) {
            return NextResponse.json({ error: 'Invalid service_type. Must be \'Field Hire\' or \'Daycare\'.' }, { status: 400 });
        }
        return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    if (!updatedService) {
        return NextResponse.json({ error: `Service with ID ${serviceId} not found.` }, { status: 404 });
    }

    return NextResponse.json(updatedService);
}

// DELETE handler for removing a service
export async function DELETE(request: Request, { params }: { params: { serviceId: string } }) {
    const supabase = await createServerClient();
    const serviceId = parseInt(params.serviceId, 10);

    if (!(await isAdmin(supabase))) {
        return NextResponse.json({ error: 'Forbidden: Requires admin role' }, { status: 403 });
    }

    if (isNaN(serviceId)) {
        return NextResponse.json({ error: 'Invalid service ID' }, { status: 400 });
    }

    // Use admin client for delete
    const supabaseAdmin = await createAdminClient();
    const { error: deleteError } = await supabaseAdmin
        .from('services')
        .delete()
        .eq('id', serviceId);

    if (deleteError) {
        console.error(`Error deleting service ${serviceId}:`, deleteError);
         // Handle foreign key constraint violation (e.g., if service_availability depends on it)
         if (deleteError.code === '23503') {
            return NextResponse.json({ error: 'Cannot delete service because other records depend on it (e.g., availability rules).' }, { status: 409 }); // 409 Conflict
         }
        return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    // Check if any row was actually deleted (optional, Supabase delete doesn't error if no rows match)
    // You might want to query first if you need confirmation

    return NextResponse.json({ success: true });
}