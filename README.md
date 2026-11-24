# SME MIS

A minimal Next.js app with Supabase Auth.

## Local development

1. Run `npm ci`.
2. Copy `.env.example` to `.env.local` and set the Supabase URL and publishable key.
3. Run `npm run dev` and open http://localhost:3000.

The public entry point is `app/page.tsx`. Auth screens are under `app/auth/`, and the authenticated account page is under `app/protected/`. Run `npm run build` before deploying.

The homepage is the public product catalog. Guests can open it without signing in. Keep new screens usable on phones, tablets and desktops, and check narrow widths before publishing.
