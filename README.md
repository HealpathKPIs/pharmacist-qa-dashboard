This is a Next.js QA platform backed by Supabase.

## Authentication and RBAC

Apply all migrations in `supabase/migrations`. The RBAC migration creates only
the application-side profiles schema, policies, constraints, and Auth profile
trigger. It does not create or modify Supabase Auth users.

After the migration succeeds, create the primary Admin through
**Supabase Dashboard → Authentication → Users → Add user** or through
`supabase.auth.admin.createUser()` using this exact email:

```text

```

The profile trigger recognizes this email, creates its active Admin profile,
and grants all three QA modules. Every other Auth user is created as a disabled
Manager with no modules until the primary Admin assigns access.

Public sign-up is disabled in `supabase/config.toml`, and the application has no
registration route or sign-up action. For a hosted Supabase project, keep
**Authentication → Providers → Email → Allow new users to sign up** disabled
when linking or deploying the project.

Required environment variables:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
APP_PASSWORD=
```

The service-role key is server-only and is used exclusively by admin-guarded
user management and existing import/query services.
Managers are read-only and can only open the QA modules listed in their
`accessible_modules` profile field. Admin always receives all modules.

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

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
