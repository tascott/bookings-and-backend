'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'

// Use the server client
import { createClient } from '@/utils/supabase/server'

export async function login(formData: FormData) {
  // Use await as createClient is now async
  const supabase = await createClient()

  // type-casting here for convenience
  // in practice, you should validate your inputs
  const data = {
    email: formData.get('email') as string,
    password: formData.get('password') as string,
  }

  const { error } = await supabase.auth.signInWithPassword(data)

  if (error) {
    console.error('Login Error:', error.message)
    redirect('/error') // Redirect to a generic error page
  }

  revalidatePath('/', 'layout')
  redirect('/') // Redirect to home page after login
}

export async function signup(formData: FormData) {
  const origin = (await headers()).get('origin')
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  // Get new required fields
  const firstName = formData.get('firstName') as string
  const lastName = formData.get('lastName') as string
  const phone = formData.get('phone') as string
  // Get optional pet name
  // const petName = formData.get('petName') as string | null

  const supabase = await createClient()

  // Basic server-side validation
  if (!email || !password || !firstName || !lastName || !phone) {
    // Redirect back to signup with an error message
    // Consider a more specific error message
    return redirect('/?message=Missing required fields for signup.')
  }

  // Prepare metadata object - IMPORTANT: keys must match what the trigger expects
  const metadata = {
    first_name: firstName,
    last_name: lastName,
    phone: phone,
    // Include pet_name only if provided and the trigger handles it
    // pet_name: petName && petName.trim() !== '' ? petName.trim() : undefined
  }

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${origin}/auth/confirm`,
      // Pass the required fields in the 'data' field (referred to as raw_user_meta_data in trigger)
      data: metadata,
    },
  })

  if (error) {
    console.error('Signup Auth Error:', error.message);
    // Check for specific error indicating user already exists
    if (error.message.includes('User already registered') || error.message.includes('already exists')) {
        // Redirect back to the signup page with a specific message
        return redirect('/?message=Email+already+in+use.+Please+log+in+or+use+a+different+email.');
    }
    // For other errors, redirect to the generic error page
    return redirect('/error?message=' + encodeURIComponent(error.message));
  }

  // Redirect to a page indicating verification email was sent, or just home
  revalidatePath('/', 'layout');
  redirect('/?message=Check email to continue sign in process');
}