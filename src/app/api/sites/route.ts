import { NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'

// GET all sites
export async function GET() {
  const supabase = await createServerClient()

  // Check user authentication
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  // Fetch sites - readable by any authenticated user for now?
  // Or check for admin/staff role? Let's restrict to admin for consistency.
   const { data: staffData, error: staffError } = await supabase
    .from('staff')
    .select('role')
    .eq('user_id', user.id)
    .single()

  if (staffError || !staffData || !['admin', 'staff'].includes(staffData.role || '')) {
     // Allow staff+admin to view sites
    return NextResponse.json({ error: 'Forbidden: Requires admin or staff role to view sites' }, { status: 403 })
  }

  // Use admin client to fetch all sites
  const supabaseAdmin = await createAdminClient()
  const { data: sites, error } = await supabaseAdmin.from('sites').select('*')

  if (error) {
    console.error('Error fetching sites:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(sites)
}

// POST a new site (Admin only)
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
  let siteData: { name: string; address?: string; is_active?: boolean };
  try {
    const body = await request.json();
    siteData = {
        name: body.name,
        address: body.address,
        is_active: body.is_active !== undefined ? body.is_active : true // Default to true
    };
    if (!siteData.name) {
      throw new Error('Missing required field: name');
    }
  } catch (e) { // Type error explicitly
    const errorMessage = e instanceof Error ? e.message : 'An unknown error occurred.';
    return NextResponse.json({ error: errorMessage }, { status: 400 })
  }

  // Insert the new site using admin client
  const { data: newSite, error: insertError } = await supabaseAdmin
    .from('sites')
    .insert(siteData)
    .select()
    .single(); // Return the newly created site

  if (insertError) {
    console.error('Error creating site:', insertError)
    return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  return NextResponse.json(newSite, { status: 201 })
}