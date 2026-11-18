import type { ComponentProps } from "react";
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
  const openEvents = db.promotion.filter((event) => event.status === "Open");
  const currentEvents = openEvents.filter(
    (event) => new Date(String(event.ends_at)) > new Date(),
  );
  const currentEventIds = new Set(
    currentEvents.map((event) => event.promotion_id),
  );
  const pastEvents = db.promotion.filter(
    (event) => !currentEventIds.has(event.promotion_id),
  );
  const entries = [...db.promotion_entry].reverse();
  const pendingDiscounts = entries.filter(
    (entry) => entry.status === "Pending",
  );
  const withdrawableDiscounts = entries.filter(
    (entry) => entry.status === "Pending" || entry.status === "Approved",
  );
  const currentDiscounts = withdrawableDiscounts.filter((entry) =>
    currentEventIds.has(entry.promotion_id),
  );
  const primaryDiscounts = admin ? pendingDiscounts : currentDiscounts;
  const primaryDiscountIds = new Set(
    primaryDiscounts.map((entry) => entry.promotion_entry_id),
  );
  const pastDiscounts = entries.filter(
    (entry) => !primaryDiscountIds.has(entry.promotion_entry_id),
  );
  const eventColumns: ComponentProps<typeof Table>["columns"] = [
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
  ];
  const discountColumns: ComponentProps<typeof Table>["columns"] = [
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
    { key: "regular_history_id", label: "Regular price record" },
    {
      key: "status",
      label: "Status",
      render: (r) => <Status value={r.status} />,
    },
    { key: "decision_reason", label: "Decision reason" },
  ];
  return (
    <>
      <Panel
        title={
          admin ? "Current and upcoming promotions" : "Promotions you can join"
        }
      >
        <Table
          rows={currentEvents}
          columns={eventColumns}
          empty="No current or upcoming promotions."
        />
      </Panel>
      {admin ? (
        <div className="two-columns">
          <Panel title="Create a promotion">
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
          {openEvents.length > 0 && (
            <Panel collapsible title="Cancel a promotion">
              <ActionForm
                action="cancel_promotion"
                fields={[
                  select(
                    "promotion_id",
                    "Event",
                    openEvents,
                    "promotion_id",
                    (r) => String(r.promotion_name),
                  ),
                ]}
                submit="Cancel event"
              />
            </Panel>
          )}
        </div>
      ) : currentEvents.length > 0 ? (
        <Panel
          title="Offer a discount"
          description="Approved discounts apply during the event. You can submit a correction for a rejected or withdrawn request."
        >
          <ActionForm
            action="promotion_entry"
            fields={[
              select(
                "promotion_id",
                "Event",
                currentEvents,
                "promotion_id",
                (r) => String(r.promotion_name),
              ),
              optionField(db),
              num("promotion_price", "Discount price", true, 0.01, "0.01"),
              select(
                "previous_entry_id",
                "Earlier discount request to correct (optional)",
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
      ) : null}
      <Panel
        title={
          admin ? "Discounts waiting for approval" : "My discount requests"
        }
      >
        <Table
          rows={primaryDiscounts}
          columns={discountColumns}
          empty={
            admin
              ? "No discounts need approval."
              : "You have no pending or approved discounts for open promotions."
          }
        />
      </Panel>
      {admin && pendingDiscounts.length > 0 ? (
        <Panel title="Approve or reject a discount">
          <ActionForm
            action="review_promotion"
            fields={[
              select(
                "promotion_entry_id",
                "Pending entry",
                pendingDiscounts,
                "promotion_entry_id",
                (r) =>
                  `#${r.promotion_entry_id} · ${label(db, r.store_price_id)}`,
              ),
              ...decisionFields,
            ]}
          />
        </Panel>
      ) : !admin && withdrawableDiscounts.length > 0 ? (
        <Panel collapsible title="Cancel a discount">
          <ActionForm
            action="withdraw_promotion"
            fields={[
              select(
                "promotion_entry_id",
                "Entry",
                withdrawableDiscounts,
                "promotion_entry_id",
                (r) =>
                  `#${r.promotion_entry_id} · ${label(db, r.store_price_id)}`,
              ),
              area("decision_reason", "Withdrawal reason"),
            ]}
            submit="Cancel discount"
          />
        </Panel>
      ) : null}
      <Panel
        collapsible
        title={admin ? "Reviewed discount requests" : "Past discount requests"}
      >
        <Table
          rows={pastDiscounts}
          columns={discountColumns}
          empty="No past discount requests."
        />
      </Panel>
      <Panel collapsible title="Past and cancelled promotions">
        <Table
          rows={pastEvents}
          columns={eventColumns}
          empty="No past or cancelled promotions."
        />
      </Panel>
    </>
  );
}
