import Link from "next/link";
import type { ComponentProps } from "react";
import { ActionForm } from "./form";
import { AddProduct, type CatalogChoice } from "./add-product";
import { Panel, Table, Status } from "./table";
import {
  Props,
  area,
  choice,
  decisionFields,
  num,
  select,
  storeField,
  text,
  unitField,
} from "./fields";
import { type Database, date, find, label, peso } from "@/lib/mis/types";
function activeCatalogUnits(db: Database) {
  return db.product_unit.flatMap((unit) => {
    if (unit.status !== "Active") return [];
    const variation = find(db, "product_variation", unit.variation_id);
    const product = find(db, "product", variation.product_id);
    const brand = find(db, "brand", product.brand_id);
    const category = find(db, "category", product.category_id);
    return variation.status === "Active" &&
      product.status === "Active" &&
      category.status === "Active" &&
      (!product.brand_id || brand.status === "Active")
      ? [{ unit, variation, product, brand }]
      : [];
  });
}

export function Products({ db, admin }: Props) {
  const activeStores = db.sme.filter((s) => s.status === "Active");
  const stores = activeStores.map((store) => ({
    value: String(store.sme_id),
    label: String(store.store_name),
  }));
  const availableUnits = activeCatalogUnits(db);
  const choices = new Map<string, CatalogChoice>();
  const addedUnits: Record<string, string[]> = {};
  if (!admin && activeStores.length) {
    for (const { unit, variation, product, brand } of availableUnits) {
      const value = String(variation.variation_id);
      let choice = choices.get(value);
      if (!choice) {
        choice = {
          value,
          label: [
            brand.brand_name,
            product.product_name,
            product.model_or_style,
            variation.variation_name === "Standard"
              ? null
              : variation.variation_name,
            variation.size,
            variation.color,
            variation.flavor,
            variation.capacity,
            variation.net_quantity
              ? `${variation.net_quantity} ${variation.net_unit}`
              : null,
            variation.condition === "Used" ? "Used" : null,
            variation.other_details,
          ]
            .filter(Boolean)
            .join(" · "),
          packages: [],
        };
        choices.set(value, choice);
      }
      choice.packages.push({
        value: String(unit.unit_id),
        label: `${unit.unit_name} (${unit.stock_units} ${variation.stock_unit})`,
      });
    }
    for (const listing of db.store_price) {
      if (listing.status !== "Active") continue;
      const store = find(db, "store_product", listing.store_product_id);
      const storeId = String(store.sme_id);
      (addedUnits[storeId] ??= []).push(String(listing.unit_id));
    }
  }
  const catalogChoices = [...choices.values()].sort((a, b) =>
    a.label.localeCompare(b.label),
  );
  const editableListings = db.store_price.filter((r) => {
    const store = find(db, "store_product", r.store_product_id).sme_id;
    return activeStores.some((s) => s.sme_id === store);
  });
  return (
    <>
      {!admin && activeStores.length === 0 && (
        <p className="notice">
          {db.sme.length
            ? "An active store is required to add products."
            : "Register a store and wait for approval before adding products."}{" "}
          <Link href="/workspace/stores">Open My store</Link>
        </p>
      )}
      {!admin && activeStores.length > 0 && (
        <>
          <Panel
            title="Add a product"
            description="Find the product and choose the pack size you sell. You can request a price and record stock after adding it."
          >
            <AddProduct
              stores={stores}
              choices={catalogChoices}
              addedUnits={addedUnits}
            />
          </Panel>
          <Panel
            collapsible
            open={catalogChoices.length === 0}
            title="Product not listed?"
            description="Include the brand, size, and quantity per pack so the Administrator can match it."
          >
            <ActionForm
              action="product_request"
              hidden={
                stores.length === 1 ? { sme_id: stores[0].value } : undefined
              }
              fields={[
                ...(stores.length > 1 ? [storeField(db)] : []),
                area("requested_details", "Product details"),
              ]}
              submit="Send product request"
            />
          </Panel>
        </>
      )}
      <Panel collapsible={admin} title="Store products">
        {!admin &&
          editableListings.some(
            (listing) =>
              listing.status === "Active" && listing.regular_price === null,
          ) && (
            <p className="notice">
              Products need an approved price before customers can see them.{" "}
              <Link href="/workspace/prices">Request a price</Link> or{" "}
              <Link href="/workspace/stock">record starting stock</Link>.
            </p>
          )}
        <Table
          rows={db.store_price}
          empty="No products have been added to a store yet."
          columns={[
            {
              key: "store_price_id",
              label: "Product and package",
              render: (r) => label(db, r.store_price_id),
            },
            {
              key: "regular_price",
              label: "Approved price",
              render: (r) => peso(r.regular_price),
            },
            {
              key: "status",
              label: "Status",
              render: (r) => (
                <Status
                  value={
                    r.status === "Active" && r.regular_price === null
                      ? "Needs approved price"
                      : r.status
                  }
                />
              ),
            },
          ]}
        />
      </Panel>
      {!admin && editableListings.length > 0 && (
        <Panel collapsible title="Hide or show a product">
          <ActionForm
            action="listing_status"
            fields={[
              select(
                "store_price_id",
                "Listing",
                editableListings,
                "store_price_id",
                (r) => label(db, r.store_price_id),
              ),
              {
                name: "status",
                label: "Visibility",
                options: [
                  { value: "Active", label: "Show listing" },
                  { value: "Archived", label: "Hide listing" },
                ],
              },
            ]}
            submit="Save listing visibility"
          />
        </Panel>
      )}
      {!admin && <ProductRequests db={db} admin={false} />}
    </>
  );
}
export function ProductRequests({ db, admin }: Props) {
  const pendingRequests = db.product_request.filter(
    (request) => request.status === "Pending Product Review",
  );
  const reviewedRequests = db.product_request.filter(
    (request) => request.status !== "Pending Product Review",
  );
  const catalogUnits = admin
    ? activeCatalogUnits(db).map(({ unit }) => unit)
    : [];
  const columns: ComponentProps<typeof Table>["columns"] = [
    { key: "product_request_id", label: "Request" },
    {
      key: "sme_id",
      label: "Store",
      render: (row) => String(find(db, "sme", row.sme_id).store_name),
    },
    { key: "requested_details", label: "Product details" },
    {
      key: "submitted_at",
      label: "Submitted",
      render: (row) => date(row.submitted_at),
    },
    {
      key: "status",
      label: "Status",
      render: (row) => <Status value={row.status} />,
    },
    { key: "decision_reason", label: "Decision reason" },
  ];

  return (
    <>
      <Panel title={admin ? "Waiting for review" : "My product requests"}>
        <Table
          rows={admin ? pendingRequests : db.product_request}
          empty={
            admin
              ? "No product requests are waiting for review."
              : "You haven’t sent a product request."
          }
          columns={columns}
        />
      </Panel>
      {admin && pendingRequests.length > 0 && (
        <Panel
          title="Review a product request"
          description="Choose the matching pack size to approve a request, or give a reason for rejecting it."
        >
          <p className="muted-text">
            If the pack size is missing,{" "}
            <Link href="/workspace/catalog">add it to the catalog</Link> first.
          </p>
          <ActionForm
            action="review_product"
            fields={[
              select(
                "product_request_id",
                "Request",
                pendingRequests,
                "product_request_id",
                (r) => `#${r.product_request_id} · ${r.requested_details}`,
              ),
              ...decisionFields,
              unitField({ ...db, product_unit: catalogUnits }, false),
            ]}
            submit="Save decision"
          />
        </Panel>
      )}
      {admin && reviewedRequests.length > 0 && (
        <Panel collapsible title="Reviewed requests">
          <Table rows={reviewedRequests} columns={columns} />
        </Panel>
      )}
    </>
  );
}

