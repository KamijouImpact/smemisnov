import type { ComponentProps } from "react";
import Link from "next/link";
import { ActionForm } from "./form";
import { AdminPriceForm, OwnerPriceForm } from "./price-forms";
import { Panel, Table, Status } from "./table";
import { Props, area, num, optionField, select } from "./fields";
import {
  date,
  find,
  label,
  peso,
  type Database,
  type Row,
} from "@/lib/mis/types";
import { simpleText } from "@/lib/mis/words";

function priceLabel(value: Row[string]) {
  return value == null ? "No approved price yet" : peso(value);
}

type PriceEvidence = {
  reference_count: number;
  participating_store_count: number;
  minimum_price: number | null;
  median_price: number | null;
  maximum_price: number | null;
  indication: string;
  recorded_at: string;
  historical: boolean;
  references: Row[];
};

function percentChange(value: number, basis: number) {
  return new Intl.NumberFormat("en-PH", {
    style: "percent",
    maximumFractionDigits: 2,
  }).format((value - basis) / basis);
}

function ExactEvidence({ db, request }: { db: Database; request: Row }) {
  const snapshot = find(
    db,
    "price_request_evidence",
    request.price_request_id,
    "price_request_id",
  ).snapshot as unknown as PriceEvidence | undefined;
  const proposed = Number(request.proposed_price);
  return (
    <section className="extra-fields" aria-label="Exact price references">
      <h3>Exact price references</h3>
      {!snapshot ? (
        <p>No saved comparison is available.</p>
      ) : (
        <>
          <p>
            <strong>{snapshot.indication}</strong>
          </p>
          <p>
            Matched stores including the store under review{" "}
            <strong>{snapshot.participating_store_count}</strong> · Other stores
            with approved prices <strong>{snapshot.reference_count}</strong>
          </p>
          {snapshot.median_price != null && (
            <p>
              Observed range {peso(snapshot.minimum_price)}–
              {peso(snapshot.maximum_price)}
              {" · "}Median {peso(snapshot.median_price)}
              {" · "}Difference from median{" "}
              {peso(proposed - snapshot.median_price)}
              {snapshot.median_price > 0 &&
                ` (${percentChange(proposed, snapshot.median_price)})`}
            </p>
          )}
          <p className="muted-text">
            {snapshot.historical
              ? "Legacy comparison saved"
              : "Comparison saved"}{" "}
            {date(snapshot.recorded_at)}
          </p>
          <Table
            rows={snapshot.references}
            empty="No exact references were saved for this request."
            columns={[
              {
                key: "store_name",
                label: "Other store",
                render: (reference) =>
                  reference.store_name || `Store #${reference.sme_id}`,
              },
              {
                key: "approved_price",
                label: "Approved price",
                render: (reference) => peso(reference.approved_price),
              },
              {
                key: "price_updated_at",
                label: "Date approved",
                render: (reference) => date(reference.price_updated_at),
              },
              { key: "matching_basis", label: "Match basis" },
            ]}
          />
        </>
      )}
    </section>
  );
}

