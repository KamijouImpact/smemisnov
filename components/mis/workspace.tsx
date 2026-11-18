import Link from "next/link";
import { Account, Database, Row } from "@/lib/mis/types";
import { pageNames } from "@/lib/mis/navigation";
import { Stores, Accounts, MyAccount } from "./accounts";
import { Products, Catalog } from "./products";
import { Prices, Rules } from "./prices";
import { Stock } from "./stock";
import { Promotions } from "./promotions";
import { Concerns } from "./concerns";
import { Reports, Stat } from "./reports";
import { Panel } from "./table";
function Home({
  db,
  admin,
  user,
}: {
  db: Database;
  admin: boolean;
  user: Account;
}) {
  const active = db.sme.some((s) => s.status === "Active");
  const next = admin
    ? db.sme.some((s) => s.status === "Pending")
      ? {
          path: "stores",
          title: "Review new stores",
          text: "Check the store registrations waiting for approval.",
        }
      : db.price_request.some((r) => r.status === "Pending Price Review")
        ? {
            path: "prices",
            title: "Review waiting prices",
            text: "Check the prices that need your decision.",
          }
        : {
            path: "catalog",
            title: "Set up products",
            text: "Add the products and pack sizes that stores can choose.",
          }
    : !db.sme.length
      ? {
          path: "stores",
          title: "Add your store",
          text: "Start with your store name, business type, and address.",
        }
      : !active
        ? {
            path: "stores",
            title: "Your store is waiting for approval",
            text: "The Administrator will check your store details before you add products.",
          }
        : !db.store_price.length
          ? {
              path: "products",
              title: "Add your first product",
              text: "Choose a product and pack size from the approved list.",
            }
          : db.price_request.some((r) => r.status === "Pending Price Review") &&
              !db.store_price.some((p) => p.regular_price !== null)
            ? {
                path: "prices",
                title: "Check your price request",
                text: "Your first price is waiting for review. You can check its status or add a reason.",
              }
            : !db.store_price.some((p) => p.regular_price !== null)
              ? {
                  path: "prices",
                  title: "Request a selling price",
                  text: "Send your price for approval. Approved prices appear in the product list.",
                }
              : {
                  path: "stock",
                  title: "Update your stock",
                  text: "Record stock received, items sold, or changes to your stock count.",
                };
  return (
    <>
      <Panel
        title={`Hello, ${user.full_name.split(" ")[0]}.`}
        description={next.text}
      >
        <Link className="button" href={`/workspace/${next.path}`}>
          {next.title} →
        </Link>
      </Panel>
      {(admin || db.sme.length > 0) && (
        <div className="stat-grid home-stats">
          <Stat
            title={admin ? "Active stores" : "Products"}
            value={String(
              admin
                ? db.sme.filter((s) => s.status === "Active").length
                : db.store_product.length,
            )}
          />
          <Stat
            title="Prices waiting for review"
            value={String(
              db.price_request.filter(
                (r) => r.status === "Pending Price Review",
              ).length,
            )}
          />
          <Stat
            title="Low stock"
            value={String(
              db.store_product.filter(
                (r) => Number(r.stock_quantity) <= Number(r.low_stock_level),
              ).length,
            )}
          />
        </div>
      )}
      <Panel title="Common tasks">
        <div className="quick-links">
          {(admin
            ? [
                ["stores", "Review stores", "Approve new store registrations."],
                [
                  "prices",
                  "Review prices",
                  "Check prices that need a decision.",
                ],
                [
                  "concerns",
                  "Read price reports",
                  "Check reported price problems.",
                ],
                [
                  "reports",
                  "View reports",
                  "See store, sales, and stock records.",
                ],
              ]
            : [
                ["products", "Products", "Add products and choose pack sizes."],
                ["prices", "Prices", "Request or check a selling price."],
                ["stock", "Stock", "Record stock received and items sold."],
                ["reports", "Reports", "See sales, costs, and stock levels."],
              ]
          ).map(([path, title, text]) => (
            <Link key={path} href={`/workspace/${path}`}>
              <span>{title} →</span>
              <p>{text}</p>
            </Link>
          ))}
        </div>
      </Panel>
    </>
  );
}
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
  const props = { db, admin: user.role === "Administrator" };
  const screens: Record<string, React.ReactNode> = {
    stores: <Stores {...props} />,
    products: <Products {...props} />,
    catalog: <Catalog {...props} />,
    prices: <Prices {...props} />,
    rules: <Rules {...props} />,
    stock: <Stock {...props} />,
    promotions: <Promotions {...props} />,
    reports: <Reports {...props} />,
    concerns: (
      <Concerns
        {...props}
        customer={user.role === "Customer"}
        publicRows={publicRows}
        requestedItem={requestedItem}
      />
    ),
    accounts: <Accounts {...props} />,
    account: <MyAccount user={user} />,
  };
  return (
    <>
      <div className="page-heading">
        <h1>
          {user.role === "Customer" && section === "concerns"
            ? "My price reports"
            : pageNames[section]}
        </h1>
      </div>
      {section === "overview" ? (
        <Home db={db} admin={props.admin} user={user} />
      ) : (
        screens[section]
      )}
    </>
  );
}
