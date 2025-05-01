import { NextResponse, type NextRequest } from 'next/server';
import { createClient as createServerClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';

// GET all vehicles (Admin only)
export async function GET() {
  const supabase = await createServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  // Check if the user is admin
  const { data: staffData, error: staffError } = await supabase
    .from('staff')
    .select('role')
    .eq('user_id', user.id)
    .single();
  if (staffError || !staffData || staffData.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden: Requires admin role' }, { status: 403 });
  }

  const supabaseAdmin = await createAdminClient();

  // Fetch all vehicles (original behavior)
  const { data: vehicles, error } = await supabaseAdmin.from('vehicles').select('*');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(vehicles);
}

// POST a new vehicle (Admin only)
export async function POST(request: Request) {
  const supabase = await createServerClient();
  const supabaseAdmin = await createAdminClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  // Check if user is admin (redundant check, but good practice)
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
    // Validate required fields (make, model)
    if (!vehicleData.make || !vehicleData.model) {
      throw new Error('Missing required fields: make and model');
    }
    // Remove staff_id if present, as it's no longer used
    delete vehicleData.staff_id;

  } catch (e) {
    const message = e instanceof Error ? e.message : 'Invalid request body';
    return NextResponse.json({ error: message }, { status: 400 });
  }

  // Insert the vehicle data (without staff_id)
  const { data: newVehicle, error: insertError } = await supabaseAdmin
    .from('vehicles')
    .insert(vehicleData)
    .select()
    .single();

  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });
  return NextResponse.json(newVehicle, { status: 201 });
}

// PUT update a vehicle by id (Admin only)
export async function PUT(request: NextRequest) {
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
  let vehicleId: number | null = null;
  try {
    vehicleData = await request.json();
    // Basic validation
    if (typeof vehicleData !== 'object' || vehicleData === null) {
      throw new Error('Invalid request body');
    }
    // Extract and validate ID
    if (!vehicleData.id || typeof vehicleData.id !== 'number') {
        throw new Error('Missing or invalid vehicle ID in request body');
    }
    vehicleId = vehicleData.id;

    // Ensure make and model are present if being updated
    if ('make' in vehicleData && !vehicleData.make) throw new Error('Make cannot be empty');
    if ('model' in vehicleData && !vehicleData.model) throw new Error('Model cannot be empty');

    // Remove id from vehicleData before update operation
    delete vehicleData.id;

  } catch (e) {
    const message = e instanceof Error ? e.message : 'Invalid request body';
    return NextResponse.json({ error: message }, { status: 400 });
  }

  if (!vehicleId) {
      // This case should technically be caught above, but added for safety.
      return NextResponse.json({ error: 'Vehicle ID processing failed.' }, { status: 400 });
  }

  const { data: updatedVehicle, error: updateError } = await supabaseAdmin
    .from('vehicles')
    .update(vehicleData) // Pass data without the id field
    .eq('id', vehicleId) // Use the extracted vehicleId for the condition
    .select()
    .single();

  if (updateError) {
     if (updateError.code === 'PGRST116') {
        return NextResponse.json({ error: `Vehicle with ID ${vehicleId} not found for update` }, { status: 404 });
      }
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json(updatedVehicle);
}

// DELETE a vehicle by id
export async function DELETE(request: NextRequest) {
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
  const id = searchParams.get('id'); // Use only query parameter

  if (!id) return NextResponse.json({ error: 'Missing vehicle id in query parameter' }, { status: 400 });

  const { error: deleteError } = await supabaseAdmin.from('vehicles').delete().eq('id', id);
  if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 });
  return NextResponse.json({ success: true });
}