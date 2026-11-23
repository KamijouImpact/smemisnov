# SME MIS — Price and Stock Control

A Next.js and Supabase implementation of the project document. It supports Administrator, Owner, and Customer accounts, with public browsing that requires no login.

## Main functions

- One login/register portal, optional email confirmation, password recovery, and separate role access.
- Store registration and Administrator review.
- Shared categories, brands, products, variations, and fixed selling packages.
- Other / Not Listed requests that the Administrator matches or resolves.
- Exact-product price references, versioned rules, automatic approval, manual review, explanations, rejection, resubmission, and price history.
- Opening stock, restocks, sales, losses, spoilage, damage, quantity/cost corrections, and one-time reversals.
- Low-stock warnings, reports, CSV export, and printing.
- Administrator event promotions with Owner participation and discount approval.
- Customer price reports, Owner responses, and Administrator findings.

## Run locally

Use Node.js 22.18 or later (Node.js 24 recommended).

```sh
npm ci
cp .env.example .env.local
# Set your Supabase URL and publishable key.
npm run dev
```

`NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` must also be set in Vercel. Only the publishable key belongs in these variables. The application does not need a service-role key.

The connected project is `smemisDB` (`zueuocwtbbbptoqscilq`). Its migrations have been applied. For another Supabase project, apply `supabase/migrations` in filename order using the Supabase CLI or SQL Editor. Do not reapply them to an already migrated project. `database/` contains the readable SQL modules; the timestamped migrations are the deployment record.

## First Administrator

Register through the normal portal. When Supabase email confirmation is off, registration signs the user in immediately. Public registration creates only an Owner or Customer account.

Administrator access is assigned separately by the database owner. An email address, confirmation timestamp, or registration metadata never grants this role. This also applies to `kenthilo0000@gmail.com`; the old email-based setup has been removed.

In Supabase Authentication → Users, identify the intended account and copy its UUID. Confirm that it belongs to the intended Administrator, then run this in the SQL Editor with that UUID:

```sql
update public.user_account
set role = 'Administrator'
where user_id = 'replace-with-the-intended-account-uuid'::uuid
returning user_id, full_name, role;
```

Do not assign Administrator by email alone when confirmation is off. Knowing or registering an email address does not prove ownership.

There are no shared demo passwords or public test accounts in this repository.

## First store and product

1. The Owner registers a store with an approved business type, and an Administrator activates it.
2. In **My products**, the Owner adds the product to their store. The form offers approved category and stock-unit choices, plus pack-count suggestions. Record the brand, variant, size, and barcode when available so exact matches can be distinguished.
3. The Owner records starting stock and uses **Set price** to submit the first price. The listing becomes public after Administrator approval.
4. Use **Change price** on the listing to propose another price. A pending request leaves the approved price in effect.
5. Administrators review exact matching listings in **Price approvals**. Evidence is private to Administrators. Requests without sufficient matching data stay in manual review under the configured policy.

Owners can request missing business types, product categories, and stock units. An Administrator can approve or reject them from **Option requests**. Approval makes the option available to Owners. Existing stores with older business-type values can choose an approved replacement.

Existing shared catalog listings and product requests are retained. Administrators review older catalog requests in **Product requests** and can approve one only after selecting an exact pack.

The latest specification proposes manual approval for all increases and immediate Owner decreases. This differs from the existing configurable automatic approval policy. This update requires manual review for the first price of a new store-owned product and keeps the existing policy for subsequent changes pending a policy decision.

## Simple screens

The main menu shows everyday tasks: Home, Products, Prices, Stock, Reports, and Price reports. Administrators also see Stores. Less-used options are under More. Product setup sections, older records, and extra transaction details can be expanded when needed. The database records and approval rules are unchanged.

The interface uses plain CSS; the unused Tailwind setup and old starter pages have been removed. Each page loads the records it uses.

## Project structure

| Folder                 | Purpose                                                                |
| ---------------------- | ---------------------------------------------------------------------- |
| `app/`                 | Public catalog, auth routes, and protected workspace routes            |
| `components/mis/`      | Separate screens and reusable forms/tables                             |
| `lib/mis/`             | Data access, shared types, report calculations, return-path validation |
| `lib/supabase/`        | Cookie-based server and browser clients, session refresh               |
| `database/`            | Readable PostgreSQL business and access-rule modules                   |
| `supabase/migrations/` | Ordered database deployments                                           |
| `tests/`               | Report tests, rollback-based database scenarios, browser checks        |
| `docs/`                | Document cross-reference and operating rules                           |

## Checks

```sh
npm run lint
npm run typecheck
npm test
npm run build
```

Run `tests/database.sql` through the database owner's SQL connection. It creates temporary fixtures inside a transaction, checks workflows and actual RLS permissions, then rolls everything back. Sequence numbers may advance; no business/test rows remain.

`tests/browser.py` uses Playwright with temporary QA accounts supplied through an untracked JSON file. The database owner provisions and cleans up those accounts. It exercises real logins, requests, approvals, package stock, sales, promotions, complaints, reports, and customer access restrictions. Do not use production accounts for this test.

## Auth setup

In Supabase Authentication URL settings, use your live domain as the Site URL and allow its `/auth/confirm` and `/auth/update-password` URLs. Allow localhost equivalents for development. Email confirmation may be turned off in Supabase. With it off, registration opens the account immediately; with it on, the app asks the user to confirm. Password-reset email still needs a working mail provider. Supabase's default mail service has delivery and recipient limits; configure an SMTP provider for open public registration when those limits apply.

## Boundaries

The system records finished retail goods sold by piece, pair, or fixed package. Sales are operational records; there is no checkout, ordering, payment, delivery, payroll, recipe/ingredient tracking, variable-weight selling, or full accounting.

Price approval follows participation rules and retained evidence. It does not establish legal authority or guarantee a universally fair price. Gross profit is an estimate before operating expenses. Availability depends on complete stock entries and physical stock checks.
