import Link from "next/link";
import { ActionForm } from "./form";
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
import { date, find, label, peso } from "@/lib/mis/types";
export function Products({ db, admin }: Props) {
  return (
    <>
      {!admin && !db.sme.some((s) => s.status === "Active") && (
        <p className="notice">
          Add a store and wait for approval before adding products.{" "}
          <Link href="/workspace/stores">Go to My stores →</Link>
        </p>
      )}
      <Panel
        collapsible={admin}
        title="Store products"
        description="Pieces and boxes of the same product share one stock count."
      >
        <Table
          rows={db.store_price}
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
              render: (r) => <Status value={r.status} />,
            },
          ]}
        />
      </Panel>
      {!admin && db.sme.some((s) => s.status === "Active") && (
        <div className="two-columns">
          <Panel title="Add a product">
            <ActionForm
              action="list_unit"
              fields={[storeField(db), unitField(db)]}
              submit="Add to store"
            />
          </Panel>
          <Panel
            collapsible
            title="Product not listed?"
            description="Tell us the brand, size, and pack quantity. The Administrator will check the details."
          >
            <ActionForm
              action="product_request"
              fields={[
                storeField(db),
                area("requested_details", "Product details"),
              ]}
              submit="Send product request"
            />
          </Panel>
        </div>
      )}
      {!admin && db.sme.some((s) => s.status === "Active") && (
        <Panel collapsible title="Hide or show a product">
          <ActionForm
            action="listing_status"
            fields={[
              select(
                "store_price_id",
                "Listing",
                db.store_price,
                "store_price_id",
                (r) => label(db, r.store_price_id),
              ),
              choice("status", "Status", ["Active", "Archived"]),
            ]}
          />
        </Panel>
      )}
      <Panel
        collapsible
        open={db.product_request.some(
          (r) => r.status === "Pending Product Review",
        )}
        title="Product requests"
      >
        <Table
          rows={db.product_request}
          columns={[
            { key: "product_request_id", label: "Request" },
            {
              key: "sme_id",
              label: "Store",
              render: (r) => String(find(db, "sme", r.sme_id).store_name),
            },
            { key: "requested_details", label: "Product details" },
            {
              key: "submitted_at",
              label: "Submitted",
              render: (r) => date(r.submitted_at),
            },
            {
              key: "status",
              label: "Status",
              render: (r) => <Status value={r.status} />,
            },
            { key: "decision_reason", label: "Decision reason" },
          ]}
        />
      </Panel>
      {admin && (
        <Panel
          title="Review a product request"
          description="Choose the matching product and pack size. If it is missing, add it below first."
        >
          <ActionForm
            action="review_product"
            fields={[
              select(
                "product_request_id",
                "Request",
                db.product_request.filter(
                  (r) => r.status === "Pending Product Review",
                ),
                "product_request_id",
                (r) => `#${r.product_request_id} · ${r.requested_details}`,
              ),
              ...decisionFields,
              unitField(db, false),
            ]}
          />
        </Panel>
      )}
    </>
  );
}
export function Catalog({ db }: Props) {
  return (
    <>
      <p className="notice">
        Open the section you need. Start with a category and brand, then add a
        product, its options, and pack sizes. A draft becomes active when it has
        an active option and pack size.
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
        description="Add details such as size, color, or flavor. Fill in only what applies."
      >
        <ActionForm
          action="variation"
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
              label: "Compare matching prices automatically?",
              options: [
                {
                  value: "false",
                  label: "No — Administrator checks each price",
                },
                {
                  value: "true",
                  label: "Yes — the same product can be matched exactly",
                },
              ],
              value: "false",
            },
          ]}
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
        description="For example: piece = 1, box of 24 = 24. Both use the same stock count."
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
            num(
              "stock_units",
              "Number of pieces or pairs in this pack",
              true,
              1,
            ),
            text("gtin", "Barcode (optional)", false),
          ]}
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
            choice("status", "Status", ["Active", "Archived"]),
          ]}
        />
      </Panel>
      <Products db={db} admin />
    </>
  );
}
