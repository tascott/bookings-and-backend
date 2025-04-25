import { NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'

// GET all services
export async function GET() {
  const supabase = await createServerClient()

  // Check auth - any logged-in user can view services?
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  // Use admin client to fetch all services (as RLS might not be set yet)
  const supabaseAdmin = await createAdminClient()
  const { data: services, error } = await supabaseAdmin
    .from('services')
    .select('id, name, description, created_at, requires_field_selection, default_price')
    .order('name')

  if (error) {
    console.error('Error fetching services:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(services)
}

// POST a new service (Admin only)
export async function POST(request: Request) {
  const supabase = await createServerClient()
  const supabaseAdmin = await createAdminClient()

   // Check auth & admin role
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }
  const { data: staffData, error: staffError } = await supabase
    .from('staff')
    .select('role')
    .eq('user_id', user.id)
    .single()
  if (staffError || !staffData || staffData.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden: Requires admin role' }, { status: 403 })
  }

  // Parse request body
  let serviceData: { name: string; description?: string; default_price?: number | null };
  try {
    const body = await request.json();
    // Validate price if provided
    let defaultPrice = body.default_price;
    if (defaultPrice !== undefined && defaultPrice !== null && typeof defaultPrice !== 'number') {
        // Attempt conversion if it's a string number
        const parsedPrice = parseFloat(defaultPrice);
        if (isNaN(parsedPrice)) {
            throw new Error('Invalid format for default_price');
        }
        defaultPrice = parsedPrice;
    }

    serviceData = {
        name: body.name,
        description: body.description,
        default_price: defaultPrice === undefined ? null : defaultPrice // Ensure it's number or null
    };
    if (!serviceData.name) {
      throw new Error('Missing required field: name');
    }
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : 'Invalid request body';
    return NextResponse.json({ error: errorMessage }, { status: 400 })
  }

  // Insert the new service
  const { data: newService, error: insertError } = await supabaseAdmin
    .from('services')
    .insert(serviceData)
    .select()
    .single();

  if (insertError) {
    console.error('Error creating service:', insertError)
    // Handle unique constraint violation for name
    if (insertError.code === '23505') {
         return NextResponse.json({ error: `Service name "${serviceData.name}" already exists.` }, { status: 409 }); // 409 Conflict
    }
    return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  return NextResponse.json(newService, { status: 201 })
}