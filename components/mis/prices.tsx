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
          title="Request a selling price"
          description="Your approved price stays active while a change is reviewed. A first price appears publicly after approval. If rejected, submit a corrected request and link the earlier request."
        >
          <ActionForm
            action="submit_price"
            fields={[
              optionField(db),
              num(
                "proposed_price",
                "Proposed selling price",
                true,
                0.01,
                "0.01",
              ),
              area("owner_reason", "Reason for the price", false),
              select(
                "previous_request_id",
                "Earlier rejected or withdrawn request",
                db.price_request.filter((r) =>
                  ["Rejected", "Withdrawn"].includes(String(r.status)),
                ),
                "price_request_id",
                (r) =>
                  `#${r.price_request_id} · ${label(db, r.store_price_id)}`,
                false,
              ),
            ]}
            submit="Submit price request"
          />
        </Panel>
      )}
      <Panel
        title="Price requests"
        description="Reference prices help identify changes that need review. A high markup alone does not prove overpricing."
      >
        <Table
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
              label: "Previous",
              render: (r) => peso(r.previous_price),
            },
            {
              key: "proposed_price",
              label: "Proposed",
              render: (r) => peso(r.proposed_price),
            },
            {
              key: "status",
              label: "Status",
              render: (r) => <Status value={r.status} />,
            },
            { key: "review_reason", label: "Review reason" },
            { key: "owner_reason", label: "Owner explanation" },
            { key: "reference_count", label: "Other stores" },
            {
              key: "reference_median",
              label: "Reference median",
              render: (r) => peso(r.reference_median),
            },
            {
              key: "allowed_price",
              label: "Rule cutoff",
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
          title="Review a price request"
          description="Check the exact package, retained references, purchase costs, price history, and Owner explanation. State a reason for either decision. Above Reference requests need an Owner explanation before approval."
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
      ) : (
        <div className="two-columns">
          <Panel title="Add an explanation">
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
                area("owner_reason", "Explanation"),
              ]}
            />
          </Panel>
          <Panel title="Withdraw a pending request">
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
                area("decision_reason", "Withdrawal reason"),
              ]}
              submit="Withdraw request"
            />
          </Panel>
        </div>
      )}
      {admin && (
        <Panel
          title="Retained reference prices"
          description="These are the exact price-history records used when the request was checked."
        >
          <Table
            rows={db.price_reference}
            columns={[
              { key: "price_request_id", label: "Request" },
              {
                key: "reference_sme_id",
                label: "Reference store",
                render: (r) =>
                  String(find(db, "sme", r.reference_sme_id).store_name),
              },
              { key: "price_history_id", label: "History record" },
              {
                key: "source_price",
                label: "Reference price",
                render: (r) =>
                  peso(find(db, "price_history", r.price_history_id).new_price),
              },
              {
                key: "source_date",
                label: "Effective date",
                render: (r) =>
                  date(
                    find(db, "price_history", r.price_history_id).effective_at,
                  ),
              },
            ]}
          />
        </Panel>
      )}
      <Panel title="Price history">
        <Table
          rows={[...db.price_history].reverse()}
          columns={[
            { key: "price_history_id", label: "History ID" },
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
              label: "Effective",
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
        title="Price approval rule"
        description="The Administrator sets the allowance above the reference median, the minimum number of other stores, and how recent their prices must be. No preset is activated. Without enough reliable references, requests wait for manual review."
      >
        <ActionForm
          action="rule"
          fields={[
            num(
              "allowance_percent",
              "Allowance above median (%)",
              true,
              0,
              "0.01",
            ),
            num("minimum_stores", "Minimum other stores", true, 1),
            num("maximum_age_days", "Maximum price age in days", true, 1),
          ]}
          submit="Activate new rule"
        />
        <p className="muted-text">
          Cutoff = reference median × (1 + allowance ÷ 100), rounded down to the
          cent. This is a review rule, not a legal fair-price limit.
        </p>
      </Panel>
      <Panel title="Rule history">
        <Table
          rows={[...db.price_rule].reverse()}
          columns={[
            { key: "rule_id", label: "Rule" },
            { key: "allowance_percent", label: "Allowance %" },
            { key: "minimum_stores", label: "Minimum stores" },
            { key: "maximum_age_days", label: "Max age (days)" },
            {
              key: "effective_from",
              label: "Effective",
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
