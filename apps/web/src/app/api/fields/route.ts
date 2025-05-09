import { NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'

// GET all fields (optionally filter by site_id)
export async function GET(request: Request) {
  const supabase = await createServerClient()
  const { searchParams } = new URL(request.url)
  const siteId = searchParams.get('site_id')

  // Check auth
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  // Allow staff+admin to view fields
   const { data: staffData, error: staffError } = await supabase
    .from('staff')
    .select('role')
    .eq('user_id', user.id)
    .single()

  if (staffError || !staffData || !['admin', 'staff'].includes(staffData.role || '')) {
    return NextResponse.json({ error: 'Forbidden: Requires admin or staff role to view fields' }, { status: 403 })
  }

  // Build query
  const supabaseAdmin = await createAdminClient()
  let query = supabaseAdmin.from('fields').select('*')
  if (siteId) {
    query = query.eq('site_id', siteId)
  }

  const { data: fields, error } = await query

  if (error) {
    console.error('Error fetching fields:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(fields)
}

// POST a new field (Admin only)
export async function POST(request: Request) {
  const supabase = await createServerClient()
  const supabaseAdmin = await createAdminClient()

   // Check user authentication
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  // Check if user is admin
  const { data: staffData, error: staffError } = await supabase
    .from('staff')
    .select('role')
    .eq('user_id', user.id)
    .single()

  if (staffError || !staffData || staffData.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden: Requires admin role' }, { status: 403 })
  }

  // Parse request body
  let fieldData: { site_id: number; name?: string; capacity?: number; field_type?: string };
  try {
    const body = await request.json();
    if (!body.site_id) {
        throw new Error('Missing required field: site_id');
    }
    // Parse capacity separately and handle NaN
    const rawCapacity = body.capacity ? parseInt(body.capacity, 10) : undefined;
    const capacityValue = (rawCapacity !== undefined && !isNaN(rawCapacity)) ? rawCapacity : undefined;

    fieldData = {
        site_id: parseInt(body.site_id, 10),
        name: body.name,
        capacity: capacityValue, // Use the explicitly checked value
        field_type: body.field_type
    };
     if (isNaN(fieldData.site_id)) {
       throw new Error('Invalid site_id');
     }
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : 'An unknown error occurred.';
    return NextResponse.json({ error: errorMessage }, { status: 400 })
  }

  // Insert the new field
  const { data: newField, error: insertError } = await supabaseAdmin
    .from('fields')
    .insert(fieldData)
    .select()
    .single(); // Return the new field

  if (insertError) {
    console.error('Error creating field:', insertError)
    // Handle foreign key constraint error specifically?
    if (insertError.code === '23503') { // Foreign key violation
         return NextResponse.json({ error: `Invalid site_id: ${fieldData.site_id} does not exist.` }, { status: 400 });
    }
    return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  return NextResponse.json(newField, { status: 201 })
}