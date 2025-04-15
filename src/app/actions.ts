'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

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
  const supabase = await createClient()

  // Extract email and password for signup
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;
  // Extract name for profile update later
  const name = formData.get('name') as string;

  // Validate inputs (basic example)
  if (!email || !password) {
     console.error('Signup Error: Email and password are required.');
     return redirect('/error?message=Email+and+password+required'); // Or redirect back to form with error
  }

  // Perform the signup
  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email: email,
    password: password,
  });

  if (signUpError) {
    console.error('Signup Auth Error:', signUpError.message);
    // Consider more specific error redirects based on signUpError.code
    return redirect('/error?message=' + encodeURIComponent(signUpError.message));
  }

  // Signup successful, user exists in auth.users
  // The trigger should have created the basic client profile.
  // Now update the client profile with the name.
  if (signUpData.user && name) { // Check if user object exists and name was provided
    const { error: updateError } = await supabase
      .from('clients')
      .update({ name: name })
      .eq('user_id', signUpData.user.id); // Match the user_id created by the trigger

    if (updateError) {
      console.error('Signup Profile Update Error:', updateError.message);
      // Log this error, but don't necessarily block the user
      // Redirecting home anyway as auth succeeded
    }
  } else if (signUpData.user && !name) {
     console.warn('Signup completed, but no name provided to update profile.');
  } else if (!signUpData.user) {
      console.error('Signup succeeded but no user data returned from signUp.');
      // This is unexpected, redirect to error
      return redirect('/error?message=Signup+failed+unexpectedly');
  }

  revalidatePath('/', 'layout');
  redirect('/');
}