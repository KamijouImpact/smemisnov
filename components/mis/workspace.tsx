import Link from "next/link";
import { Account, Database, Row } from "@/lib/mis/types";
import { pageName } from "@/lib/mis/navigation";
import { Stores, Accounts, MyAccount } from "./accounts";
import { Products, Catalog } from "./products";
import { Prices, Rules } from "./prices";
import { Stock } from "./stock";
import { Promotions } from "./promotions";
import { Concerns } from "./concerns";
import { Reports, Stat } from "./reports";
import { Panel } from "./table";
function nextTask(db: Database, admin: boolean, waitingPrices: number) {
  if (admin) {
    if (db.sme.some((store) => store.status === "Pending"))
      return {
        path: "stores",
        title: "Review new stores",
        text: "Check the store registrations waiting for approval.",
      };
    if (waitingPrices)
      return {
        path: "prices",
        title: "Review price requests",
        text: "Check the prices that need a decision.",
      };
    if (!db.store_product.length)
      return {
        path: "catalog",
        title: "Open the product catalog",
        text: "Add products and pack sizes for stores to choose from.",
      };
    return {
      path: "reports",
      title: "View sales and stock reports",
      text: "No stores or prices are waiting for approval.",
    };
  }

  if (!db.sme.length)
    return {
      path: "stores",
      title: "Add your store",
      text: "Enter your store name, business type, and address.",
    };
  if (!db.sme.some((store) => store.status === "Active"))
    return {
      path: "stores",
      title: "Check your store status",
      text: "You can add products once an Administrator activates your store.",
    };
  if (!db.store_price.some((price) => price.status === "Active"))
    return {
      path: "products",
      title: "Add a product",
      text: "Choose a product and pack size from the shared catalog.",
    };
  if (
    db.store_price.some(
      (price) => price.status === "Active" && price.regular_price !== null,
    )
  )
    return {
      path: "stock",
      title: "Record a stock change",
      text: "Record stock received, items sold, or changes to your stock count.",
    };
  if (waitingPrices)
    return {
      path: "prices",
      title: "Check your price request",
      text: "See whether your price is approved or needs more information.",
    };
  return {
    path: "prices",
    title: "Request a selling price",
    text: "Approved selling prices appear in the public catalog.",
  };
}

function Home({ db, role }: { db: Database; role: Account["role"] }) {
  const admin = role === "Administrator";
  const waitingPrices = db.price_request.filter(
    (request) => request.status === "Pending Price Review",
  ).length;
  const next = nextTask(db, admin, waitingPrices);
  return (
    <>
      <Panel title="Next step" description={next.text}>
        <Link className="button" href={`/workspace/${next.path}`}>
          {next.title}
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
            value={String(waitingPrices)}
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
                ["stores", "Approve new store registrations."],
                ["prices", "Check prices that need a decision."],
                ["concerns", "Check reported price problems."],
                ["reports", "See store, sales, and stock records."],
              ]
            : [
                ["products", "Add products and choose pack sizes."],
                ["prices", "Request or check a selling price."],
                ["stock", "Record stock received and items sold."],
                ["reports", "See sales, costs, and stock levels."],
              ]
          )
            .filter(([path]) => path !== next.path)
            .map(([path, text]) => (
              <Link key={path} href={`/workspace/${path}`}>
                <span>{pageName(role, path)}</span>
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
        <h1>{pageName(user.role, section)}</h1>
      </div>
      {section === "overview" ? (
        <Home db={db} role={user.role} />
      ) : (
        screens[section]
      )}
    </>
  );
}
