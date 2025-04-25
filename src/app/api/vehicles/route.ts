import { NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';

// GET all vehicles or vehicles for a staff member
export async function GET(request: Request) {
  const supabase = await createServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const staffIdParam = searchParams.get('staff_id');

  const { data: staffData, error: staffError } = await supabase
    .from('staff')
    .select('id, role')
    .eq('user_id', user.id)
    .single();

  if (staffError || !staffData) {
    return NextResponse.json({ error: 'Forbidden: Not staff or admin' }, { status: 403 });
  }

  const supabaseAdmin = await createAdminClient();

  if (staffData.role === 'admin') {
    // Admin: fetch all or by staff_id if provided
    let query = supabaseAdmin.from('vehicles').select('*');
    if (staffIdParam) query = query.eq('staff_id', staffIdParam);
    const { data: vehicles, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(vehicles);
  } else {
    // Staff: can only fetch their own vehicles
    if (!staffIdParam || Number(staffIdParam) !== staffData.id) {
      return NextResponse.json({ error: 'Forbidden: Can only view your own vehicles' }, { status: 403 });
    }
    const { data: vehicles, error } = await supabaseAdmin
      .from('vehicles')
      .select('*')
      .eq('staff_id', staffData.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(vehicles);
  }
}

// POST a new vehicle
export async function POST(request: Request) {
  const supabase = await createServerClient();
  const supabaseAdmin = await createAdminClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  const { data: staffData, error: staffError } = await supabase
    .from('staff')
    .select('role')
    .eq('user_id', user.id)
    .single();
  if (staffError || !staffData || staffData.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden: Requires admin role' }, { status: 403 });
  }
  let vehicleData;
  try {
    vehicleData = await request.json();
    if (!vehicleData.staff_id || !vehicleData.make || !vehicleData.model) {
      throw new Error('Missing required fields');
    }
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
  const { data: newVehicle, error: insertError } = await supabaseAdmin
    .from('vehicles')
    .insert(vehicleData)
    .select()
    .single();
  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });
  return NextResponse.json(newVehicle, { status: 201 });
}

// DELETE a vehicle by id
export async function DELETE(request: Request) {
  const supabase = await createServerClient();
  const supabaseAdmin = await createAdminClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  const { data: staffData, error: staffError } = await supabase
    .from('staff')
    .select('role')
    .eq('user_id', user.id)
    .single();
  if (staffError || !staffData || staffData.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden: Requires admin role' }, { status: 403 });
  }
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  const { error: deleteError } = await supabaseAdmin.from('vehicles').delete().eq('id', id);
  if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 });
  return NextResponse.json({ success: true });
}