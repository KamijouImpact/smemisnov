import type { Row } from "./types";
export function summarize(movements: Row[]) {
  const sales = movements.filter(
    (t) => t.total_sale_amount !== null && t.total_sale_amount !== undefined,
  );
  const revenue = sales.reduce((n, t) => n + Number(t.total_sale_amount), 0);
  // Saved sale costs remain fixed even if later receipts change the current estimate.
  const missing = sales.filter(
    (t) => t.unit_purchase_cost === null || t.unit_purchase_cost === undefined,
  ).length;
  const cost = sales.reduce(
    (n, t) => n - Number(t.quantity_change) * Number(t.unit_purchase_cost ?? 0),
    0,
  );
  const purchases = movements.reduce(
    (n, t) => n + Number(t.total_purchase_cost ?? 0),
    0,
  );
  return {
    revenue,
    purchases,
    savedSaleCost: missing ? null : cost,
    grossProfit: missing ? null : revenue - cost,
    missingCostRecords: missing,
    saleRecords: sales.length,
    lossRecords: movements.filter(
      (t) =>
        ["Loss", "Spoilage", "Damage"].includes(String(t.transaction_type)) ||
        (t.transaction_type === "Reversal" &&
          ["Loss", "Spoilage", "Damage"].includes(String(t.original_type))),
    ).length,
  };
}
export function csv(rows: Row[], columns: string[]) {
  const cell = (value: unknown) => {
    if (typeof value === "number") return String(value);
    let s = String(value ?? "");
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
    return '"' + s.replaceAll('"', '""') + '"';
  };
  return (
    "\ufeff" +
    [
      columns.map(cell).join(","),
      ...rows.map((r) => columns.map((k) => cell(r[k])).join(",")),
    ].join("\r\n")
  );
}
export function saleDetails(
  movements: Row[],
  histories: Row[],
  promotions: Row[],
): Row[] {
  return movements
    .filter(
      (t) => t.total_sale_amount !== null && t.total_sale_amount !== undefined,
    )
    .map((t) => {
      const h = histories.find(
        (h) => h.price_history_id === t.price_history_id,
      );
      const p = promotions.find(
        (p) => p.promotion_entry_id === t.promotion_entry_id,
      );
      const unitPrice = p?.promotion_price ?? h?.new_price;
      const sign = t.transaction_type === "Reversal" ? -1 : 1;
      const expected =
        unitPrice === undefined || unitPrice === null
          ? null
          : Math.round(
              Number(unitPrice) * Number(t.entered_quantity) * sign * 100,
            ) / 100;
      const assigned =
        t.unit_purchase_cost === null || t.unit_purchase_cost === undefined
          ? null
          : -Number(t.quantity_change) * Number(t.unit_purchase_cost);
      return {
        ...t,
        expected_amount: expected,
        price_difference:
          expected === null
            ? null
            : Math.round((Number(t.total_sale_amount) - expected) * 100) / 100,
        estimated_profit:
          assigned === null ? null : Number(t.total_sale_amount) - assigned,
      };
    });
}
