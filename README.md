# SME MIS — Price and Stock Control

A Next.js and Supabase implementation of the project document. It supports Administrator, Owner, and Customer accounts, with public browsing that requires no login.

## Main functions

- One login/register portal, email confirmation, password recovery, and separate role access.
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

For this deployment, the connected project owner's verified email (`kenthilo0000@gmail.com`) receives Administrator access after email confirmation. Register through the same portal and confirm the email. The choice of Owner or Customer on that form does not grant Administrator access.

This trusted email is deployment configuration in the `owner_administrator_setup` migration. Change it before using these migrations for a different owner. Registration metadata never authorizes Administrator access.

For other Administrators, the database owner can promote a verified, registered account in the Supabase SQL Editor:

```sql
update public.user_account a
set role = 'Administrator'
from auth.users u
where u.id = a.user_id
  and lower(u.email) = lower('verified-admin@example.com')
  and u.email_confirmed_at is not null;
```

There are no shared demo passwords or public test accounts in this repository.

## First store and product

1. Administrator: add a Category and any Brand, then Product, Variation, and Selling Unit.
2. Owner: register a store; Administrator activates it.
3. Owner: select the shared selling units or submit Other / Not Listed details.
4. Owner: record opening stock and submit a selling-price request.
5. Administrator: review the first price. The approved listing then appears publicly.
6. Administrator: activate a price rule only after agreeing on its settings. Without a rule or enough reliable references, requests remain for manual review.

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

In Supabase Authentication URL settings, use your live domain as the Site URL and allow its `/auth/confirm` and `/auth/update-password` URLs. Allow localhost equivalents for development. Keep email confirmation enabled because Administrator setup relies on verified ownership of the configured email. Supabase's default mail service has delivery and recipient limits; configure an SMTP provider for open public registration when those limits apply.

## Boundaries

The system records finished retail goods sold by piece, pair, or fixed package. Sales are operational records; there is no checkout, ordering, payment, delivery, payroll, recipe/ingredient tracking, variable-weight selling, or full accounting.

Price approval follows participation rules and retained evidence. It does not establish legal authority or guarantee a universally fair price. Gross profit is an estimate before operating expenses. Availability depends on complete stock entries and physical stock checks.
