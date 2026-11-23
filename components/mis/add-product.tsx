"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { ActionForm } from "./form";
import { choice, num, text } from "./fields";
import type { Option } from "@/lib/mis/types";

export type CatalogChoice = Option & {
  packages: Option[];
  storeIds: string[];
};

const packCounts = ["1", "2", "3", "4", "6", "10", "12", "24"];

export type StoreProductSuggestions = {
  names: string[];
  brands: string[];
  variants: string[];
};

export function AddProduct({
  stores,
  suggestions,
  categories,
  stockUnits,
}: {
  stores: Option[];
  suggestions: Record<string, StoreProductSuggestions>;
  categories: string[];
  stockUnits: string[];
}) {
  const [store, setStore] = useState("");
  const storeId = stores.length === 1 ? stores[0].value : store;
  const storeProducts = suggestions[storeId];

  return (
    <>
      {stores.length > 1 && (
        <label className="standalone-field">
          <span>Store</span>
          <select value={storeId} onChange={(e) => setStore(e.target.value)}>
            <option value="">Choose a store</option>
            {stores.map(({ value, label }) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      )}
      {storeId && (
        <ActionForm
          key={storeId}
          rpc="create_store_product"
          hidden={{ sme_id: storeId }}
          extraFields={[
            "stock_unit",
            "pack_count",
            "pack_name",
            "package_size_value",
            "package_size_unit",
            "barcode",
          ]}
          fields={[
            {
              ...text("product_name", "Product name"),
              suggestions: storeProducts?.names,
            },
            choice("category_name", "Product category", categories),
            {
              ...text("brand", "Brand", false),
              suggestions: storeProducts?.brands,
            },
            {
              ...text("variant", "Variant, flavor, or model", false),
              suggestions: storeProducts?.variants,
            },
            {
              ...choice("stock_unit", "Stock unit", stockUnits),
              value: "piece",
            },
            {
              ...num("pack_count", "Stock units per pack", false, 1),
              value: 1,
              suggestions: packCounts,
            },
            {
              ...text("pack_name", "Pack label", false),
              help: "Leave blank to use a label based on the unit and pack count.",
            },
            num(
              "package_size_value",
              "Weight or volume",
              false,
              0.001,
              "0.001",
            ),
            choice(
              "package_size_unit",
              "Weight or volume unit",
              ["g", "kg", "mL", "L"],
              false,
            ),
            text("barcode", "Barcode", false),
          ]}
          submit="Save product"
        />
      )}
    </>
  );
}

function normalizeSearch(value: string) {
  return value.normalize("NFD").replace(/\p{M}/gu, "").trim().toLowerCase();
}

export function AddLegacyPack({
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
  const matches = choices.filter(
    (choice) =>
      choice.storeIds.includes(String(storeId)) &&
      terms.every((term) => normalizeSearch(choice.label).includes(term)),
  );
  const product =
    matches.find((choice) => choice.value === selectedProduct) ??
    (matches.length === 1 ? matches[0] : undefined);
  const alreadyAdded = addedUnits[storeId] ?? [];
  const packages = product?.packages.filter(
    (pack) => !alreadyAdded.includes(String(pack.value)),
  );

  return (
    <>
      {stores.length > 1 && (
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
          <span>Search your existing products</span>
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
      {storeId && matches.length === 0 && (
        <p className="notice" role="status">
          No matching products with additional pack sizes.
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
