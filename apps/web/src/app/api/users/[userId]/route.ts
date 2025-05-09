import { NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';

export async function PUT(request: Request, { params }: { params: { userId: string } }) {
  const supabase = await createServerClient();
  const supabaseAdmin = await createAdminClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  // Only admins can update staff/admin details
  const { data: staffData, error: staffError } = await supabase
    .from('staff')
    .select('role')
    .eq('user_id', user.id)
    .single();
  if (staffError || !staffData || staffData.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden: Requires admin role' }, { status: 403 });
  }

  // Only allow updating staff/admin users
  const { data: targetStaff, error: targetStaffError } = await supabaseAdmin
    .from('staff')
    .select('*')
    .eq('user_id', params.userId)
    .single();
  if (targetStaffError || !targetStaff || (targetStaff.role !== 'admin' && targetStaff.role !== 'staff')) {
    return NextResponse.json({ error: 'Can only update staff or admin users' }, { status: 400 });
  }

  let updateData;
  try {
    updateData = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  // Only allow updating first_name, last_name, phone, notes
  const allowedProfileFields = ['first_name', 'last_name', 'phone'];
  const allowedStaffFields = ['notes'];
  const profileFields = Object.fromEntries(
    Object.entries(updateData).filter(([key]) => allowedProfileFields.includes(key))
  );
  const staffFields = Object.fromEntries(
    Object.entries(updateData).filter(([key]) => allowedStaffFields.includes(key))
  );

  let localProfileError = null;
  let localStaffError = null;
  let updatedProfile = null;
  let updatedStaff = null;

  if (Object.keys(profileFields).length > 0) {
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .update(profileFields)
      .eq('user_id', params.userId)
      .select()
      .single();
    localProfileError = error;
    updatedProfile = data;
  }
  if (Object.keys(staffFields).length > 0) {
    const { data, error } = await supabaseAdmin
      .from('staff')
      .update(staffFields)
      .eq('user_id', params.userId)
      .select()
      .single();
    localStaffError = error;
    updatedStaff = data;
  }
  if (localProfileError || localStaffError) {
    const errMsg = (localProfileError && typeof localProfileError.message === 'string') ? localProfileError.message : (localStaffError && typeof localStaffError.message === 'string' ? localStaffError.message : 'Unknown error');
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
  return NextResponse.json({ profile: updatedProfile, staff: updatedStaff });
}