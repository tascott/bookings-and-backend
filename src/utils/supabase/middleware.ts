import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // IMPORTANT: Avoid writing any code between createServerClient and supabase.auth.getUser()
  // Refresh session - do not remove
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { data: { user } } = await supabase.auth.getUser()

  // Optional: Redirect to login if no user and not on login/auth path
  // if (
  //   !user &&
  //   !request.nextUrl.pathname.startsWith('/login') && // Adjust path if your login page is different
  //   !request.nextUrl.pathname.startsWith('/auth') // Keep /auth for confirmation routes
  // ) {
  //   const url = request.nextUrl.clone()
  //   url.pathname = '/login' // Adjust path if your login page is different
  //   return NextResponse.redirect(url)
  // }

  // IMPORTANT: You must return the supabaseResponse object
  return supabaseResponse
}