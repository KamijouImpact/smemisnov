"use client";
import { useState } from "react";
import { ActionForm } from "./form";
import { Panel, Table, Status } from "./table";
import { Props, area, num, select, stockField } from "./fields";
import { Field, date, find, label, peso } from "@/lib/mis/types";
export function Stock({ db, admin }: Props) {
  const [product, setProduct] = useState("");
  const [type, setType] = useState("Restock");
  const sp = find(db, "store_product", product);
  const units = db.product_unit.filter(
    (u) => u.variation_id === sp.variation_id && u.status === "Active",
  );
  const unit = select(
    "unit_id",
    "Selling / receipt unit",
    units,
    "unit_id",
    (u) => `${u.unit_name} · ${u.stock_units} stock units`,
  );
  const fields: Field[] =
    type === "Opening" || type === "Restock"
      ? [
          unit,
          num("entered_quantity", "Number of packages / units", true, 1),
          num("total_purchase_cost", "Total purchase cost", false, 0, "0.01"),
        ]
      : type === "Sale"
        ? [
            unit,
            num("entered_quantity", "Number sold", true, 1),
            {
              ...num(
                "total_sale_amount",
                "Total actually charged",
                false,
                0.01,
                "0.01",
              ),
              help: "Leave blank to use the current approved price or active promotion. A different amount needs a reason.",
            },
            area("reason", "Reason for a different charge", false),
          ]
        : type === "Reversal"
          ? [
              select(
                "correction_of_id",
                "Earlier movement to reverse",
                db.stock_transaction.filter(
                  (t) =>
                    String(t.store_product_id) === product &&
                    t.transaction_type !== "Reversal" &&
                    !db.stock_transaction.some(
                      (r) =>
                        r.transaction_type === "Reversal" &&
                        r.correction_of_id === t.stock_transaction_id,
                    ),
                ),
                "stock_transaction_id",
                (t) =>
                  `#${t.stock_transaction_id} · ${t.transaction_type} · ${t.quantity_change} · ${date(t.recorded_at)}`,
              ),
              area("reason", "Reason"),
            ]
          : type === "Correction"
            ? [
                {
                  ...num(
                    "quantity_change",
                    "Signed change in stock units",
                    true,
                    -100000000,
                  ),
                  value: 0,
                  help: "Use a negative number to remove stock. Zero is allowed for a cost-only correction.",
                },
                num(
                  "unit_purchase_cost",
                  "Corrected cost per stock unit",
                  false,
                  0,
                  "0.000001",
                ),
                select(
                  "correction_of_id",
                  "Related earlier movement",
                  db.stock_transaction.filter(
                    (t) => String(t.store_product_id) === product,
                  ),
                  "stock_transaction_id",
                  (t) => `#${t.stock_transaction_id} · ${t.transaction_type}`,
                  false,
                ),
                area("reason", "Reason"),
              ]
            : [
                num("quantity_change", "Stock units removed", true, 1),
                area("reason", "Reason"),
              ];
  return (
    <>
      <Panel
        title="Stock balances"
        description="Packages convert to the variation’s stock unit. Keep physical counts up to date; the system can only track recorded movements."
      >
        <Table
          rows={db.store_product}
          columns={[
            {
              key: "store_product_id",
              label: "Product",
              render: (r) => label(db, r.store_product_id, "stock"),
            },
            {
              key: "stock_quantity",
              label: "Stock on hand",
              render: (r) =>
                `${r.stock_quantity} ${find(db, "product_variation", r.variation_id).stock_unit}`,
            },
            { key: "low_stock_level", label: "Warning level" },
            {
              key: "latest_unit_cost",
              label: "Latest estimated cost / stock unit",
              render: (r) => peso(r.latest_unit_cost),
            },
            {
              key: "warning",
              label: "Stock status",
              render: (r) => (
                <Status
                  value={
                    Number(r.stock_quantity) <= Number(r.low_stock_level)
                      ? "Low stock"
                      : "Available"
                  }
                />
              ),
            },
          ]}
        />
      </Panel>
      {!admin && (
        <>
          <Panel
            title="Record a stock movement"
            description="Sales are stock records. This screen does not take orders or payments."
          >
            <div className="fields stock-picker">
              <label>
                <span>Store product</span>
                <select
                  value={product}
                  onChange={(e) => setProduct(e.target.value)}
                >
                  <option value="">Choose…</option>
                  {db.store_product
                    .filter((r) => r.status === "Active")
                    .map((r) => (
                      <option
                        key={String(r.store_product_id)}
                        value={String(r.store_product_id)}
                      >
                        {label(db, r.store_product_id, "stock")}
                      </option>
                    ))}
                </select>
              </label>
              <label>
                <span>Movement</span>
                <select value={type} onChange={(e) => setType(e.target.value)}>
                  {[
                    "Opening",
                    "Restock",
                    "Sale",
                    "Loss",
                    "Spoilage",
                    "Damage",
                    "Correction",
                    "Reversal",
                  ].map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </label>
            </div>
            {product ? (
              <ActionForm
                key={`${product}-${type}`}
                action="stock"
                hidden={{ store_product_id: product, transaction_type: type }}
                fields={fields}
                submit="Record movement"
              />
            ) : (
              <p className="muted-text">Choose a store product to begin.</p>
            )}
          </Panel>
          <Panel title="Low-stock warning level">
            <ActionForm
              action="low_stock"
              fields={[
                stockField(db),
                num("low_stock_level", "Warning level in stock units"),
              ]}
            />
          </Panel>
        </>
      )}
      <Panel
        title="Stock movement history"
        description="Corrections and reversals create new records. Earlier movements and their package conversions stay unchanged."
      >
        <Table
          rows={[...db.stock_transaction].reverse()}
          columns={[
            { key: "stock_transaction_id", label: "ID" },
            {
              key: "recorded_at",
              label: "Recorded",
              render: (r) => date(r.recorded_at),
            },
            {
              key: "store_product_id",
              label: "Product",
              render: (r) => label(db, r.store_product_id, "stock"),
            },
            { key: "transaction_type", label: "Movement" },
            { key: "quantity_change", label: "Stock unit change" },
            { key: "units_per_package", label: "Units / package" },
            {
              key: "total_purchase_cost",
              label: "Purchase cost",
              render: (r) => peso(r.total_purchase_cost),
            },
            {
              key: "total_sale_amount",
              label: "Actually charged",
              render: (r) => peso(r.total_sale_amount),
            },
            {
              key: "unit_purchase_cost",
              label: "Saved cost / unit",
              render: (r) => peso(r.unit_purchase_cost),
            },
            { key: "price_history_id", label: "Price history" },
            { key: "promotion_entry_id", label: "Promotion entry" },
            { key: "correction_of_id", label: "Earlier movement" },
            { key: "reason", label: "Reason" },
          ]}
        />
      </Panel>
    </>
  );
}
