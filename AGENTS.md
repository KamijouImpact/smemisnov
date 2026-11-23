# Joining SME MIS as a developer or AI agent

Start each session by reading the newest entry in [diary.md](diary.md). It records what shipped, why it changed, what was verified and which decisions are still open. Check your branch and working changes with `git status -sb`. Use `git log -5 --oneline` to see what changed since the handoff.

## Understand the system

Owners manage their own products, prices and stock, and use their own sales and stock analytics. Administrators control prices using comparable approved prices for the same product variation and pack at other stores. Insufficient evidence goes to manual review. Customers browse published prices and availability. The current roles are Owner, Administrator and Customer.

Business types, product categories and stock units come from approved choices. When a choice is missing, the Owner requests it and an Administrator decides whether to add it. For unresolved pricing policy, read the diary before changing approval behavior.

## Find the code

Follow a request from the screen to its data. For example, for an Owner adding a product, open the workspace route in `app/workspace/[section]/page.tsx`, the product form in `components/mis/add-product.tsx`, and the page data in `lib/mis/data.ts`. Search `supabase/migrations/` for the form’s RPC name, `create_store_product`, to find the database implementation. Read later migrations for changes to earlier definitions. The [document cross-reference](docs/CROSS_REFERENCE.md) maps other workflows to their screens and records.

## Make and hand off a change

1. Follow [local setup](README.md#run-locally) to install dependencies, configure the development database connection and start the app.
2. Trace the affected role’s workflow. For access or pricing changes, check the database rules as well as the screen. When the paper and deployed behavior differ, use the diary to see which decision was agreed and which is still open.
3. Run the relevant [checks](README.md#checks). For a workflow change, exercise the affected role’s entry point and resulting state. Use test accounts and a test database for fixture-based checks.
4. Add a dated entry at the top of the diary. Record the change, reason, checks actually run and anything the next contributor needs to pick up. When publishing, verify the deployment from `main` and the affected production route before calling it live.
