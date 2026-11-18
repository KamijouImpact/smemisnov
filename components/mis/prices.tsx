import { ActionForm } from "./form";
import { Panel, Table, Status } from "./table";
import {
  Props,
  area,
  decisionFields,
  num,
  optionField,
  select,
} from "./fields";
import { date, find, label, peso } from "@/lib/mis/types";
export function Prices({ db, admin }: Props) {
  const pending = db.price_request.filter(
    (r) => r.status === "Pending Price Review",
  );
  return (
    <>
      {!admin && (
        <Panel
          title="Request a price"
          description="Your current price stays in use until a change is approved. A new product appears after its first price is approved."
        >
          <ActionForm
            action="submit_price"
            fields={[
              optionField(db),
              num("proposed_price", "New selling price", true, 0.01, "0.01"),
              area("owner_reason", "Why this price?", false),
              select(
                "previous_request_id",
                "Earlier request to correct (optional)",
                db.price_request.filter((r) =>
                  ["Rejected", "Withdrawn"].includes(String(r.status)),
                ),
                "price_request_id",
                (r) =>
                  `#${r.price_request_id} · ${label(db, r.store_price_id)}`,
                false,
              ),
            ]}
            submit="Send price request"
          />
        </Panel>
      )}
      <Panel
        title="Price requests"
        description="Check the status of each requested price."
      >
        <Table
          compact={[
            "store_price_id",
            "previous_price",
            "proposed_price",
            "status",
            "review_reason",
            "decision_reason",
          ]}
          rows={[...db.price_request].reverse()}
          columns={[
            { key: "price_request_id", label: "Request" },
            {
              key: "store_price_id",
              label: "Product",
              render: (r) => label(db, r.store_price_id),
            },
            {
              key: "previous_price",
              label: "Current price",
              render: (r) => peso(r.previous_price),
            },
            {
              key: "proposed_price",
              label: "New price",
              render: (r) => peso(r.proposed_price),
            },
            {
              key: "status",
              label: "Status",
              render: (r) => <Status value={r.status} />,
            },
            { key: "review_reason", label: "Why it needs review" },
            { key: "owner_reason", label: "Owner’s reason" },
            { key: "reference_count", label: "Matching stores" },
            {
              key: "reference_median",
              label: "Middle comparison price",
              render: (r) => peso(r.reference_median),
            },
            {
              key: "allowed_price",
              label: "Automatic approval limit",
              render: (r) => peso(r.allowed_price),
            },
            { key: "decision_source", label: "Decided by" },
            { key: "decision_reason", label: "Decision reason" },
            {
              key: "submitted_at",
              label: "Submitted",
              render: (r) => date(r.submitted_at),
            },
          ]}
        />
      </Panel>
      {admin ? (
        <Panel
          title="Approve or reject a price"
          description="Check the product, pack size, comparison details, and Owner’s reason before deciding."
        >
          <ActionForm
            action="review_price"
            fields={[
              select(
                "price_request_id",
                "Pending request",
                pending,
                "price_request_id",
                (r) =>
                  `#${r.price_request_id} · ${label(db, r.store_price_id)} · ${peso(r.proposed_price)}`,
              ),
              ...decisionFields,
            ]}
          />
        </Panel>
      ) : pending.length > 0 ? (
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
      {admin && (
        <Panel
          collapsible
          title="Prices used for comparison"
          description="These prices were saved when each request was checked."
        >
          <Table
            rows={db.price_reference}
            columns={[
              { key: "price_request_id", label: "Request" },
              {
                key: "reference_sme_id",
                label: "Other store",
                render: (r) =>
                  String(find(db, "sme", r.reference_sme_id).store_name),
              },
              { key: "price_history_id", label: "Price record" },
              {
                key: "source_price",
                label: "Compared price",
                render: (r) =>
                  peso(find(db, "price_history", r.price_history_id).new_price),
              },
              {
                key: "source_date",
                label: "Date approved",
                render: (r) =>
                  date(
                    find(db, "price_history", r.price_history_id).effective_at,
                  ),
              },
            ]}
          />
        </Panel>
      )}
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
