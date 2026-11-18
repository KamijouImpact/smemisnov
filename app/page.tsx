import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { account } from "@/lib/mis/data";
import { Row, peso, date } from "@/lib/mis/types";
import { Header } from "@/components/mis/header";
import { Status } from "@/components/mis/table";
export const dynamic = "force-dynamic";
export default async function Browse({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string; store?: string }>;
}) {
  const params = await searchParams;
  const user = await account();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("browse_products", {
    search: params.q || "",
  });
  const all: Row[] = data || [];
  const rows = all.filter(
    (r) =>
      (!params.category || r.category_name === params.category) &&
      (!params.store || r.store_name === params.store),
  );
  return (
    <>
      <Header user={user} />
      <main className="public-main">
        <section className="browse-heading">
          <h1>Browse products</h1>
          <p>
            Find a product, check its price, and see if it is in stock. No login
            needed.
          </p>
        </section>
        <section className="catalog-area">
          <p className="count search-count">
            {rows.length} {rows.length === 1 ? "product" : "products"}
          </p>
          <form className="searchbar">
            <label className="search-input">
              <span aria-hidden="true">⌕</span>
              <input
                aria-label="Search products or stores"
                name="q"
                placeholder="Search products, brands, or stores…"
                defaultValue={params.q}
              />
            </label>
            <select
              name="category"
              aria-label="Category"
              defaultValue={params.category || ""}
            >
              <option value="">All categories</option>
              {[...new Set(all.map((r) => String(r.category_name)))]
                .sort()
                .map((c) => (
                  <option key={c}>{c}</option>
                ))}
            </select>
            <select
              name="store"
              aria-label="Store"
              defaultValue={params.store || ""}
            >
              <option value="">All stores</option>
              {[...new Set(all.map((r) => String(r.store_name)))]
                .sort()
                .map((s) => (
                  <option key={s}>{s}</option>
                ))}
            </select>
            <button className="button">Search</button>
          </form>
          {error ? (
            <div className="notice error" role="alert">
              Products could not be loaded. Please try again shortly.
            </div>
          ) : rows.length ? (
            <div className="product-grid">
              {rows.map((r) => (
                <article
                  className="product-card"
                  key={String(r.store_price_id)}
                >
                  <div className="product-info">
                    <span className="product-category">{r.category_name}</span>
                    <div className="product-top">
                      <span className="muted-text">
                        {r.brand_name || "Unbranded"}
                      </span>
                      <Status value={r.availability} />
                    </div>
                    <h3>{r.product_name}</h3>
                    <p className="variation">
                      {[
                        r.model_or_style,
                        r.variation_name,
                        r.size,
                        r.color,
                        r.flavor,
                        r.capacity,
                        r.net_quantity
                          ? `${r.net_quantity} ${r.net_unit}`
                          : null,
                        r.condition === "Used" ? "Used" : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                    <p className="package">
                      {r.unit_name} · {r.stock_units} {r.stock_unit}
                    </p>
                    <div className="price-line">
                      <strong>{peso(r.selling_price)}</strong>
                      {r.promotion_name && (
                        <>
                          <del>{peso(r.regular_price)}</del>
                          <span className="promo-label">
                            {r.promotion_name}
                          </span>
                        </>
                      )}
                    </div>
                    {r.promotion_name && (
                      <p className="promo-dates">
                        Promotion: {date(r.promotion_starts_at)} –{" "}
                        {date(r.promotion_ends_at)}
                      </p>
                    )}
                    <div className="store-line">
                      <span>⌂ {r.store_name}</span>
                      <small>{r.address}</small>
                    </div>
                    <div className="product-footer">
                      <small>
                        Stock reported {date(r.availability_updated_at)}
                      </small>
                      <Link
                        href={`/workspace/concerns?item=${r.store_price_id}`}
                      >
                        Report a price problem →
                      </Link>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="empty large">
              <span>▦</span>
              <h3>
                {params.q ? "No matching products" : "No products listed yet"}
              </h3>
              <p>
                {params.q
                  ? "Try another product, brand, or store name."
                  : "Approved store listings will appear here. Owners can register a store and submit products for review."}
              </p>
              <Link
                className="button outline"
                href={params.q ? "/" : "/auth/login?mode=register"}
              >
                {params.q ? "Clear search" : "Add your store"}
              </Link>
            </div>
          )}
        </section>
        <p className="catalog-footnote">
          Availability is based on each store’s records. Check with the store
          before visiting. Price approval follows system rules and review.
        </p>
      </main>
      <footer className="footer">
        <span>SME MIS</span>
        <p>Prices and stock for small stores.</p>
        <span>Price & Stock Control</span>
      </footer>
    </>
  );
}
