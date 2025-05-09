import { NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';

export async function GET() {
  const supabase = await createServerClient();
  const supabaseAdmin = await createAdminClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const { data: profile, error } = await supabaseAdmin
    .from('profiles')
    .select('*')
    .eq('user_id', user.id)
    .single();

  if (error) {
      if (error.code === 'PGRST116') {
         console.warn(`Profile not found for user ${user.id}`);
         return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
      }
      console.error("Get profile error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!profile) {
     return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
  }

  return NextResponse.json(profile);
}

export async function PUT(request: Request) {
  const supabase = await createServerClient();
  const supabaseAdmin = await createAdminClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  let updateData;
  try {
    updateData = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
  const allowedFields = [
	'first_name',
	'last_name',
	'phone',
	'email_allow_promotional',
	'email_allow_informational',
    'address_line_1',
    'address_line_2',
    'town_or_city',
    'county',
    'postcode',
    'country',
    'latitude',
    'longitude'
  ];
  const updateFields = Object.fromEntries(
    Object.entries(updateData).filter(([key]) => allowedFields.includes(key))
  );
  if (Object.keys(updateFields).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
  }
  const { data: updated, error } = await supabaseAdmin
    .from('profiles')
    .update(updateFields)
    .eq('user_id', user.id)
    .select('user_id, first_name, last_name, phone, email_allow_promotional, email_allow_informational, address_line_1, address_line_2, town_or_city, county, postcode, country, latitude, longitude')
    .single();
  if (error) {
     console.error("Profile update error:", error);
     return NextResponse.json({ error: error.message }, { status: 500 });
  }
  console.log("API returning updated profile:", updated);
  return NextResponse.json(updated);
}