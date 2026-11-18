import { ActionForm } from "./form";
import { Panel, Table, Status } from "./table";
import {
  Props,
  area,
  decisionFields,
  num,
  optionField,
  select,
  text,
} from "./fields";
import { date, find, label, peso } from "@/lib/mis/types";
export function Promotions({ db, admin }: Props) {
  return (
    <>
      <Panel
        title="Promotion events"
        description="The Administrator creates events. Each Owner chooses whether to join and submits a discount for approval. Regular prices are kept separately."
      >
        <Table
          rows={db.promotion}
          columns={[
            { key: "promotion_name", label: "Event" },
            { key: "description", label: "Details" },
            {
              key: "starts_at",
              label: "Starts",
              render: (r) => date(r.starts_at),
            },
            { key: "ends_at", label: "Ends", render: (r) => date(r.ends_at) },
            {
              key: "status",
              label: "Status",
              render: (r) => <Status value={r.status} />,
            },
          ]}
        />
      </Panel>
      {admin ? (
        <div className="two-columns">
          <Panel title="Create an event">
            <ActionForm
              action="promotion"
              fields={[
                text("promotion_name", "Event name"),
                area("description", "Event details", false),
                {
                  name: "starts_at",
                  label: "Starts (Philippine time)",
                  type: "datetime-local",
                },
                {
                  name: "ends_at",
                  label: "Ends (Philippine time)",
                  type: "datetime-local",
                },
              ]}
              submit="Create event"
            />
          </Panel>
          <Panel title="Cancel an event">
            <ActionForm
              action="cancel_promotion"
              fields={[
                select(
                  "promotion_id",
                  "Event",
                  db.promotion.filter((r) => r.status === "Open"),
                  "promotion_id",
                  (r) => String(r.promotion_name),
                ),
              ]}
              submit="Cancel event"
            />
          </Panel>
        </div>
      ) : (
        <Panel
          title="Join an event"
          description="A discount starts only after approval and during the event dates. Withdraw a rejected or outdated entry and submit a corrected one."
        >
          <ActionForm
            action="promotion_entry"
            fields={[
              select(
                "promotion_id",
                "Event",
                db.promotion.filter(
                  (r) =>
                    r.status === "Open" &&
                    new Date(String(r.ends_at)) > new Date(),
                ),
                "promotion_id",
                (r) => String(r.promotion_name),
              ),
              optionField(db),
              num(
                "promotion_price",
                "Proposed promotion price",
                true,
                0.01,
                "0.01",
              ),
              select(
                "previous_entry_id",
                "Earlier rejected or withdrawn entry",
                db.promotion_entry.filter((r) =>
                  ["Rejected", "Withdrawn"].includes(String(r.status)),
                ),
                "promotion_entry_id",
                (r) =>
                  `#${r.promotion_entry_id} · ${label(db, r.store_price_id)}`,
                false,
              ),
            ]}
            submit="Submit discount"
          />
        </Panel>
      )}
      <Panel title="Promotion entries">
        <Table
          rows={[...db.promotion_entry].reverse()}
          columns={[
            { key: "promotion_entry_id", label: "Entry" },
            {
              key: "promotion_id",
              label: "Event",
              render: (r) =>
                String(find(db, "promotion", r.promotion_id).promotion_name),
            },
            {
              key: "store_price_id",
              label: "Product",
              render: (r) => label(db, r.store_price_id),
            },
            {
              key: "promotion_price",
              label: "Discount price",
              render: (r) => peso(r.promotion_price),
            },
            { key: "regular_history_id", label: "Regular price history" },
            {
              key: "status",
              label: "Status",
              render: (r) => <Status value={r.status} />,
            },
            { key: "decision_reason", label: "Decision reason" },
          ]}
        />
      </Panel>
      {admin ? (
        <Panel title="Review a discount">
          <ActionForm
            action="review_promotion"
            fields={[
              select(
                "promotion_entry_id",
                "Pending entry",
                db.promotion_entry.filter((r) => r.status === "Pending"),
                "promotion_entry_id",
                (r) =>
                  `#${r.promotion_entry_id} · ${label(db, r.store_price_id)}`,
              ),
              ...decisionFields,
            ]}
          />
        </Panel>
      ) : (
        <Panel title="Withdraw a discount">
          <ActionForm
            action="withdraw_promotion"
            fields={[
              select(
                "promotion_entry_id",
                "Entry",
                db.promotion_entry.filter((r) =>
                  ["Pending", "Approved"].includes(String(r.status)),
                ),
                "promotion_entry_id",
                (r) =>
                  `#${r.promotion_entry_id} · ${label(db, r.store_price_id)}`,
              ),
              area("decision_reason", "Withdrawal reason"),
            ]}
            submit="Withdraw discount"
          />
        </Panel>
      )}
    </>
  );
}
