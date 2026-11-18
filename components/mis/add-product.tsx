"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { ActionForm } from "./form";
import type { Option } from "@/lib/mis/types";

export type CatalogChoice = Option & {
  packages: Option[];
};

function normalizeSearch(value: string) {
  return value.normalize("NFD").replace(/\p{M}/gu, "").trim().toLowerCase();
}

export function AddProduct({
  stores,
  choices,
  addedUnits,
}: {
  stores: Option[];
  choices: CatalogChoice[];
  addedUnits: Record<string, string[]>;
}) {
  const id = useId();
  const [selectedStore, setSelectedStore] = useState("");
  const [search, setSearch] = useState("");
  const [selectedProduct, setSelectedProduct] = useState("");
  const storeId = stores.length === 1 ? stores[0].value : selectedStore;
  const terms = normalizeSearch(search).split(/\s+/).filter(Boolean);
  const matches = choices.filter((choice) =>
    terms.every((term) => normalizeSearch(choice.label).includes(term)),
  );
  const product = matches.find((choice) => choice.value === selectedProduct);
  const alreadyAdded = addedUnits[storeId] ?? [];
  const packages = product?.packages.filter(
    (pack) => !alreadyAdded.includes(String(pack.value)),
  );

  return (
    <>
      {stores.length === 1 ? (
        <p className="muted-text">Adding to {stores[0].label}</p>
      ) : (
        <label className="standalone-field">
          <span id={`${id}-store`}>Store</span>
          <select
            aria-labelledby={`${id}-store`}
            value={storeId}
            onChange={(e) => setSelectedStore(e.target.value)}
          >
            <option value="">Choose a store</option>
            {stores.map(({ value, label }) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      )}
      <div className="fields">
        <label>
          <span>Search the catalog</span>
          <input
            type="search"
            value={search}
            placeholder="Product or brand name"
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <label>
          <span id={`${id}-product`}>Product</span>
          <select
            aria-labelledby={`${id}-product`}
            value={product?.value ?? ""}
            disabled={matches.length === 0}
            onChange={(e) => setSelectedProduct(e.target.value)}
          >
            <option value="">Choose a product</option>
            {matches.map(({ value, label }) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>
      {matches.length === 0 && (
        <p className="notice" role="status">
          No matching products. Try another search or request a catalog item
          below.
        </p>
      )}
      {storeId &&
        product &&
        (packages?.length ? (
          <ActionForm
            key={`${storeId}-${product.value}`}
            action="list_unit"
            hidden={{ sme_id: storeId }}
            fields={[
              {
                name: "unit_id",
                label: "Pack size to sell",
                options: packages,
              },
            ]}
            submit="Add to my products"
          />
        ) : (
          <p className="notice" role="status">
            All pack sizes for this product have been added.{" "}
            <Link href="/workspace/prices">Request a price</Link> or{" "}
            <Link href="/workspace/stock">record starting stock</Link>.
          </p>
        ))}
    </>
  );
}
