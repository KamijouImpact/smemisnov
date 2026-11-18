import Link from "next/link";
import { Account, Database, Row, peso } from "@/lib/mis/types";
import { Stores, Accounts, MyAccount } from "./accounts";
import { Products, Catalog } from "./products";
import { Prices, Rules } from "./prices";
import { Stock } from "./stock";
import { Promotions } from "./promotions";
import { Concerns } from "./concerns";
import { Reports, Stat } from "./reports";
import { Panel } from "./table";
import { summarize } from "@/lib/mis/report";
const names: Record<string, string> = {
  overview: "Store overview",
  stores: "Stores",
  products: "Store products",
  catalog: "Shared products",
  prices: "Price requests",
  stock: "Stock control",
  promotions: "Promotions",
  reports: "Management reports",
  concerns: "Customer reports",
  rules: "Price rules",
  accounts: "Accounts",
  account: "My account",
};
export function WorkspacePage({
  section,
  user,
  db,
  publicRows,
  requestedItem,
}: {
  section: string;
  user: Account;
  db: Database;
  publicRows: Row[];
  requestedItem?: string;
}) {
  const admin = user.role === "Administrator";
  const props = { db, admin };
  const sum = summarize(db.stock_transaction);
  const content =
    section === "stores" ? (
      <Stores {...props} />
    ) : section === "products" ? (
      <Products {...props} />
    ) : section === "catalog" ? (
      <Catalog {...props} />
    ) : section === "prices" ? (
      <Prices {...props} />
    ) : section === "rules" ? (
      <Rules {...props} />
    ) : section === "stock" ? (
      <Stock {...props} />
    ) : section === "promotions" ? (
      <Promotions {...props} />
    ) : section === "reports" ? (
      <Reports {...props} />
    ) : section === "concerns" ? (
      <Concerns
        {...props}
        customer={user.role === "Customer"}
        publicRows={publicRows}
        requestedItem={requestedItem}
      />
    ) : section === "accounts" ? (
      <Accounts {...props} />
    ) : section === "account" ? (
      <MyAccount user={user} />
    ) : (
      <>
        <div className="stat-grid">
          <Stat
            title="Participating stores"
            value={String(db.sme.filter((r) => r.status === "Active").length)}
          />
          <Stat
            title="Pending prices"
            value={String(
              db.price_request.filter(
                (r) => r.status === "Pending Price Review",
              ).length,
            )}
          />
          <Stat
            title="Low-stock products"
            value={String(
              db.store_product.filter(
                (r) => Number(r.stock_quantity) <= Number(r.low_stock_level),
              ).length,
            )}
          />
          <Stat
            title="Open customer reports"
            value={String(
              db.customer_report.filter((r) => r.status !== "Closed").length,
            )}
          />
        </div>
        <Panel
          title={`Welcome, ${user.full_name.split(" ")[0]}.`}
          description={
            admin
              ? "Review store registrations, product details, and price requests. Monitor stock and customer concerns across participating stores."
              : "Keep your store’s prices and stock records up to date."
          }
        >
          <div className="quick-links">
            {(admin
              ? [
                  ["stores", "Review stores", "Approve store registrations."],
                  [
                    "catalog",
                    "Maintain shared products",
                    "Keep brands, variations, and packages consistent.",
                  ],
                  [
                    "prices",
                    "Review prices",
                    "Review requests and retained price references.",
                  ],
                  [
                    "concerns",
                    "Review customer reports",
                    "Check records and resolve price concerns.",
                  ],
                ]
              : [
                  [
                    "stores",
                    "Register your store",
                    "Start with your store details.",
                  ],
                  [
                    "products",
                    "Add products",
                    "Select approved products or request missing details.",
                  ],
                  [
                    "prices",
                    "Request prices",
                    "Submit or explain a proposed selling price.",
                  ],
                  [
                    "stock",
                    "Record stock",
                    "Keep receipts, sales, and stock counts organized.",
                  ],
                ]
            ).map(([href, title, description]) => (
              <Link key={href} href={`/workspace/${href}`}>
                <span>{title} ↗</span>
                <p>{description}</p>
              </Link>
            ))}
          </div>
        </Panel>
        <Panel
          title="Recorded business totals"
          description="These totals cover all records you can access. Use Management reports to filter by store and date."
        >
          <div className="stat-grid">
            <Stat title="Recorded sales" value={peso(sum.revenue)} />
            <Stat title="Purchase costs recorded" value={peso(sum.purchases)} />
            <Stat
              title="Estimated gross profit"
              value={
                sum.grossProfit === null
                  ? "Incomplete cost data"
                  : peso(sum.grossProfit)
              }
            />
            <Stat
              title="Stock movement records"
              value={String(db.stock_transaction.length)}
            />
          </div>
          <p className="muted-text">
            Gross profit is before operating expenses. Missing purchase costs
            are never treated as zero.
          </p>
        </Panel>
      </>
    );
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">SME MIS / {user.role.toUpperCase()}</span>
          <h1>{names[section]}</h1>
        </div>
        <Link className="button outline small" href="/">
          View public catalog ↗
        </Link>
      </div>
      {content}
    </>
  );
}
