"use client";
import { useState } from "react";
import { ActionForm } from "./form";
import { Panel, Table, Status } from "./table";
import { Props, area, choice, num, select, text } from "./fields";
import { Row, date, label, peso } from "@/lib/mis/types";
export function Concerns({
  db,
  admin,
  customer,
  publicRows,
  requestedItem,
}: { customer: boolean; publicRows: Row[]; requestedItem?: string } & Props) {
  const [selected, setSelected] = useState(requestedItem || "");
  const listing = publicRows.find((r) => String(r.store_price_id) === selected);
  const reportOptions = select(
    "customer_report_id",
    "Open report",
    db.customer_report.filter((r) => r.status !== "Closed"),
    "customer_report_id",
    (r) => `#${r.customer_report_id} · ${r.description}`,
  );
  return (
    <>
      {customer && (
        <Panel
          title="Report a price problem"
          description="Choose the exact product and package. Tell us what you saw or were charged. The Owner can respond, and the Administrator reviews the records and available evidence."
        >
          <label className="standalone-field">
            <span>Store product</span>
            <select
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
            >
              <option value="">Choose…</option>
              {publicRows.map((r) => (
                <option
                  key={String(r.store_price_id)}
                  value={String(r.store_price_id)}
                >
                  {r.store_name} · {r.brand_name} {r.product_name} ·{" "}
                  {r.variation_name} · {r.unit_name}
                </option>
              ))}
            </select>
          </label>
          {listing ? (
            <ActionForm
              key={selected}
              action="customer_report"
              hidden={{ store_price_id: selected }}
              fields={[
                {
                  ...num("listed_price", "Listed price", true, 0.01, "0.01"),
                  value: Number(listing.selling_price),
                },
                num("charged_price", "Price charged", false, 0.01, "0.01"),
                {
                  name: "transaction_at",
                  label: "When it happened (Philippine time)",
                  type: "datetime-local",
                  required: false,
                },
                area("description", "What happened?"),
                text(
                  "evidence_reference",
                  "Receipt / photo reference or link",
                  false,
                ),
              ]}
              submit="Submit report"
            />
          ) : (
            <p className="muted-text">
              Select a listed product to make a report.
            </p>
          )}
        </Panel>
      )}
      <Panel title={customer ? "My price reports" : "Price reports"}>
        <Table
          compact={[
            "store_price_id",
            "description",
            "status",
            "owner_response",
            "outcome",
          ]}
          rows={[...db.customer_report].reverse()}
          columns={[
            { key: "customer_report_id", label: "Report" },
            {
              key: "store_price_id",
              label: "Product",
              render: (r) =>
                customer
                  ? (() => {
                      const p = publicRows.find(
                        (p) => p.store_price_id === r.store_price_id,
                      );
                      return p
                        ? `${p.store_name} · ${p.product_name} · ${p.variation_name} · ${p.unit_name}`
                        : `Listing #${r.store_price_id}`;
                    })()
                  : label(db, r.store_price_id),
            },
            {
              key: "listed_price",
              label: "Listed / seen",
              render: (r) => peso(r.listed_price),
            },
            {
              key: "charged_price",
              label: "Charged",
              render: (r) => peso(r.charged_price),
            },
            {
              key: "transaction_at",
              label: "When",
              render: (r) => date(r.transaction_at),
            },
            { key: "description", label: "What happened" },
            { key: "evidence_reference", label: "Evidence reference" },
            { key: "owner_response", label: "Owner response" },
            {
              key: "status",
              label: "Status",
              render: (r) => <Status value={r.status} />,
            },
            { key: "outcome", label: "Result" },
            { key: "outcome_details", label: "Review details" },
          ]}
        />
      </Panel>
      {!customer &&
        (admin ? (
          <Panel
            title="Review a price report"
            description="Use the report’s product, package, and transaction time to check price history, promotion records, and recorded sales. Missing evidence does not prove a violation."
          >
            <ActionForm
              action="review_report"
              fields={[
                reportOptions,
                choice("status", "Report status", ["Under Review", "Closed"]),
                choice(
                  "outcome",
                  "Result",
                  [
                    "Confirmed Discrepancy",
                    "Package Mismatch",
                    "Insufficient Evidence",
                    "No Discrepancy Established",
                  ],
                  false,
                ),
                area("outcome_details", "What you found"),
              ]}
              submit="Save review"
            />
          </Panel>
        ) : (
          <Panel title="Respond to a report">
            <ActionForm
              action="report_response"
              fields={[reportOptions, area("owner_response", "Your response")]}
              submit="Send response"
            />
          </Panel>
        ))}
    </>
  );
}
