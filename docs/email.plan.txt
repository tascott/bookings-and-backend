Email Strategy & Plan:
Goal: Integrate transactional and potentially other email notifications into the application, allowing users basic control over optional emails.
Core Technology:
Sending Service: Resend (already set up).
Sending Trigger: Centralized utility function (`src/utils/sendEmail.ts`).
Email Content: Use React Email library (`react-email`, `@react-email/components`) to build reusable, type-safe email templates (`src/emails`).

Phased Implementation Plan:

Phase 4: Other Common Emails
- Welcome Email: After successful user sign-up (within the sign-up logic or potentially via a Supabase Auth trigger/hook), trigger sending a welcome email using a dedicated template.

Phase 5: Admin Email Management
- New Dashboard Section: Create an "Email Management" section for Admins.
- Functionality (Future): This could potentially allow admins to:
  - View email sending logs/status (requires logging Resend responses).
  - Manually trigger certain emails (e.g., re-send confirmation).
  - Manage basic template content (if not using React Email directly or integrating CMS).

Ongoing Tasks:
- Code Separation: Keep email templates in `src/emails`, use the `src/utils/sendEmail.ts` utility, and call the utility from relevant API routes.
- Documentation (`docs/overallguide.txt`):
  - Add details about the email sending setup (Resend, API Key env var).
  - Document the `sendEmail` utility.
  - Explain the email templating approach (React Email, `src/emails` dir).
  - Document the email preference flags in the `profiles` table and how they're used.
- Bulk Emailing: As noted, bulk/marketing emails are handled externally (e.g., via Gmail). This plan focuses only on transactional emails sent from the application itself.

---
Completed Steps & Notes (For Future AI/Developers):

Summary of Completed Work:
- Phase 1 (Booking Confirmation): Implemented client and admin booking confirmation emails triggered from `/api/client-booking` using the `sendEmail` utility and templates (`BookingConfirmationClient.tsx`, `BookingConfirmationAdmin.tsx`).
- Phase 2 (User Email Preferences): Added `email_allow_promotional` and `email_allow_informational` booleans to `profiles` table. Profile update API (`/api/profile`) and UI (`ProfileManagement.tsx`) allow users to manage these preferences. *Note: Logic to CHECK these preferences before sending non-essential emails still needs implementation where appropriate.*
- Phase 4 (Password Reset):
    - UI: `/forgot-password` page created, linked from login.
    - API (Request): `/api/auth/request-password-reset` route created. Uses `supabaseAdmin.auth.admin.generateLink` -> sends custom email (`PasswordReset.tsx`) via `sendEmail` utility. Tells Supabase to redirect to `/api/auth/callback`.
    - API (Callback): `/api/auth/callback` route created. Receives callback from Supabase, preserves URL hash fragment (`#access_token=...`), and redirects to `/reset-password`.
    - Page (Reset): `/reset-password` page created. **Critically**, it uses `@supabase/ssr`'s `createBrowserClient` but *manually* parses the `#access_token` and `#refresh_token` from `window.location.hash`. It then calls `supabase.auth.setSession()` explicitly in a `useEffect` hook. Only after this manual session setting succeeds does it allow the user to submit the form, which then calls `supabase.auth.updateUser()` successfully. *Note: Relying on `onAuthStateChange` did not work for this flow.*
- Setup: Resend integration is complete (`sendEmail.ts`, `RESEND_API_KEY` env var). React Email is installed and used for templates in `src/emails`. A base layout (`BaseLayout.tsx`) exists.
- Email Verification: Implemented using a custom email (`VerifyEmail.tsx`) triggered by `/api/auth/request-email-verification`. *Requires `NEXT_PUBLIC_SITE_URL` env var.*

Key Gotchas & Info:
- Password Reset Fragment Handling: The client-side `/reset-password` page **must** manually parse the `#access_token` and `#refresh_token` from the URL fragment and explicitly call `supabase.auth.setSession()` using the client instance created by `@supabase/ssr`'s `createBrowserClient()`. The automatic session detection via `onAuthStateChange` does not reliably work for this flow in the Next.js App Router context, and middleware/server-side code cannot see the fragment.
- Custom Emails vs. Supabase Default: Ensure Supabase's default emails for password reset/email verification are DISABLED in Supabase settings if using custom emails.
- `generateLink`: `/api/auth/request-password-reset` uses the *admin* client for `generateLink`.
- `NEXT_PUBLIC_SITE_URL`: Crucial for generating correct callback/redirect URLs. Set in `.env.local` (e.g., `http://localhost:3000`).
- Profile Data Fetching: API routes typically fetch user-specific profile data using `supabaseAdmin` based on the user ID obtained from the standard server client.