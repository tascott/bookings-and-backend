import { NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'

// Define the expected structure for the POST request body
type NewServiceData = {
    name: string;
    description?: string | null;
    requires_field_selection?: boolean;
    default_price?: number | null;
    service_type: 'Field Hire' | 'Daycare'; // Make service_type mandatory
    is_active?: boolean; // Add is_active here as well
}

// GET all services
export async function GET(request: Request) {
  const supabase = await createServerClient()

  // Check auth - any logged-in user can view services?
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  // Handle query parameters for filtering
  const { searchParams } = new URL(request.url);
  const activeParam = searchParams.get('active');

  // Use admin client to fetch all services
  const supabaseAdmin = await createAdminClient()
  let query = supabaseAdmin
    .from('services')
    .select('id, name, description, created_at, requires_field_selection, default_price, service_type, is_active') // Added is_active
    .order('name');

  if (activeParam !== null) {
    const isActive = activeParam.toLowerCase() === 'true';
    query = query.eq('is_active', isActive);
  }

  const { data: services, error } = await query;

  if (error) {
    console.error('Error fetching services:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(services)
}

// POST a new service (Admin only)
export async function POST(request: Request) {
    const supabase = await createServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    // Check admin role using the user ID
    const { data: staffData, error: staffError } = await supabase
        .from('staff')
        .select('role')
        .eq('user_id', user.id)
        .single();

    if (staffError || !staffData || staffData.role !== 'admin') {
        return NextResponse.json({ error: 'Forbidden: Requires admin role' }, { status: 403 });
    }

    let serviceData: NewServiceData
    try {
        const body = await request.json()
        // Validate required fields
        if (!body.name || typeof body.name !== 'string' || body.name.trim() === '') {
            throw new Error('Service name is required.')
        }
        // Validate mandatory service_type
        if (!body.service_type || (body.service_type !== 'Field Hire' && body.service_type !== 'Daycare')) {
            throw new Error('Valid service_type (\'Field Hire\' or \'Daycare\') is required.')
        }

        // Prepare data, setting defaults or nulls for optional fields if not provided
        serviceData = {
            name: body.name.trim(),
            description: body.description?.trim() || null,
            requires_field_selection: typeof body.requires_field_selection === 'boolean' ? body.requires_field_selection : false,
            default_price: typeof body.default_price === 'number' ? body.default_price : null,
            service_type: body.service_type, // Already validated
            is_active: body.hasOwnProperty('is_active') ? !!body.is_active : true, // Default to true if not provided
        }

    } catch (e) {
        const errorMessage = e instanceof Error ? e.message : 'Invalid request body'
        return NextResponse.json({ error: errorMessage }, { status: 400 })
    }

    // Use admin client to bypass RLS for insertion
    const supabaseAdmin = await createAdminClient()

    const { data: newService, error: insertError } = await supabaseAdmin
        .from('services')
        .insert(serviceData)
        .select()
        .single()

    if (insertError) {
        console.error('Error inserting service:', insertError)
        return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    return NextResponse.json(newService, { status: 201 })
}