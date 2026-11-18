# Document-to-implementation reference

Source: [SME: MIS with Price and Stock Control — Project Document](https://docs.google.com/document/d/1SOSJRO3VUSDw7W4N9-sx6zr971V3hOLFPRjpWXjucCg).

The live document revision was checked against the preceding PHP implementation's source snapshot. This version preserves its requirements while using Next.js, Supabase Auth, and PostgreSQL. It does not edit the paper or its schedule.

| Document process                       | Implementation                                                 | Records                                                                                                |
| -------------------------------------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| 1.0 Manage Accounts and Stores         | `accounts.tsx`, `auth.tsx`, `data.ts`, `commands.sql`          | USER_ACCOUNT, SME                                                                                      |
| 2.0 Manage Products                    | `products.tsx`, `catalog.sql`                                  | CATEGORY, BRAND, PRODUCT, PRODUCT_VARIATION, PRODUCT_UNIT, PRODUCT_REQUEST, STORE_PRODUCT, STORE_PRICE |
| 3.0 Manage Prices and Promotions       | `prices.tsx`, `promotions.tsx`, `prices.sql`, `promotions.sql` | PRICE_RULE, PRICE_REQUEST, PRICE_REFERENCE, PRICE_HISTORY, PROMOTION, PROMOTION_ENTRY                  |
| 4.0 Manage Stock                       | `stock.tsx`, `stock.sql`                                       | STORE_PRODUCT, STOCK_TRANSACTION                                                                       |
| 5.0 Generate Reports                   | `reports.tsx`, `report.ts`                                     | Derived from permitted operational records; no extra report table                                      |
| 6.0 Serve Customers and Review Reports | `app/page.tsx`, `concerns.tsx`, `access.sql`, `commands.sql`   | CUSTOMER_REPORT; approved public listing data                                                          |

## Context and access

Exactly three user roles are implemented: Administrator, Owner, and Customer. The Owner performs the store work; no Employee role exists. Guests browse the same public catalog without signing in. A Customer account is needed to submit and follow a report.

Owners see their own stores and private records. The Administrator monitors all stores. Customers see their own reports. Guests and Customers cannot read exact stock quantities, purchase costs, profit estimates, or internal price approvals. Inactive accounts cannot perform business commands. Inactive stores and archived products do not appear as active public listings or price references.

## Data Dictionary mapping

All 18 business entities remain, with lowercase PostgreSQL names corresponding directly to the document's uppercase names. The paper's account identity is implemented by Supabase Auth: USER_ACCOUNT uses the Auth UUID, `login_name` is the account email, and the password hash is managed by Supabase rather than duplicated in a public table. All account foreign keys use UUIDs. Other IDs are generated integer identities. Dates are `timestamptz`, comparison reliability is Boolean, money uses PostgreSQL numeric values, and package stock counts are whole numbers.

The native Auth tables are platform support records, not additional business modules. The original paper's SQLite/PHP technical details do not describe this deployment. The academic relationships and retained business records are preserved.

## Required business rules

- A Product contains Variations. Each Variation has approved Units with fixed stock conversion. Stores share product identities but keep separate stock and prices.
- Brand search keys remove case, accent, and extra-space differences. Administrators curate the product list; the system does not guess that different models or packages are equivalent.
- Other / Not Listed stays in product review until matched to approved details. It cannot autoapprove a price as an unidentified "Other" product.
- A price reference uses the exact Variation and Unit, current approved regular price, active records, and allowed age. It excludes the requesting store. Promotions and pending prices are never sources.
- The rule version, source histories, exact numeric median, rounded-down cutoff, check time, and review reason are retained. There is no invented default rule.
- A price approval changes its request, current price, and one history record atomically. Pending/rejected requests keep the earlier approved price. A first price is hidden until approved. Revisions can link rejected/withdrawn requests.
- A high price or markup triggers review where applicable; it does not itself prove overpricing. Above Reference approval requires an Owner explanation.
- Promotions retain regular history, dates, decisions, and resubmission links. Discounts require approval and valid dates. Overlapping approved promotions for one selling option are rejected.
- Stock changes lock the affected balance. Fixed package conversion is saved on each transaction. Negative balances, repeated openings, and repeated reversals are rejected.
- Sale amounts, cost estimates, price history, and promotion links are frozen on the sale. Later changes do not rewrite them. A different charge needs a reason and appears in sales reports.
- Latest valid receipt/cost correction supplies the current cost estimate. Reversing it restores the prior valid estimate. Missing costs remain null and prevent a misleading complete profit total.
- Reports filter by permitted store and Philippine dates. Current stock is distinguished from period movements. Loss records remain per variation and stock unit rather than adding incompatible units.
- Customer reports retain the exact selling option, seen/charged amounts, approximate time, evidence reference, Owner response, review status, and required closure outcome. The records remain after later price changes.

## Verification

`tests/database.sql` exercises transactions and actual `authenticated`/`anon` permissions, including initial pricing, exact-source autoapproval, rejection/resubmission, package conversion, reversal, immutable sale cost, product matching, event discount, complaint resolution, public privacy, and direct-write denial. All fixtures roll back.

Browser checks exercise the actual Next.js → Supabase Auth → PostgreSQL → refreshed screen path. Report and CSV calculations also have isolated tests. Security and performance advisors are checked after migrations.
