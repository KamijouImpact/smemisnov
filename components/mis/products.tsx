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
      <Panel
        title="Store products"
        description="Each variation has one stock balance. Selling units such as a piece or a box use that same balance."
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
              label: "Approved regular price",
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
      {!admin && (
        <div className="two-columns">
          <Panel title="Add an approved product">
            <ActionForm
              action="list_unit"
              fields={[storeField(db), unitField(db)]}
              submit="Add to store"
            />
          </Panel>
          <Panel
            title="Other / Not Listed"
            description="Describe the brand, model, size, variant, and package quantity. The Administrator checks for an existing match or creates approved details."
          >
            <ActionForm
              action="product_request"
              fields={[
                storeField(db),
                area("requested_details", "Product details"),
              ]}
              submit="Request product details"
            />
          </Panel>
        </div>
      )}
      {!admin && (
        <Panel title="Change a listing’s status">
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
      <Panel title="Product requests">
        <Table
          rows={db.product_request}
          columns={[
            { key: "product_request_id", label: "Request" },
            {
              key: "sme_id",
              label: "Store",
              render: (r) => String(find(db, "sme", r.sme_id).store_name),
            },
            { key: "requested_details", label: "Requested details" },
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
          description="Create any missing shared details first, then select the approved unit. A rejected request can be corrected through a new product request."
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
        Create details in this order: Category and Brand → Product → Variation →
        Selling Unit. Product details and package quantities remain fixed so
        existing stock and price records keep their meaning. Archive mistaken
        records and add corrected details.
      </p>
      <div className="two-columns">
        <Panel title="1. Categories">
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
        <Panel title="2. Brands">
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
      <Panel title="3. Products">
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
        title="4. Product variations"
        description="Use the relevant fields only. Net quantity is stored in grams or millilitres. Allow automatic price references only when these details identify an exact comparable product."
      >
        <ActionForm
          action="variation"
          fields={[
            select(
              "product_id",
              "Product",
              db.product.filter((r) => r.status === "Active"),
              "product_id",
              (r) =>
                `${find(db, "brand", r.brand_id).brand_name || "Unbranded"} · ${r.product_name} · ${r.model_or_style || ""}`,
            ),
            text("variation_name", "Variation name"),
            text("size", "Size", false),
            text("color", "Color", false),
            text("flavor", "Flavor", false),
            text("capacity", "Capacity", false),
            num("net_quantity", "Net quantity", false, 0.001, "0.001"),
            choice("net_unit", "Net unit", ["g", "kg", "mL", "L"], false),
            choice("condition", "Condition", ["New", "Used"]),
            text("stock_unit", "Stock unit (piece, pair, sachet, etc.)"),
            area("other_details", "Other product details", false),
            {
              name: "allow_price_reference",
              label: "Allow exact price references?",
              options: [
                { value: "false", label: "No — manual review" },
                { value: "true", label: "Yes — exact match is reliable" },
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
            { key: "variation_name", label: "Variation" },
            { key: "size", label: "Size" },
            { key: "color", label: "Color" },
            {
              key: "net_quantity",
              label: "Net quantity",
              render: (r) =>
                r.net_quantity ? `${r.net_quantity} ${r.net_unit}` : "—",
            },
            { key: "stock_unit", label: "Stock unit" },
            {
              key: "allow_price_reference",
              label: "Reference allowed",
              render: (r) => (r.allow_price_reference ? "Yes" : "No"),
            },
            { key: "status", label: "Status" },
          ]}
        />
      </Panel>
      <Panel
        title="5. Selling units"
        description="For example: piece = 1 stock unit, box of 24 = 24 stock units. A box shares the same variation stock as its pieces."
      >
        <ActionForm
          action="unit"
          fields={[
            select(
              "variation_id",
              "Variation",
              db.product_variation.filter((r) => r.status === "Active"),
              "variation_id",
              (r) =>
                `${find(db, "product", r.product_id).product_name} · ${r.variation_name} · ${r.size || ""} ${r.color || ""}`,
            ),
            text("unit_name", "Selling unit name"),
            num("stock_units", "Stock units in this package", true, 1),
            text("gtin", "Barcode / GTIN", false),
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
            { key: "stock_units", label: "Stock units" },
            { key: "gtin", label: "GTIN" },
            { key: "status", label: "Status" },
          ]}
        />
      </Panel>
      <Panel title="Archive or restore shared details">
        <ActionForm
          action="catalog_status"
          fields={[
            {
              ...choice("table", "Record type", [
                "category",
                "brand",
                "product",
                "product_variation",
                "product_unit",
              ]),
              help: "Use the ID shown in the corresponding table above.",
            },
            num("id", "Record ID", true, 1),
            choice("status", "Status", ["Active", "Archived"]),
          ]}
        />
      </Panel>
      <Products db={db} admin />
    </>
  );
}
