import { ActionForm } from "./form";
import { Panel, Table, Status } from "./table";
import { Props, area, choice, select, text } from "./fields";
import { Account, date } from "@/lib/mis/types";
export function Stores({ db, admin }: Props) {
  return (
    <>
      <Panel
        title="Participating stores"
        description={
          admin
            ? "Review registrations and monitor every participating store."
            : "Register your store. The Administrator reviews it before listings and stock work can begin."
        }
      >
        <Table
          rows={db.sme}
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
      {!admin ? (
        <Panel title="Register a store">
          <ActionForm
            action="store"
            fields={[
              text("store_name", "Store name"),
              text("business_type", "Business type"),
              area("address", "Store address"),
            ]}
          />
        </Panel>
      ) : (
        <Panel title="Review a store">
          <ActionForm
            action="store_status"
            fields={[
              select(
                "sme_id",
                "Store",
                db.sme,
                "sme_id",
                (s) => `${s.store_name} · ${s.status}`,
              ),
              choice("status", "Decision", ["Active", "Inactive"]),
            ]}
            submit="Save store status"
          />
        </Panel>
      )}
    </>
  );
}
export function Accounts({ db }: Props) {
  return (
    <>
      <Panel title="System accounts">
        <Table
          rows={db.user_account}
          columns={[
            { key: "full_name", label: "Name" },
            { key: "login_name", label: "Email" },
            { key: "role", label: "Role" },
            {
              key: "status",
              label: "Status",
              render: (r) => <Status value={r.status} />,
            },
          ]}
        />
      </Panel>
      <Panel
        title="Manage account access"
        description="Inactive accounts cannot change business records or publish active listings."
      >
        <ActionForm
          action="account_status"
          fields={[
            select(
              "user_id",
              "Account",
              db.user_account.filter((r) => r.role !== "Administrator"),
              "user_id",
              (r) => `${r.full_name} · ${r.login_name}`,
            ),
            choice("status", "Status", ["Active", "Inactive"]),
          ]}
        />
      </Panel>
    </>
  );
}
export function MyAccount({ user }: { user: Account }) {
  return (
    <Panel title="My account" description={`${user.login_name} · ${user.role}`}>
      <ActionForm
        action="profile"
        fields={[{ ...text("full_name", "Full name"), value: user.full_name }]}
      />
      <a className="subtle-link" href="/auth/forgot-password">
        Request a password reset
      </a>
    </Panel>
  );
}
