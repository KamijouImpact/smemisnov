"use client";
import { useState } from "react";
import { Panel, Table } from "./table";
import { Props } from "./fields";
import { Row, date, find, label, peso } from "@/lib/mis/types";
import { csv, summarize, saleDetails } from "@/lib/mis/report";
export function Reports({ db, admin }: Props) {
  const [store, setStore] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [type, setType] = useState("Stock changes");
  const own = (sp: unknown) =>
    !store || String(find(db, "store_product", sp).sme_id) === store;
  const at = (v: unknown) => {
    if (!v) return !from && !to;
    const stamp = new Date(String(v)).getTime();
    return (
      (!from || stamp >= new Date(from + "T00:00:00+08:00").getTime()) &&
      (!to || stamp < new Date(to + "T00:00:00+08:00").getTime() + 86400000)
    );
  };
  const movements: Row[] = db.stock_transaction
    .filter((t) => own(t.store_product_id) && at(t.recorded_at))
    .map((t) => ({
      ...t,
      original_type:
        find(db, "stock_transaction", t.correction_of_id).transaction_type ??
        null,
    }));
  const summary = summarize(movements);
  let rows: Row[];
  let columns: { key: string; label: string }[];
  if (type === "Sales and profit") {
    rows = saleDetails(movements, db.price_history, db.promotion_entry).map(
      (r) => ({
        id: r.stock_transaction_id,
        product: label(db, r.store_product_id, "stock"),
        type: r.transaction_type,
        charged: r.total_sale_amount,
        expected: r.expected_amount,
        difference: r.price_difference,
        saved_unit_cost: r.unit_purchase_cost,
        estimated_profit: r.estimated_profit,
        reason: r.reason,
        recorded: date(r.recorded_at),
      }),
    );
    columns = [
      { key: "id", label: "ID" },
      { key: "product", label: "Product" },
      { key: "type", label: "Type" },
      { key: "charged", label: "Actually charged" },
      { key: "expected", label: "Listed total" },
      { key: "difference", label: "Price difference" },
      { key: "saved_unit_cost", label: "Purchase cost used" },
      { key: "estimated_profit", label: "Estimated profit before expenses" },
      { key: "reason", label: "Reason" },
      { key: "recorded", label: "Date" },
    ];
  } else if (type === "Current stock" || type === "Low stock") {
    rows = db.store_product
      .filter(
        (r) =>
          own(r.store_product_id) &&
          (type !== "Low stock" ||
            Number(r.stock_quantity) <= Number(r.low_stock_level)),
      )
      .map((r) => ({
        product: label(db, r.store_product_id, "stock"),
        stock: r.stock_quantity,
        stock_unit: find(db, "product_variation", r.variation_id).stock_unit,
        warning_level: r.low_stock_level,
        latest_cost: r.latest_unit_cost,
      }));
    columns = [
      { key: "product", label: "Product" },
      { key: "stock", label: "Current stock" },
      { key: "stock_unit", label: "Counted in" },
      { key: "warning_level", label: "Warning level" },
      { key: "latest_cost", label: "Estimated cost / unit" },
    ];
  } else if (type === "Price history") {
    rows = db.price_history
      .filter(
        (r) =>
          own(find(db, "store_price", r.store_price_id).store_product_id) &&
          at(r.effective_at),
      )
      .map((r) => ({
        history_id: r.price_history_id,
        product: label(db, r.store_price_id),
        old_price: r.old_price,
        new_price: r.new_price,
        effective: date(r.effective_at),
      }));
    columns = [
      { key: "history_id", label: "History ID" },
      { key: "product", label: "Product" },
      { key: "old_price", label: "Old price" },
      { key: "new_price", label: "Approved price" },
      { key: "effective", label: "Effective" },
    ];
  } else if (type === "Prices waiting for review") {
    rows = db.price_request
      .filter(
        (r) =>
          r.status === "Pending Price Review" &&
          own(find(db, "store_price", r.store_price_id).store_product_id) &&
          at(r.submitted_at),
      )
      .map((r) => ({
        request_id: r.price_request_id,
        product: label(db, r.store_price_id),
        proposed_price: r.proposed_price,
        review_reason: r.review_reason,
        owner_reason: r.owner_reason,
        submitted: date(r.submitted_at),
      }));
    columns = [
      { key: "request_id", label: "Request" },
      { key: "product", label: "Product" },
      { key: "proposed_price", label: "Proposed price" },
      { key: "review_reason", label: "Review reason" },
      { key: "owner_reason", label: "Owner explanation" },
      { key: "submitted", label: "Submitted" },
    ];
  } else if (type === "Discounts waiting for review") {
    rows = db.promotion_entry
      .filter(
        (r) =>
          r.status === "Pending" &&
          own(find(db, "store_price", r.store_price_id).store_product_id) &&
          at(r.submitted_at),
      )
      .map((r) => ({
        entry_id: r.promotion_entry_id,
        event: find(db, "promotion", r.promotion_id).promotion_name,
        product: label(db, r.store_price_id),
        promotion_price: r.promotion_price,
        submitted: date(r.submitted_at),
      }));
    columns = [
      { key: "entry_id", label: "Entry" },
      { key: "event", label: "Event" },
      { key: "product", label: "Product" },
      { key: "promotion_price", label: "Proposed discount price" },
      { key: "submitted", label: "Submitted" },
    ];
  } else {
    rows = movements
      .filter(
        (r) =>
          type !== "Loss and damage" ||
          ["Loss", "Spoilage", "Damage"].includes(String(r.transaction_type)) ||
          (r.transaction_type === "Reversal" &&
            ["Loss", "Spoilage", "Damage"].includes(String(r.original_type))),
      )
      .map((r) => ({
        id: r.stock_transaction_id,
        product: label(db, r.store_product_id, "stock"),
        type: r.transaction_type,
        quantity_change: r.quantity_change,
        stock_unit: find(
          db,
          "product_variation",
          find(db, "store_product", r.store_product_id).variation_id,
        ).stock_unit,
        purchase_cost: r.total_purchase_cost,
        charged: r.total_sale_amount,
        saved_unit_cost: r.unit_purchase_cost,
        price_history_id: r.price_history_id,
        promotion_entry_id: r.promotion_entry_id,
        correction_of_id: r.correction_of_id,
        reason: r.reason,
        recorded: date(r.recorded_at),
      }));
    columns = [
      { key: "id", label: "ID" },
      { key: "product", label: "Product" },
      { key: "type", label: "Type" },
      { key: "quantity_change", label: "Quantity change" },
      { key: "stock_unit", label: "Unit" },
      { key: "purchase_cost", label: "Purchase cost" },
      { key: "charged", label: "Charged" },
      { key: "saved_unit_cost", label: "Purchase cost used" },
      { key: "price_history_id", label: "Price history" },
      { key: "promotion_entry_id", label: "Promotion entry" },
      { key: "correction_of_id", label: "Earlier movement" },
      { key: "reason", label: "Reason" },
      { key: "recorded", label: "Date" },
    ];
  }
  const snapshot = type === "Current stock" || type === "Low stock";
  const invalid = !snapshot && Boolean(from && to && from > to);
  const showSummary = type === "Stock changes" || type === "Sales and profit";
  const storeOptions = admin ? "All stores" : "All my stores";
  return (
    <>
      <Panel
        title="Choose a report"
        description={
          snapshot
            ? "Stock balances show current quantities."
            : "Use the date range to narrow records by Philippine time."
        }
      >
        <div className="report-filters">
          <label>
            <span>Report</span>
            <select value={type} onChange={(e) => setType(e.target.value)}>
              <optgroup label="Stock and sales">
                <option>Stock changes</option>
                <option>Current stock</option>
                <option>Low stock</option>
                <option>Sales and profit</option>
                <option>Loss and damage</option>
              </optgroup>
              <optgroup label="Prices and approvals">
                <option>Price history</option>
                <option>Prices waiting for review</option>
                <option>Discounts waiting for review</option>
              </optgroup>
            </select>
          </label>
          <label>
            <span>Store</span>
            <select value={store} onChange={(e) => setStore(e.target.value)}>
              <option value="">{storeOptions}</option>
              {db.sme.map((s) => (
                <option key={String(s.sme_id)} value={String(s.sme_id)}>
                  {s.store_name}
                </option>
              ))}
            </select>
          </label>
          {!snapshot && (
            <>
              <label>
                <span>From (PH)</span>
                <input
                  type="date"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                />
              </label>
              <label>
                <span>To (PH)</span>
                <input
                  type="date"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                />
              </label>
            </>
          )}
        </div>
        {invalid ? (
          <p className="notice error">
            The end date must be on or after the start date.
          </p>
        ) : (
          <>
            {showSummary && (
              <>
                <div className="stat-grid">
                  <Stat title="Sales recorded" value={peso(summary.revenue)} />
                  <Stat
                    title="Purchase costs recorded"
                    value={peso(summary.purchases)}
                  />
                  <Stat
                    title="Estimated profit before expenses"
                    value={
                      summary.grossProfit === null
                        ? "Incomplete cost data"
                        : peso(summary.grossProfit)
                    }
                  />
                  <Stat
                    title="Loss and damage entries"
                    value={String(summary.lossRecords)}
                  />
                </div>
                {summary.missingCostRecords > 0 && (
                  <p className="notice">
                    {summary.missingCostRecords} sale or reversal records have
                    no saved purchase cost. A complete profit total is
                    unavailable.
                  </p>
                )}
              </>
            )}
            <div className="report-actions">
              <button
                className="button outline"
                onClick={() => {
                  const url = URL.createObjectURL(
                    new Blob(
                      [
                        csv(
                          rows,
                          columns.map((c) => c.key),
                        ),
                      ],
                      { type: "text/csv;charset=utf-8;" },
                    ),
                  );
                  const link = document.createElement("a");
                  link.href = url;
                  link.download = `sme-mis-${type.toLowerCase().replaceAll(" ", "-")}.csv`;
                  link.click();
                  setTimeout(() => URL.revokeObjectURL(url), 1000);
                }}
              >
                Export CSV
              </button>
              <button className="button outline" onClick={() => window.print()}>
                Print report
              </button>
              <span className="muted-text">
                {rows.length} records · Philippine time
              </span>
            </div>
            <Table
              rows={rows}
              columns={columns}
              empty={
                snapshot
                  ? "No products match this stock report."
                  : "No records match this report. Try changing the store or date range."
              }
            />
          </>
        )}
      </Panel>
    </>
  );
}
export function Stat({ title, value }: { title: string; value: string }) {
  return (
    <div className="stat">
      <span>{title}</span>
      <strong>{value}</strong>
    </div>
  );
}
