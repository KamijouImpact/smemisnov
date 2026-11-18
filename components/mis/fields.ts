import { Database, Field, Row, label } from "@/lib/mis/types";
export type Props = { db: Database; admin: boolean };
export const text = (name: string, label: string, required = true): Field => ({
  name,
  label,
  required,
});
export const area = (name: string, label: string, required = true): Field => ({
  ...text(name, label, required),
  type: "textarea",
});
export const num = (
  name: string,
  label: string,
  required = true,
  min = 0,
  step = "1",
): Field => ({ ...text(name, label, required), type: "number", min, step });
export const choice = (
  name: string,
  label: string,
  values: string[],
  required = true,
): Field => ({
  name,
  label,
  required,
  options: values.map((v) => ({ value: v, label: v })),
});
export const select = (
  name: string,
  labelText: string,
  rows: Row[],
  key: string,
  display: (r: Row) => string,
  required = true,
): Field => ({
  name,
  label: labelText,
  required,
  options: rows.map((r) => ({ value: String(r[key]), label: display(r) })),
});
export const storeField = (db: Database) =>
  select(
    "sme_id",
    "Store",
    db.sme.filter((s) => s.status === "Active"),
    "sme_id",
    (r) => String(r.store_name),
  );
export const optionField = (db: Database) =>
  select(
    "store_price_id",
    "Product and pack size",
    db.store_price.filter((s) => s.status === "Active"),
    "store_price_id",
    (r) => label(db, r.store_price_id),
  );
export const stockField = (db: Database) =>
  select(
    "store_product_id",
    "Product",
    db.store_product.filter((s) => s.status === "Active"),
    "store_product_id",
    (r) => label(db, r.store_product_id, "stock"),
  );
export const unitField = (db: Database, required = true) =>
  select(
    "unit_id",
    "Product and pack size",
    db.product_unit.filter((s) => s.status === "Active"),
    "unit_id",
    (r) => label(db, r.unit_id, "unit"),
    required,
  );
export const decisionFields = [
  choice("decision", "Decision", ["Approved", "Rejected"]),
  area("decision_reason", "Decision reason"),
];
