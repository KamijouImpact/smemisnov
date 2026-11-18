import { Row } from "@/lib/mis/types";
export function Status({ value }: { value: unknown }) {
  const s = String(value ?? "—");
  return (
    <span
      className={`status ${["Active", "Approved", "Available", "Open"].includes(s) ? "good" : ["Rejected", "Inactive", "Archived", "Cancelled", "Out of stock"].includes(s) ? "muted" : "pending"}`}
    >
      {s}
    </span>
  );
}
export function Table({
  rows,
  columns,
  empty = "No records yet.",
}: {
  rows: Row[];
  columns: {
    key: string;
    label: string;
    render?: (row: Row) => React.ReactNode;
  }[];
  empty?: string;
}) {
  return rows.length ? (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key}>{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {columns.map((c) => (
                <td key={c.key}>
                  {c.render ? c.render(r) : String(r[c.key] ?? "—")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  ) : (
    <div className="empty">
      <span>○</span>
      <p>{empty}</p>
    </div>
  );
}
export function Panel({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="panel">
      <div className="panel-heading">
        <h2>{title}</h2>
        {description && <p>{description}</p>}
      </div>
      {children}
    </section>
  );
}
