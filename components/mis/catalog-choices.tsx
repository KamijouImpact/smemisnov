import { ActionForm } from "./form";
import { area, choice, select, text } from "./fields";
import { Panel, Status, Table } from "./table";
import type { Row } from "@/lib/mis/types";

const choiceNames = {
  business_type: "Business type",
  product_category: "Product category",
  stock_unit: "Stock unit",
};

type ChoiceKind = keyof typeof choiceNames;

export function approvedChoices(rows: Row[], kind: ChoiceKind) {
  return rows
    .filter((row) => row.kind === kind)
    .map((row) => String(row.label))
    .sort((a, b) => a.localeCompare(b));
}

function choiceName(kind: unknown) {
  return choiceNames[kind as ChoiceKind] || String(kind);
}

export function RequestChoice({
  requests,
  kinds,
}: {
  requests: Row[];
  kinds: ChoiceKind[];
}) {
  const ownRequests = requests.filter((row) =>
    kinds.some((kind) => kind === row.kind),
  );
  return (
    <Panel
      collapsible
      title={
        kinds.length === 1
          ? "Request a business type"
          : "Request a category or stock unit"
      }
    >
      <ActionForm
        rpc="manage_catalog_choice"
        hidden={{
          action: "request",
          ...(kinds.length === 1 ? { kind: kinds[0] } : {}),
        }}
        fields={[
          ...(kinds.length > 1
            ? [
                {
                  name: "kind",
                  label: "Option type",
                  options: kinds.map((value) => ({
                    value,
                    label: choiceNames[value],
                  })),
                },
              ]
            : []),
          text("label", "Requested option"),
        ]}
        submit="Send request"
      />
      {ownRequests.length > 0 && <ChoiceHistory rows={ownRequests} />}
    </Panel>
  );
}

function ChoiceHistory({ rows }: { rows: Row[] }) {
  return (
    <Table
      rows={rows}
      empty="No option requests."
      columns={[
        {
          key: "kind",
          label: "Option type",
          render: (row) => choiceName(row.kind),
        },
        { key: "label", label: "Requested option" },
        {
          key: "status",
          label: "Status",
          render: (row) => <Status value={row.status} />,
        },
        { key: "decision_reason", label: "Decision reason" },
      ]}
    />
  );
}

export function ChoiceApprovals({ requests }: { requests: Row[] }) {
  const pending = requests.filter((row) => row.status === "Pending");
  const reviewed = requests.filter((row) => row.status !== "Pending");
  return (
    <>
      <Panel title="Waiting for review">
        <ChoiceHistory rows={pending} />
      </Panel>
      {pending.length > 0 && (
        <Panel
          title="Review a requested option"
          description="Approval adds the option to the list available to Owners. Give a reason when rejecting a request."
        >
          <ActionForm
            rpc="manage_catalog_choice"
            hidden={{ action: "review" }}
            fields={[
              select(
                "choice_request_id",
                "Request",
                pending,
                "choice_request_id",
                (row) => `${choiceName(row.kind)} · ${row.label}`,
              ),
              choice("decision", "Decision", ["Approved", "Rejected"]),
              area("decision_reason", "Decision reason", false),
            ]}
            submit="Save decision"
          />
        </Panel>
      )}
      {reviewed.length > 0 && (
        <Panel collapsible title="Reviewed options">
          <ChoiceHistory rows={reviewed} />
        </Panel>
      )}
    </>
  );
}
