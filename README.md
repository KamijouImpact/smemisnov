# SME MIS

A minimal Next.js app with Supabase Auth.

## Local development

1. Run `npm ci`.
2. Copy `.env.example` to `.env.local` and set the Supabase URL and publishable key.
3. Run `npm run dev` and open http://localhost:3000.

The public entry point is `app/page.tsx`. Auth screens are under `app/auth/`, and the authenticated account page is under `app/protected/`. Run `npm run build` before deploying.

The homepage is the public product catalog. Guests can open it without signing in. Keep new screens usable on phones, tablets and desktops, and check narrow widths before publishing.

Registration asks for an account type, email, and password. Apply the migrations in `supabase/migrations/` to a development Supabase project before testing registration. The database assigns the Store Owner or Customer role at signup and allows each account to read its own role.

## Business locations

Business Settings uses the Philippine Statistics Authority’s [PSGC third-quarter 2026 publication](https://psa.gov.ph/classification/psgc). Apply both the location schema and the PSGC seed migration. The database saves the selected barangay code and assembles the address from its official hierarchy and any storefront details entered by the Owner.

To enable optional Google Maps lookup, enable Maps JavaScript API and Places API (New) in a billing-enabled Google Cloud project. Set `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` in Vercel and redeploy. Restrict the browser key to your site and those APIs. The app stores the selected Place ID and uses Google’s address and coordinates only for the on-screen preview.
