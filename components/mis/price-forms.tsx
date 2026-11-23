"use client";
import {
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { ActionForm } from "./form";
import { area, decisionFields, num } from "./fields";
import type { Option } from "@/lib/mis/types";

function PriceChoice({
  name,
  label,
  options,
  selected,
  onSelect,
}: {
  name: string;
  label: string;
  options: Option[];
  selected: string;
  onSelect: (value: string) => void;
}) {
  const id = useId();
  const selectRef = useRef<HTMLSelectElement>(null);
  useLayoutEffect(() => {
    // Keep the selection when ActionForm clears the fields after saving.
    for (const option of selectRef.current?.options ?? []) {
      option.defaultSelected = option.value === selected;
    }
  }, [options, selected]);
  return (
    <div className="fields">
      <label className="wide" htmlFor={id}>
        <span>{label}</span>
        <select
          ref={selectRef}
          id={id}
          name={name}
          required
          value={selected}
          onChange={(event) => onSelect(event.target.value)}
        >
          <option value="">Choose…</option>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

export function OwnerPriceForm({
  listings,
  requestedItem,
}: {
  listings: (Option & {
    currentPrice: string;
    firstPrice: boolean;
    firstRequiresReview: boolean;
    previous: Option[];
  })[];
  requestedItem?: string;
}) {
  const [selection, setSelection] = useState(requestedItem ?? "");
  const listing =
    listings.find((option) => String(option.value) === selection) ??
    (listings.length === 1 ? listings[0] : undefined);
  const previous = listing?.previous ?? [];
  return (
    <ActionForm
      action="submit_price"
      fields={[
        num("proposed_price", "New selling price (₱)", true, 0.01, "0.01"),
        area("owner_reason", "Reason for this price", false),
      ]}
      submit="Send price request"
    >
      <PriceChoice
        name="store_price_id"
        label="Product and pack size"
        options={listings}
        selected={String(listing?.value ?? "")}
        onSelect={setSelection}
      />
      {listing && (
        <p className="extra-fields muted-text" aria-live="polite">
          <strong>
            {listing.firstPrice
              ? listing.currentPrice
              : `Current approved price ${listing.currentPrice}`}
          </strong>
          .{" "}
          {listing.firstRequiresReview
            ? "An Administrator must approve the first price before customers can see it."
            : listing.firstPrice
              ? "Customers can see this pack once its first price is approved."
              : "Customers continue to see the current price while a request is waiting for review."}
        </p>
      )}
      {previous.length > 0 && (
        <details className="extra-fields">
          <summary>Correct an earlier request (optional)</summary>
          <div className="fields">
            <label className="wide">
              <span>Earlier request for this pack size</span>
              <select key={listing?.value} name="previous_request_id">
                <option value="">Choose…</option>
                {previous.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </details>
      )}
    </ActionForm>
  );
}

export function AdminPriceForm({
  requests,
}: {
  requests: (Option & { details: ReactNode })[];
}) {
  const [selection, setSelection] = useState("");
  const request =
    requests.find((option) => String(option.value) === selection) ??
    (requests.length === 1 ? requests[0] : undefined);
  return (
    <ActionForm
      action="review_price"
      fields={decisionFields}
      submit="Save decision"
    >
      <PriceChoice
        name="price_request_id"
        label="Pending request"
        options={requests}
        selected={String(request?.value ?? "")}
        onSelect={setSelection}
      />
      {request?.details}
    </ActionForm>
  );
}
