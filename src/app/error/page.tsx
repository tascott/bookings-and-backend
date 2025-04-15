'use client' // Make it a client component for potential interaction/error reporting later

import Link from 'next/link' // Import Link

export default function ErrorPage() {
  return (
    <div style={{ padding: '2rem', textAlign: 'center' }}>
      <h1>Something went wrong</h1>
      <p>Sorry, an unexpected error occurred. Please try again later or contact support.</p>
      {/* Use Link for internal navigation */}
      <Link href="/">Go to Home Page</Link>
    </div>
  )
}