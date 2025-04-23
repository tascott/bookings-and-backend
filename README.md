This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Creating the First Admin User

When setting up the application for the first time, there won't be any admin users. Follow these steps to designate the first administrator:

1.  **Sign Up:** Create a new user account through the application's standard sign-up process. This will create an entry in `auth.users` and potentially `public.clients`.
2.  **Get User ID:** Log in to your Supabase project dashboard. Navigate to `Authentication` -> `Users`. Find the user you just created and copy their `User ID` (it's a UUID). Note down the user's name as well.
3.  **Create Staff Record with Admin Role:**
    *   Go to the `Table Editor` in the Supabase dashboard.
    *   Select the `staff` table (under the `public` schema).
    *   Click `Insert` -> `Insert row`.
    *   Fill in the `user_id` field with the User ID copied in the previous step.
    *   Set the `role` column value to `admin`.
    *   Fill in the `name` field (e.g., using the user's name from their profile or sign-up). Other fields like `phone_number` or `notes` can be left blank or filled if known.
    *   Save the new row.

Alternatively, you can use the SQL Editor in Supabase:

```sql
-- Replace 'YOUR_USER_ID' with the actual User ID copied from the Auth section
-- Replace 'Admin User Name' with the actual name for the staff record
INSERT INTO public.staff (user_id, name, role)
VALUES ('YOUR_USER_ID', 'Admin User Name', 'admin');
```

The user will now have admin privileges based on their association with this staff record.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