export function Catalog({ db }: Props) {
  return (
    <>
      <p className="notice">
        <Link href="/workspace/product-requests">Review product requests</Link>
      </p>
      <p className="notice">
        Add a category, then a product name, option, and pack size. A product
        stays in draft until it has an active option and pack size.
      </p>
      <div className="two-columns">
        <Panel collapsible open={db.category.length === 0} title="Categories">
          <ActionForm
            action="category"
            fields={[
              text("category_name", "Category name"),
              choice("product_type", "Product type", [
                "Packaged Product",
                "Clothing",
                "Gadget",
                "General Retail",
              ]),
            ]}
          />
          <Table
            rows={db.category}
            columns={[
              { key: "category_id", label: "ID" },
              { key: "category_name", label: "Category" },
              { key: "product_type", label: "Type" },
              { key: "status", label: "Status" },
            ]}
          />
        </Panel>
        <Panel collapsible title="Brands">
          <ActionForm
            action="brand"
            fields={[text("brand_name", "Brand name")]}
          />
          <Table
            rows={db.brand}
            columns={[
              { key: "brand_id", label: "ID" },
              { key: "brand_name", label: "Brand" },
              { key: "status", label: "Status" },
            ]}
          />
        </Panel>
      </div>
      <Panel collapsible title="Product names">
        <ActionForm
          action="product"
          fields={[
            select(
              "category_id",
              "Category",
              db.category.filter((r) => r.status === "Active"),
              "category_id",
              (r) => String(r.category_name),
            ),
            select(
              "brand_id",
              "Brand",
              db.brand.filter((r) => r.status === "Active"),
              "brand_id",
              (r) => String(r.brand_name),
              false,
            ),
            text("product_name", "Product name"),
            text("model_or_style", "Model or style", false),
          ]}
        />
        <Table
          rows={db.product}
          columns={[
            { key: "product_id", label: "ID" },
            { key: "product_name", label: "Product" },
            {
              key: "brand_id",
              label: "Brand",
              render: (r) =>
                String(find(db, "brand", r.brand_id).brand_name || "Unbranded"),
            },
            { key: "model_or_style", label: "Model / style" },
            { key: "status", label: "Status" },
          ]}
        />
      </Panel>
      <Panel
        collapsible
        title="Product options"
        description="Create a separate option for each variation that needs its own stock count."
      >
        <ActionForm
          action="variation"
          extraFields={[
            "size",
            "color",
            "flavor",
            "capacity",
            "net_quantity",
            "net_unit",
            "other_details",
          ]}
          fields={[
            select(
              "product_id",
              "Product",
              db.product.filter((r) => r.status !== "Archived"),
              "product_id",
              (r) =>
                `${find(db, "brand", r.brand_id).brand_name || "Unbranded"} · ${r.product_name} · ${r.model_or_style || ""}`,
            ),
            text("variation_name", "Option name (blank for Standard)", false),
            text("size", "Size", false),
            text("color", "Color", false),
            text("flavor", "Flavor", false),
            text("capacity", "Capacity", false),
            num("net_quantity", "Weight or volume", false, 0.001, "0.001"),
            choice(
              "net_unit",
              "Weight / volume unit",
              ["g", "kg", "mL", "L"],
              false,
            ),
            {
              ...choice("condition", "Condition", ["New", "Used"]),
              value: "New",
            },
            text("stock_unit", "Count stock in (piece, pair, etc.)"),
            area("other_details", "Other details", false),
            {
              name: "allow_price_reference",
              label: "Allow exact price comparisons?",
              options: [
                {
                  value: "false",
                  label: "No, review prices manually",
                },
                {
                  value: "true",
                  label: "Yes, exact matches can be compared",
                },
              ],
              value: "false",
            },
          ]}
          submit="Save product option"
        />
        <Table
          rows={db.product_variation}
          columns={[
            { key: "variation_id", label: "ID" },
            {
              key: "product_id",
              label: "Product",
              render: (r) =>
                String(find(db, "product", r.product_id).product_name),
            },
            { key: "variation_name", label: "Product option" },
            { key: "size", label: "Size" },
            { key: "color", label: "Color" },
            {
              key: "net_quantity",
              label: "Weight or volume",
              render: (r) =>
                r.net_quantity ? `${r.net_quantity} ${r.net_unit}` : "—",
            },
            { key: "stock_unit", label: "Stock unit" },
            {
              key: "allow_price_reference",
              label: "Automatic price check",
              render: (r) => (r.allow_price_reference ? "Yes" : "No"),
            },
            { key: "status", label: "Status" },
          ]}
        />
      </Panel>
      <Panel
        collapsible
        title="Pack sizes"
        description="Enter how many stock units each pack contains. For example, a box of 24 contains 24 units."
      >
        <ActionForm
          action="unit"
          fields={[
            select(
              "variation_id",
              "Product option",
              db.product_variation.filter((r) => r.status === "Active"),
              "variation_id",
              (r) =>
                `${find(db, "product", r.product_id).product_name} · ${r.variation_name} · ${r.size || ""} ${r.color || ""}`,
            ),
            text("unit_name", "Sold as (piece, box, etc.)"),
            num("stock_units", "Stock units per pack", true, 1),
            text("gtin", "Barcode (optional)", false),
          ]}
          submit="Save pack size"
        />
        <Table
          rows={db.product_unit}
          columns={[
            { key: "unit_id", label: "ID" },
            {
              key: "variation_id",
              label: "Product",
              render: (r) => label(db, r.unit_id, "unit"),
            },
            { key: "stock_units", label: "Quantity in pack" },
            { key: "gtin", label: "Barcode" },
            { key: "status", label: "Status" },
          ]}
        />
      </Panel>
      <Panel collapsible title="Hide or restore product details">
        <ActionForm
          action="catalog_status"
          fields={[
            {
              name: "table",
              label: "Type of detail",
              options: [
                { value: "category", label: "Category" },
                { value: "brand", label: "Brand" },
                { value: "product", label: "Product name" },
                { value: "product_variation", label: "Product option" },
                { value: "product_unit", label: "Pack size" },
              ],
              help: "Choose the record type, then use its ID from the table above.",
            },
            num("id", "Record number", true, 1),
            {
              name: "status",
              label: "Catalog visibility",
              options: [
                { value: "Active", label: "Restore to catalog" },
                { value: "Archived", label: "Hide from catalog" },
              ],
            },
          ]}
          submit="Save visibility"
        />
      </Panel>
      <Products db={db} admin />
    </>
  );
}
