import Link from "next/link";
import { ActionForm } from "./form";
import { Panel, Table, Status } from "./table";
import { Props, area, choice, select, text } from "./fields";
import { Account, date } from "@/lib/mis/types";
export function Stores({ db, admin }: Props) {
  const stores = admin
    ? [...db.sme].sort(
        (a, b) =>
          Number(b.status === "Pending") - Number(a.status === "Pending"),
      )
    : db.sme;
  return (
    <>
      {!admin ? (
        <Panel
          title="Add a store"
          description="You can add products after the Administrator approves your store."
        >
          <ActionForm
            action="store"
            fields={[
              text("store_name", "Store name"),
              text("business_type", "Business type"),
              area("address", "Store address"),
            ]}
            submit="Register store"
          />
        </Panel>
      ) : (
        stores.length > 0 && (
          <Panel title="Approve or pause a store">
            <ActionForm
              action="store_status"
              fields={[
                select(
                  "sme_id",
                  "Store",
                  stores,
                  "sme_id",
                  (s) => `${s.store_name} · ${s.status}`,
                ),
                {
                  name: "status",
                  label: "Decision",
                  options: [
                    { value: "Active", label: "Approve or reactivate" },
                    { value: "Inactive", label: "Pause access" },
                  ],
                },
              ]}
              submit="Save store status"
            />
          </Panel>
        )
      )}
      <Panel title={admin ? "Registered stores" : "My registered stores"}>
        <Table
          rows={stores}
          empty={
            admin
              ? "No stores have been registered yet."
              : "You haven’t registered a store yet."
          }
          columns={[
            { key: "store_name", label: "Store" },
            { key: "business_type", label: "Business type" },
            { key: "address", label: "Address" },
            {
              key: "status",
              label: "Status",
              render: (r) => <Status value={r.status} />,
            },
            {
              key: "registered_at",
              label: "Registered",
              render: (r) => date(r.registered_at),
            },
          ]}
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
