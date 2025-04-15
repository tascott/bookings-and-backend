import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'

// NOTE: This client uses the SERVICE_ROLE_KEY and should only be used in server-side code
// where you need elevated privileges. Never expose this key or client to the browser.

// Make async
export async function createAdminClient() {
  // Await cookies
  const cookieStore = await cookies()

  // Create a server supabase client with service_role key
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!, // Use the service role key
    {
      cookies: {
        // Use getAll
        getAll() {
          return cookieStore.getAll()
        },
        // Use setAll
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          try {
            // Service role client typically doesn't set cookies, but include for consistency
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch (error) {
             console.warn('Admin client failed to set cookies in setAll (unexpected).', error)
          }
        },
      },
      // Important: Set auth options for service role client
      auth: {
         autoRefreshToken: false,
         persistSession: false
      }
    }
  )
}

// Create a singleton instance - needs to be async now
// export const supabaseAdmin = await createAdminClient() // This won't work at top level

// Instead of a top-level await, export the async function and call it where needed
// Or, manage the singleton instance differently if required, but direct export is simpler.