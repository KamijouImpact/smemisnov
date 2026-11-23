"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { ActionForm } from "./form";
import { area } from "./fields";
import type { Option } from "@/lib/mis/types";

type RequestChoice = Option & { storeId: string };
type PackChoice = Option & { storeId: string | null };

export function ProductRequestReview({
  requests,
  packs,
}: {
  requests: RequestChoice[];
  packs: PackChoice[];
}) {
  const id = useId();
  const [selected, setSelected] = useState(String(requests[0]?.value ?? ""));
  const [decision, setDecision] = useState("");
  const [search, setSearch] = useState("");
  const request =
    requests.find(({ value }) => String(value) === selected) ?? requests[0];
  const available = packs.filter(
    ({ storeId }) => !storeId || storeId === request?.storeId,
  );
  const matching = available.filter(({ label }) =>
    label.toLowerCase().includes(search.trim().toLowerCase()),
  );
  const approve = decision === "Approved";

  if (!request) return null;
  return (
    <>
      <div className="fields">
        <label>
          <span id={`${id}-request`}>Request</span>
          <select
            aria-labelledby={`${id}-request`}
            value={request.value}
            onChange={(event) => {
              setSelected(event.target.value);
              setDecision("");
              setSearch("");
            }}
          >
            {requests.map(({ value, label }) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span id={`${id}-decision`}>Decision</span>
          <select
            aria-labelledby={`${id}-decision`}
            value={decision}
            onChange={(event) => setDecision(event.target.value)}
          >
            <option value="">Choose a decision</option>
            <option value="Approved" disabled={!available.length}>
              Approve with a matching pack
            </option>
            <option value="Rejected">Reject with a reason</option>
          </select>
        </label>
      </div>
      {!available.length && (
        <p className="notice">
          No eligible pack sizes are available for this request.{" "}
          <Link href="/workspace/catalog">
            Add the exact product and pack size
          </Link>{" "}
          before approving, or reject the request with a reason.
        </p>
      )}
      {approve && (
        <label className="standalone-field">
          <span>Find a matching pack</span>
          <input
            type="search"
            placeholder="Product, brand, or pack size"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
      )}
      {approve && !matching.length && available.length > 0 && (
        <p className="notice" role="status">
          No pack sizes match your search.
        </p>
      )}
      {decision && (!approve || matching.length > 0) && (
        <ActionForm
          key={`${request.value}-${decision}`}
          action="review_product"
          hidden={{ product_request_id: request.value, decision }}
          fields={[
            ...(approve
              ? [
                  {
                    name: "unit_id",
                    label: "Exact matching pack size",
                    value: "",
                    options: matching,
                  },
                ]
              : []),
            area("decision_reason", "Decision reason"),
          ]}
          submit={approve ? "Approve request" : "Reject request"}
        />
      )}
    </>
  );
}
