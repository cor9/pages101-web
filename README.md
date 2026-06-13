# Pages101

Pages101 is the Child Actor 101 actor-page builder for young performers. The v1 goal is a safe-by-default, casting-ready page that a parent can publish in one sitting.

## Current Scope

This repo starts with a Phase 0 / early Phase 1 foundation:

- Next.js App Router scaffold
- Wildcard subdomain middleware shape for `*.pages.childactor101.com`
- Server-rendered public actor page at `/p/[slug]`
- Template tokens for Classic, Splash, and Prestige
- Static 101 Tips content map
- Editor/dashboard shell at `/app`
- Initial Supabase `pages101` schema migration

## Local Development

```bash
npm install
npm run dev
```

Open `http://localhost:3000/p/maya-ralston` for the seeded public page or `http://localhost:3000/app` for the editor shell.

## Environment

The planned production environment uses:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- `SES_REGION`
- `SES_FROM_ADDRESS`
- `VERCEL_API_TOKEN`
- `NEXT_PUBLIC_ROOT_DOMAIN=pages.childactor101.com`
