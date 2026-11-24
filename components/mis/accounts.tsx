import Link from "next/link";
import { StoreDirectory } from "./store-directory";
import { ActionForm } from "./form";
import { approvedChoices, RequestChoice } from "./catalog-choices";
import { Panel, Table, Status } from "./table";
import { Props, area, choice, select, text } from "./fields";
import { Account, date, Row } from "@/lib/mis/types";
const storeColumns = [
  { key: "store_name", label: "Store" },
  { key: "business_type", label: "Business type" },
  { key: "address", label: "Address" },
  {
    key: "status",
    label: "Status",
    render: (row: Row) => <Status value={row.status} />,
  },
  {
    key: "registered_at",
    label: "Registered",
    render: (row: Row) => date(row.registered_at),
  },
];

export function Stores({ db, admin }: Props) {
  if (admin) return <StoreDirectory stores={db.sme} />;
  const stores = db.sme;
  const businessTypes = approvedChoices(db.catalog_choice, "business_type");
  const storesWithOldTypes = stores.filter(
    (store) => !businessTypes.includes(String(store.business_type)),
  );
  return (
    <>
      {stores.length === 0 && (
        <Panel
          title="Add a store"
          description="Each Owner account can register one store. You can add products after approval."
        >
          <ActionForm
            action="store"
            fields={[
              text("store_name", "Store name"),
              choice("business_type", "Business type", businessTypes),
              area("address", "Store address"),
            ]}
            submit="Register store"
          />
        </Panel>
      )}
      {storesWithOldTypes.length > 0 && (
        <Panel
          title="Update business type"
          description="Choose an approved type for your existing store."
        >
          <ActionForm
            rpc="manage_catalog_choice"
            hidden={{ action: "update_business_type" }}
            fields={[
              select("sme_id", "Store", storesWithOldTypes, "sme_id", (store) =>
                String(store.store_name),
              ),
              choice("business_type", "Business type", businessTypes),
            ]}
            submit="Save business type"
          />
        </Panel>
      )}
      <RequestChoice
        requests={db.catalog_choice_request}
        kinds={["business_type"]}
      />
      <Panel
        title={stores.length > 1 ? "My registered stores" : "Store details"}
      >
        <Table
          rows={stores}
          columns={storeColumns}
          empty="You haven’t registered a store yet."
        />
      </Panel>
    </>
  );
}
export function Accounts({ db }: Props) {
  const managedAccounts = db.user_account.filter(
    (r) => r.role !== "Administrator",
  );
  return (
    <>
      <Panel title="Registered users">
        <Table
          rows={db.user_account}
          columns={[
            { key: "full_name", label: "Name" },
            { key: "login_name", label: "Email" },
            {
              key: "role",
              label: "Role",
              render: (r) => (r.role === "Owner" ? "Store Owner" : r.role),
            },
            {
              key: "status",
              label: "Status",
              render: (r) => <Status value={r.status} />,
            },
          ]}
        />
      </Panel>
      {managedAccounts.length > 0 && (
        <Panel
          collapsible
          title="Allow or pause access"
          description="Pausing an account also hides any listings published by that account."
        >
          <ActionForm
            action="account_status"
            fields={[
              select(
                "user_id",
                "Account",
                managedAccounts,
                "user_id",
                (r) => `${r.full_name} · ${r.login_name} · ${r.status}`,
              ),
              choice("status", "Account status", ["Active", "Inactive"]),
            ]}
            submit="Save account status"
          />
        </Panel>
      )}
    </>
  );
}
export function MyAccount({ user }: { user: Account }) {
  return (
    <Panel
      title="Profile details"
      description={`${user.login_name} · ${user.role === "Owner" ? "Store Owner" : user.role}`}
    >
      <ActionForm
        action="profile"
        fields={[{ ...text("full_name", "Full name"), value: user.full_name }]}
        submit="Save name"
      />
      <Link className="subtle-link" href="/auth/update-password">
        Change password
      </Link>
    </Panel>
  );
}
