# SME MIS project diary

Read the newest entry first. For setup, workspace locations and role workflows, start with the [contributor guide](AGENTS.md). Add dated entries for changes that affect how people use, operate or develop the system. Include the decision, verification and outstanding work. Keep account credentials and customer or store records out of the diary.

## 2026-11-24 — Add tabs within Stores

The Administrator sidebar opens Stores. Inside, Pending, Reviewed and Manage access each have their own tab. Pending shows the registration count. With an empty queue, Stores opens on Reviewed. Lint and build passed. A local browser check with fixture data covered all tabs, keyboard navigation and approving a store.

## 2026-11-24 — Separate store approvals from access management

Administrators open a registration to review its details and save a decision on that store. Reviewed stores appear in a separate list, with pause and reactivation controls under Manage store access.

## 2026-11-24 — Remove redundant navigation

Removed the Browse products link from the homepage and the shared login and registration screen. The SME MIS brand still links to the homepage.

## 2026-11-24 — Registration from the public homepage

The guest header previously exposed only Log in. Register now opens the existing sign-up form directly beside Log in. Checked the header destination against the sign-up route and its registration mode.

## 2026-11-23 — Contributor onboarding

The requested onboarding is for developers and AI agents joining this repository. The previous update combined contributor notes and app navigation improvements. The root contributor guide now gives incoming contributors a reading order, a product-form-to-database example, and the workflow for verification, release and handoff. The README links to it first. Checked the guide’s repository paths, setup links and RPC example. The open pricing decision below still needs an answer.

## 2026-11-23 — Make each role’s starting point clear

The Owner’s main menu now includes **Sales & stock reports**. Overview points a new Owner to their own product and its **Set price** action. The Administrator’s next step prioritizes waiting prices and includes pending option requests. Customers start by browsing approved listings.

The README now maps the three workspaces and explains how to run, check and publish changes. The project documents describe different staffing models. The agreed roles for this implementation are Owner, Administrator and Customer.

Verification covered lint, TypeScript, nine unit tests, a production build, and local browser sign-in and navigation for all three roles using fixture accounts.

## 2026-11-23 — Store-owned products and clean choices

Owners manage their own products, stock and prices. The first price of a new store-owned product needs Administrator approval. An Administrator can compare recent approved regular prices for the same variation and pack at other participating stores. Missing or insufficient evidence goes to manual review. Signed-in Owners stay in their own workspace.

Store registration and product entry now offer 14 business types, 17 product categories and 21 stock units. Owners request a missing option and Administrators review it. Existing business types can be updated under **My store**. Verification included database workflow checks and browser checks of option requests and the production Administrator review page. See commits `cfc698c`, `d6fb104` and `3c3ceae`.

**Open pricing decision.** Later price changes use the configured approval rule. The pasted blueprint proposes manual approval for every increase and immediate decreases. Confirm that policy before changing how an approved price takes effect.

## 2026-11-18 — Store setup and product requests

New Owners register one store. Administrators activate stores and can find outstanding catalog requests under **Product requests**. Approval of a legacy product request requires a matching pack so later price comparisons refer to the same selling quantity. See commits `2bf8391` and `2ca8ac4`.