function PriceReviewDetails({ db, request }: { db: Database; request: Row }) {
  const current = find(db, "store_price", request.store_price_id).regular_price;
  const owner = find(db, "user_account", request.submitted_by);
  const proposed = Number(request.proposed_price);
  return (
    <>
      <section className="extra-fields" aria-label="Request details">
        <p>
          <strong>Current approved price</strong> {priceLabel(current)} ·{" "}
          <strong>Proposed price</strong> {peso(proposed)}
        </p>
        {current != null && Number(current) > 0 && (
          <p>
            Change {peso(proposed - Number(current))} (
            {percentChange(proposed, Number(current))})
          </p>
        )}
        <p>
          {request.review_reason && `${simpleText(request.review_reason)} · `}
          Submitted {date(request.submitted_at)}
          {owner.full_name && ` by ${owner.full_name}`}
        </p>
        <p>
          <strong>Owner’s reason</strong>{" "}
          {request.owner_reason || "No reason provided"}
        </p>
      </section>
      <ExactEvidence db={db} request={request} />
    </>
  );
}
export function Prices({
  db,
  admin,
  requestedItem,
}: Props & { requestedItem?: string }) {
  const sellingOptions = optionField(db);
  const requests = [...db.price_request].reverse();
  const pending = requests.filter((r) => r.status === "Pending Price Review");
  const past = requests.filter((r) => r.status !== "Pending Price Review");
  const columns: ComponentProps<typeof Table>["columns"] = [
    { key: "price_request_id", label: "Request" },
    {
      key: "store_price_id",
      label: "Product",
      render: (r) => label(db, r.store_price_id),
    },
    {
      key: "previous_price",
      label: "Price when requested",
      render: (r) => priceLabel(r.previous_price),
    },
    {
      key: "proposed_price",
      label: "Proposed price",
      render: (r) => peso(r.proposed_price),
    },
    {
      key: "status",
      label: "Status",
      render: (r) => <Status value={r.status} />,
    },
    { key: "review_reason", label: "Why it needs review" },
    { key: "owner_reason", label: "Owner’s reason" },
    { key: "decision_source", label: "Decided by" },
    { key: "decision_reason", label: "Decision reason" },
    {
      key: "submitted_at",
      label: "Submitted",
      render: (r) => date(r.submitted_at),
    },
  ];
  return (
    <>
      {!admin && !sellingOptions.options?.length && (
        <p className="notice">
          Add a product and pack size to your store before requesting a price.{" "}
          <Link href="/workspace/products">Open My products</Link>
        </p>
      )}
      {!admin && Boolean(sellingOptions.options?.length) && (
        <Panel
          title="Request a price"
          description="Your current price stays in use until a change is approved. A new product appears after its first price is approved."
        >
          <OwnerPriceForm
            key={requestedItem}
            requestedItem={requestedItem}
            listings={(sellingOptions.options ?? []).map((option) => {
              const listing = find(db, "store_price", option.value);
              const item = find(db, "store_product", listing.store_product_id);
              const variant = find(db, "product_variation", item.variation_id);
              const product = find(db, "product", variant.product_id);
              return {
                ...option,
                currentPrice: priceLabel(listing.regular_price),
                firstPrice: listing.regular_price == null,
                firstRequiresReview:
                  listing.regular_price == null && product.sme_id != null,
                previous: past
                  .filter(
                    (request) =>
                      request.store_price_id === listing.store_price_id &&
                      ["Rejected", "Withdrawn"].includes(
                        String(request.status),
                      ),
                  )
                  .map((request) => ({
                    value: String(request.price_request_id),
                    label: `#${request.price_request_id} · ${peso(request.proposed_price)} · ${request.status}`,
                  })),
              };
            })}
          />
        </Panel>
      )}
      <Panel
        title={
          admin ? "Prices waiting for approval" : "Requests waiting for review"
        }
      >
        <Table
          compact={[
            "store_price_id",
            "previous_price",
            "proposed_price",
            "status",
            "review_reason",
          ]}
          rows={pending}
          columns={columns}
          empty={
            admin
              ? "No price requests need approval."
              : "You have no price requests waiting for review."
          }
        />
      </Panel>
      {admin && pending.length > 0 ? (
        <Panel
          title="Approve or reject a price"
          description="Check the product, pack size, comparison details, and Owner’s reason before deciding."
        >
          <AdminPriceForm
            requests={pending.map((request) => ({
              value: String(request.price_request_id),
              label: `#${request.price_request_id} · ${label(db, request.store_price_id)} · ${peso(request.proposed_price)}`,
              details: <PriceReviewDetails db={db} request={request} />,
            }))}
          />
        </Panel>
      ) : !admin && pending.length > 0 ? (
        <div className="two-columns">
          <Panel collapsible title="Explain a pending price">
            <ActionForm
              action="price_explanation"
              fields={[
                select(
                  "price_request_id",
                  "Pending request",
                  pending,
                  "price_request_id",
                  (r) =>
                    `#${r.price_request_id} · ${label(db, r.store_price_id)}`,
                ),
                area("owner_reason", "Your reason"),
              ]}
            />
          </Panel>
          <Panel collapsible title="Cancel a pending request">
            <ActionForm
              action="withdraw_price"
              fields={[
                select(
                  "price_request_id",
                  "Pending request",
                  pending,
                  "price_request_id",
                  (r) =>
                    `#${r.price_request_id} · ${label(db, r.store_price_id)}`,
                ),
                area("decision_reason", "Reason for cancelling"),
              ]}
              submit="Cancel request"
            />
          </Panel>
        </div>
      ) : null}
      <Panel collapsible title="Past price requests">
        <Table
          compact={[
            "store_price_id",
            "proposed_price",
            "status",
            "decision_reason",
          ]}
          rows={past}
          columns={
            admin
              ? [
                  ...columns,
                  {
                    key: "saved_evidence",
                    label: "Exact comparison",
                    render: (request) => (
                      <ExactEvidence db={db} request={request} />
                    ),
                  },
                ]
              : columns
          }
          empty="No completed or withdrawn price requests yet."
        />
      </Panel>
      <Panel collapsible title="Past prices">
        <Table
          rows={[...db.price_history].reverse()}
          columns={[
            { key: "price_history_id", label: "Price record" },
            {
              key: "store_price_id",
              label: "Product",
              render: (r) => label(db, r.store_price_id),
            },
            {
              key: "old_price",
              label: "Old price",
              render: (r) => peso(r.old_price),
            },
            {
              key: "new_price",
              label: "Approved price",
              render: (r) => peso(r.new_price),
            },
            { key: "price_request_id", label: "Request" },
            {
              key: "effective_at",
              label: "Date approved",
              render: (r) => date(r.effective_at),
            },
          ]}
        />
      </Panel>
    </>
  );
}
export function Rules({ db }: Props) {
  return (
    <>
      <Panel
        title="Automatic price approval"
        description="Set when a matching price can be approved automatically. Other prices still need your review."
      >
        <ActionForm
          action="rule"
          fields={[
            num(
              "allowance_percent",
              "Allowed increase above the middle price (%)",
              true,
              0,
              "0.01",
            ),
            num("minimum_stores", "Matching stores needed", true, 1),
            num("maximum_age_days", "Use prices from the last (days)", true, 1),
          ]}
          submit="Save price settings"
        />
        <p className="muted-text">
          The system uses the middle price from matching stores and adds your
          allowed percentage. This decides which prices need review; it does not
          prove a price is fair.
        </p>
      </Panel>
      <Panel collapsible title="Past settings">
        <Table
          rows={[...db.price_rule].reverse()}
          columns={[
            { key: "rule_id", label: "Rule" },
            { key: "allowance_percent", label: "Allowance %" },
            { key: "minimum_stores", label: "Minimum stores" },
            { key: "maximum_age_days", label: "Max age (days)" },
            {
              key: "effective_from",
              label: "Date approved",
              render: (r) => date(r.effective_from),
            },
            {
              key: "status",
              label: "Status",
              render: (r) => <Status value={r.status} />,
            },
          ]}
        />
      </Panel>
    </>
  );
}
