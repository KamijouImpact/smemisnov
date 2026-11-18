"use client";
import { simpleText } from "@/lib/mis/words";
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
    "Sold or received as",
    units,
    "unit_id",
    (u) => `${u.unit_name} · ${u.stock_units} stock units`,
  );
  const fields: Field[] =
    type === "Opening" || type === "Restock"
      ? [
          unit,
          num("entered_quantity", "Quantity", true, 1),
          num("total_purchase_cost", "Total purchase cost", false, 0, "0.01"),
        ]
      : type === "Sale"
        ? [
            unit,
            num("entered_quantity", "Number sold", true, 1),
            {
              ...num("total_sale_amount", "Total charged", false, 0.01, "0.01"),
              help: "Leave blank to use the current approved price or active promotion. A different amount needs a reason.",
            },
            area("reason", "Reason for a different charge", false),
          ]
        : type === "Reversal"
          ? [
              select(
                "correction_of_id",
                "Entry to undo",
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
                    "Stock change (+ to add, − to remove)",
                    true,
                    -100000000,
                  ),
                  value: 0,
                  help: "Use 0 if you are only correcting the purchase cost.",
                },
                num(
                  "unit_purchase_cost",
                  "Correct purchase cost per piece or pair",
                  false,
                  0,
                  "0.000001",
                ),
                select(
                  "correction_of_id",
                  "Related entry (optional)",
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
                num("quantity_change", "Quantity removed", true, 1),
                area("reason", "Reason"),
              ];
  return (
    <>
      <Panel
        title="Current stock"
        description="Check these counts against the stock in your store."
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
              label: "In stock",
              render: (r) =>
                `${r.stock_quantity} ${find(db, "product_variation", r.variation_id).stock_unit}`,
            },
            { key: "low_stock_level", label: "Warning level" },
            {
              key: "latest_unit_cost",
              label: "Latest purchase cost per piece or pair",
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
            title="Update stock"
            description="Choose a product and what happened to its stock."
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
                    <option key={t} value={t}>
                      {simpleText(t)}
                    </option>
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
                submit="Save stock entry"
              />
            ) : (
              <p className="muted-text">Choose a store product to begin.</p>
            )}
          </Panel>
          <Panel collapsible title="Set a low-stock warning">
            <ActionForm
              action="low_stock"
              fields={[
                stockField(db),
                num("low_stock_level", "Warn me when stock reaches"),
              ]}
            />
          </Panel>
        </>
      )}
      <Panel
        title="Stock history"
        description="All stock changes are kept here, including adjustments and undone entries."
      >
        <Table
          compact={[
            "recorded_at",
            "store_product_id",
            "transaction_type",
            "quantity_change",
            "reason",
          ]}
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
            { key: "transaction_type", label: "Action" },
            { key: "quantity_change", label: "Quantity change" },
            { key: "units_per_package", label: "Quantity in pack" },
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
              label: "Purchase cost used",
              render: (r) => peso(r.unit_purchase_cost),
            },
            { key: "price_history_id", label: "Price history" },
            { key: "promotion_entry_id", label: "Promotion entry" },
            { key: "correction_of_id", label: "Related entry" },
            { key: "reason", label: "Reason" },
          ]}
        />
      </Panel>
    </>
  );
}
