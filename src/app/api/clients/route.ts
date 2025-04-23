import { NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'

// GET all clients with their pets
export async function GET() {
  const supabase = await createServerClient()

  // Check user authentication
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  // Check if the current user is an admin
  const { data: staffData, error: staffError } = await supabase
    .from('staff')
    .select('role')
    .eq('user_id', user.id)
    .single()

  if (staffError || !staffData || staffData.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden: Requires admin role' }, { status: 403 })
  }

  // Use admin client to fetch all clients and their pets
  const supabaseAdmin = await createAdminClient()

  // First fetch all clients
  const { data: clients, error: clientsError } = await supabaseAdmin
    .from('clients')
    .select('*')
    .order('id')

  if (clientsError) {
    console.error('Error fetching clients:', clientsError)
    return NextResponse.json({ error: clientsError.message }, { status: 500 })
  }

  // Then fetch all pets and group them by client_id
  const { data: pets, error: petsError } = await supabaseAdmin
    .from('pets')
    .select('*')
    .order('name')

  if (petsError) {
    console.error('Error fetching pets:', petsError)
    return NextResponse.json({ error: petsError.message }, { status: 500 })
  }

  // Group pets by client_id
  const petsByClient = new Map()
  for (const pet of pets || []) {
    if (!petsByClient.has(pet.client_id)) {
      petsByClient.set(pet.client_id, [])
    }
    petsByClient.get(pet.client_id).push(pet)
  }

  // Add pets to each client
  const clientsWithPets = clients?.map(client => ({
    ...client,
    pets: petsByClient.get(client.id) || []
  })) || []

  return NextResponse.json(clientsWithPets)
}