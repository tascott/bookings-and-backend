import { NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'

// PUT (Update) a specific client
export async function PUT(
  request: Request,
  { params }: { params: { clientId: string } }
) {
  const supabase = await createServerClient()
  const supabaseAdmin = await createAdminClient()
  const clientId = parseInt(params.clientId, 10)

  if (isNaN(clientId)) {
    return NextResponse.json({ error: 'Invalid client ID format' }, { status: 400 })
  }

  // 1. Check authentication
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  // 2. Check if the user is an admin
  const { data: staffData, error: staffError } = await supabase
    .from('staff')
    .select('role')
    .eq('user_id', user.id)
    .single()

  if (staffError || !staffData || staffData.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden: Requires admin role' }, { status: 403 })
  }

  // 3. Parse the request body
  let updateData: {
    name?: string | null
    email?: string | null
    phone?: string | null
  }

  try {
    const body = await request.json()
    updateData = {
      name: body.name !== undefined ? body.name : undefined,
      email: body.email !== undefined ? body.email : undefined,
      phone: body.phone !== undefined ? body.phone : undefined
    }

    // Ensure at least one field is being updated
    if (Object.values(updateData).every(val => val === undefined)) {
      throw new Error('No valid fields provided for update')
    }
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : 'Invalid request body'
    return NextResponse.json({ error: errorMessage }, { status: 400 })
  }

  // 4. Update the client
  try {
    const { data: updatedClient, error: updateError } = await supabaseAdmin
      .from('clients')
      .update(updateData)
      .eq('id', clientId)
      .select()
      .single()

    if (updateError) {
      console.error('Error updating client:', updateError)
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    if (!updatedClient) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 })
    }

    // Return the updated client
    return NextResponse.json(updatedClient)
  } catch (error) {
    console.error('Error processing client update:', error)
    const message = error instanceof Error ? error.message : 'Failed to update client'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}