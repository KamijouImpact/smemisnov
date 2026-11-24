import { Row } from "@/lib/mis/types";
import { simpleText } from "@/lib/mis/words";
export function Status({ value }: { value: unknown }) {
  const s = String(value ?? "—");
  return (
    <span
      className={`status ${["Active", "Approved", "Available", "Open"].includes(s) ? "good" : ["Rejected", "Inactive", "Paused", "Archived", "Cancelled", "Out of stock"].includes(s) ? "muted" : "pending"}`}
    >
      {simpleText(s)}
    </span>
  );
}
type Column = {
  key: string;
  label: string;
  render?: (row: Row) => React.ReactNode;
};
export function Table({
  rows,
  columns,
  compact,
  empty = "No records yet.",
}: {
  rows: Row[];
  columns: Column[];
  compact?: string[];
  empty?: string;
}) {
  const visible = compact
    ? columns.filter((c) => compact.includes(c.key))
    : columns;
  const extra = compact ? columns.filter((c) => !compact.includes(c.key)) : [];
  const cell = (column: Column, row: Row) =>
    column.render
      ? column.render(row)
      : ["status", "review_reason", "transaction_type"].includes(column.key)
        ? simpleText(row[column.key])
        : String(row[column.key] ?? "—");
  return rows.length ? (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            {visible.map((c) => (
              <th key={c.key} scope="col">
                {c.label}
              </th>
            ))}
            {extra.length > 0 && <th scope="col">Details</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {visible.map((c) => (
                <td key={c.key}>{cell(c, r)}</td>
              ))}
              {extra.length > 0 && (
                <td>
                  <details className="row-details">
                    <summary>View details</summary>
                    <dl>
                      {extra.map((c) => (
                        <div key={c.key}>
                          <dt>{c.label}</dt>
                          <dd>{cell(c, r)}</dd>
                        </div>
                      ))}
                    </dl>
                  </details>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  ) : (
    <div className="empty">
      <p>{empty}</p>
    </div>
  );
}
export function Panel({
  title,
  description,
  children,
  collapsible = false,
  open = false,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  collapsible?: boolean;
  open?: boolean;
}) {
  const heading = (
    <div className="panel-heading">
      <h2>{title}</h2>
      {description && <p>{description}</p>}
    </div>
  );
  return (
    <section className={`panel${collapsible ? " expandable-panel" : ""}`}>
      {collapsible ? (
        <details open={open}>
          <summary>{heading}</summary>
          <div className="panel-body">{children}</div>
        </details>
      ) : (
        <>
          {heading}
          {children}
        </>
      )}
    </section>
  );
}
