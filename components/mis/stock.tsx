"use client";
import { simpleText } from "@/lib/mis/words";
import Link from "next/link";
import { useState } from "react";
import { ActionForm } from "./form";
import { Panel, Table, Status } from "./table";
import { Props, area, num, select, stockField } from "./fields";
import { Field, date, find, label, peso } from "@/lib/mis/types";
export function Stock({ db, admin }: Props) {
  const activeProducts = db.store_product.filter(
    (r) =>
      r.status === "Active" && find(db, "sme", r.sme_id).status === "Active",
  );
  const onlyProduct =
    activeProducts.length === 1
      ? String(activeProducts[0].store_product_id)
      : "";
  const [product, setProduct] = useState(onlyProduct);
  const hasMovements = (id: string) =>
    db.stock_transaction.some((t) => String(t.store_product_id) === id);
  const [type, setType] = useState(() =>
    onlyProduct && !hasMovements(onlyProduct) ? "Opening" : "Restock",
  );
  const sp = find(db, "store_product", product);
  const transactions = db.stock_transaction.filter(
    (t) => String(t.store_product_id) === product,
  );
  const reversedTransactions = new Set(
    transactions
      .filter((t) => t.transaction_type === "Reversal")
      .map((t) => t.correction_of_id),
  );
  const salableUnits = new Set(
    db.store_price
      .filter(
        (r) =>
          String(r.store_product_id) === product &&
          r.status === "Active" &&
          r.regular_price !== null,
      )
      .map((r) => r.unit_id),
  );
  const units = db.product_unit.filter(
    (u) =>
      u.variation_id === sp.variation_id &&
      u.status === "Active" &&
      (type !== "Sale" || salableUnits.has(u.unit_id)),
  );
  const unit = select(
    "unit_id",
    "Pack size",
    units,
    "unit_id",
    (u) =>
      `${u.unit_name} · ${u.stock_units} ${find(db, "product_variation", sp.variation_id).stock_unit}`,
  );
  const fields: Field[] =
    type === "Opening" || type === "Restock"
      ? [
          unit,
          num("entered_quantity", "Number received", true, 1),
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
                transactions.filter(
                  (t) =>
                    t.transaction_type !== "Reversal" &&
                    !reversedTransactions.has(t.stock_transaction_id),
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
                  "Corrected cost per stock unit",
                  false,
                  0,
                  "0.000001",
                ),
                select(
                  "correction_of_id",
                  "Related entry (optional)",
                  transactions,
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
      {!admin &&
        (activeProducts.length > 0 ? (
          <Panel
            title="Update stock"
            description="Pack quantities convert to the product’s shared stock count."
          >
            <div className="fields stock-picker">
              <label>
                <span>Store product</span>
                <select
                  value={product}
                  onChange={(e) => {
                    const next = e.target.value;
                    setProduct(next);
                    setType(
                      next && !hasMovements(next) ? "Opening" : "Restock",
                    );
                  }}
                >
                  <option value="">Choose…</option>
                  {activeProducts.map((r) => (
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
                <span>What happened?</span>
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
            {product && type === "Sale" && units.length === 0 && (
              <p className="notice">
                Set an approved price for a pack size before recording a sale.{" "}
                <Link href="/workspace/prices">Open Price requests</Link>
              </p>
            )}
            {product && (type !== "Sale" || units.length > 0) && (
              <ActionForm
                key={`${product}-${type}`}
                action="stock"
                hidden={{ store_product_id: product, transaction_type: type }}
                fields={fields}
                submit="Save stock entry"
              />
            )}
          </Panel>
        ) : (
          <p className="notice">
            Add a product to an active store before recording stock.{" "}
            <Link href="/workspace/products">Open My products</Link>
          </p>
        ))}
      <Panel title="Current stock">
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
              label: "Latest cost per stock unit",
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
      {!admin && activeProducts.length > 0 && (
        <Panel collapsible title="Set a low-stock warning">
          <ActionForm
            action="low_stock"
            fields={[
              stockField({ ...db, store_product: activeProducts }),
              num("low_stock_level", "Warn at or below this stock count"),
            ]}
            submit="Save warning level"
          />
        </Panel>
      )}
      <Panel collapsible title="Stock history">
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
