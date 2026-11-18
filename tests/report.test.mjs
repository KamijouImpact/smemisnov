import test from "node:test";
import assert from "node:assert/strict";
import { summarize, csv } from "../lib/mis/report.ts";
test("saved costs give gross profit before expenses", () => {
  assert.deepEqual(
    summarize([
      {
        transaction_type: "Restock",
        quantity_change: 24,
        total_purchase_cost: 240,
        total_sale_amount: null,
        unit_purchase_cost: 10,
      },
      {
        transaction_type: "Sale",
        quantity_change: -3,
        total_purchase_cost: null,
        total_sale_amount: 45,
        unit_purchase_cost: 10,
      },
    ]),
    {
      revenue: 45,
      purchases: 240,
      savedSaleCost: 30,
      grossProfit: 15,
      missingCostRecords: 0,
      saleRecords: 1,
      lossRecords: 0,
    },
  );
});
test("a reversed sale offsets its saved revenue and cost", () => {
  const r = summarize([
    {
      transaction_type: "Sale",
      quantity_change: -3,
      total_sale_amount: 45,
      unit_purchase_cost: 10,
    },
    {
      transaction_type: "Reversal",
      quantity_change: 3,
      total_sale_amount: -45,
      unit_purchase_cost: 10,
    },
  ]);
  assert.equal(r.revenue, 0);
  assert.equal(r.grossProfit, 0);
});
test("unknown sale cost prevents a misleading complete profit", () => {
  const r = summarize([
    {
      transaction_type: "Sale",
      quantity_change: -1,
      total_sale_amount: 30,
      unit_purchase_cost: null,
    },
  ]);
  assert.equal(r.grossProfit, null);
  assert.equal(r.savedSaleCost, null);
  assert.equal(r.missingCostRecords, 1);
});
test("receipts never count as sales and mixed stock units are not added", () => {
  const r = summarize([
    { transaction_type: "Loss", quantity_change: -2 },
    { transaction_type: "Damage", quantity_change: -5 },
    {
      transaction_type: "Restock",
      quantity_change: 3,
      total_purchase_cost: 100,
    },
  ]);
  assert.equal(r.saleRecords, 0);
  assert.equal(r.revenue, 0);
  assert.equal(r.lossRecords, 2);
  assert.equal(r.purchases, 100);
});
test("CSV escapes quotes, commas, newlines, and spreadsheet formulas", () => {
  const s = csv(
    [
      { name: 'A, "B"\nC', price: 3 },
      { name: "=CMD()", price: null },
    ],
    ["name", "price"],
  );
  assert.ok(s.startsWith("\ufeff"));
  assert.ok(s.includes('"A, ""B""\nC"'));
  assert.ok(s.includes('"\'=CMD()"'));
  assert.ok(s.endsWith(',""'));
});
import { saleDetails } from "../lib/mis/report.ts";
test("sale discrepancy uses the retained promotion and regular history", () => {
  const [sale, reversal] = saleDetails(
    [
      {
        transaction_type: "Sale",
        quantity_change: -3,
        entered_quantity: 3,
        total_sale_amount: 60,
        unit_purchase_cost: 10,
        price_history_id: 1,
        promotion_entry_id: 2,
      },
      {
        transaction_type: "Reversal",
        quantity_change: 3,
        entered_quantity: 3,
        total_sale_amount: -60,
        unit_purchase_cost: 10,
        price_history_id: 1,
        promotion_entry_id: 2,
      },
    ],
    [{ price_history_id: 1, new_price: 22 }],
    [{ promotion_entry_id: 2, promotion_price: 18 }],
  );
  assert.equal(sale.expected_amount, 54);
  assert.equal(sale.price_difference, 6);
  assert.equal(sale.estimated_profit, 30);
  assert.equal(reversal.expected_amount, -54);
  assert.equal(reversal.price_difference, -6);
  assert.equal(reversal.estimated_profit, -30);
});
test("loss record counts include reversals of losses only", () => {
  assert.equal(
    summarize([
      { transaction_type: "Loss" },
      { transaction_type: "Reversal", original_type: "Loss" },
      { transaction_type: "Reversal", original_type: "Sale" },
    ]).lossRecords,
    2,
  );
});
test("numeric CSV changes remain numeric", () => {
  assert.ok(csv([{ change: -3 }], ["change"]).endsWith("\r\n-3"));
});
import { safeNext } from "../lib/mis/paths.ts";
test("auth return paths cannot leave the application", () => {
  assert.equal(
    safeNext("/workspace/concerns?item=123"),
    "/workspace/concerns?item=123",
  );
  for (const s of [
    "//evil.test",
    "/\\evil.test",
    "https://evil.test",
    "/auth/login",
    "/workspace\n/else",
  ])
    assert.equal(safeNext(s), "/workspace");
});
