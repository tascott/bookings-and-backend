import { type NextRequest } from 'next/server'
// Import the updateSession function
import { updateSession } from '@/utils/supabase/middleware'

export async function middleware(request: NextRequest) {
  // Call updateSession to handle session logic
  return await updateSession(request)
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * Feel free to modify this pattern to include more paths.
     */
    // Use the updated matcher from the docs to exclude common static assets
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}