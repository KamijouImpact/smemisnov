export type Row = Record<string, string | number | boolean | null>;
export type Database = Record<string, Row[]>;
export type Account = {
  user_id: string;
  full_name: string;
  role: "Administrator" | "Owner" | "Customer";
  status: string;
  login_name: string;
};
export type Option = { value: string | number; label: string };
export type Field = {
  name: string;
  label: string;
  type?: string;
  options?: Option[];
  required?: boolean;
  help?: string;
  value?: string | number;
  min?: number;
  max?: number;
  step?: string;
};
export const tables = [
  "user_account",
  "sme",
  "category",
  "brand",
  "product",
  "product_variation",
  "product_unit",
  "product_request",
  "store_product",
  "store_price",
  "price_rule",
  "price_request",
  "price_reference",
  "price_history",
  "stock_transaction",
  "promotion",
  "promotion_entry",
  "customer_report",
];
export function find(
  db: Database,
  table: string,
  id: unknown,
  key?: string,
): Row {
  const keys: Record<string, string> = {
    user_account: "user_id",
    sme: "sme_id",
    category: "category_id",
    brand: "brand_id",
    product: "product_id",
    product_variation: "variation_id",
    product_unit: "unit_id",
    store_product: "store_product_id",
    store_price: "store_price_id",
    price_history: "price_history_id",
    promotion: "promotion_id",
    promotion_entry: "promotion_entry_id",
    price_request: "price_request_id",
    stock_transaction: "stock_transaction_id",
  };
  return (
    db[table]?.find((r) => String(r[key || keys[table]]) === String(id)) || {}
  );
}
export function label(db: Database, id: unknown, kind = "price"): string {
  const sp =
    kind === "stock"
      ? find(db, "store_product", id)
      : find(db, "store_product", find(db, "store_price", id).store_product_id);
  const v =
    kind === "unit"
      ? find(db, "product_variation", find(db, "product_unit", id).variation_id)
      : find(db, "product_variation", sp.variation_id);
  const p = find(db, "product", v.product_id);
  const b = find(db, "brand", p.brand_id);
  const u =
    kind === "unit"
      ? find(db, "product_unit", id)
      : find(db, "product_unit", find(db, "store_price", id).unit_id);
  return [
    kind !== "unit" ? find(db, "sme", sp.sme_id).store_name : null,
    b.brand_name,
    p.product_name,
    p.model_or_style,
    v.variation_name,
    kind !== "stock"
      ? `${u.unit_name || ""} (${u.stock_units || "?"} ${v.stock_unit || "units"})`
      : null,
  ]
    .filter(Boolean)
    .join(" · ");
}
export const peso = (value: unknown) =>
  value === null || value === undefined || value === ""
    ? "Not recorded"
    : new Intl.NumberFormat("en-PH", {
        style: "currency",
        currency: "PHP",
      }).format(Number(value));
export const date = (value: unknown) =>
  value
    ? new Date(String(value)).toLocaleString("en-PH", {
        timeZone: "Asia/Manila",
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "—";
