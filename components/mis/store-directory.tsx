"use client";

import { useRef, useState } from "react";
import { date, type Row } from "@/lib/mis/types";
import { ActionForm } from "./form";
import { Panel, Status } from "./table";

const groups = [
  { status: "Pending", label: "Pending approval" },
  { status: "Active", label: "Active" },
  { status: "Inactive", label: "Paused" },
] as const;

export function StoreDirectory({ stores }: { stores: Row[] }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("All");
  const [managedId, setManagedId] = useState<Row["sme_id"]>();
  const dialog = useRef<HTMLDialogElement>(null);
  const managed = stores.find((store) => store.sme_id === managedId);
  const search = query.trim().toLocaleLowerCase();
  const sections = groups.map((group) => ({
    ...group,
    stores: stores.filter(
      (store) =>
        store.status === group.status &&
        [store.store_name, store.business_type, store.address].some((value) =>
          String(value ?? "")
            .toLocaleLowerCase()
            .includes(search),
        ),
    ),
  }));
  const visible = sections.filter(
    (group) =>
      (filter === "All" || filter === group.status) && group.stores.length,
  );

  return (
    <Panel title="Store directory">
      <div className="store-toolbar">
        <label>
          Search stores
          <input
            type="search"
            placeholder="Name, business type or address"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <div
          className="store-filters"
          role="group"
          aria-label="Filter by status"
        >
          {[
            {
              status: "All",
              label: "All stores",
              stores: sections.flatMap((group) => group.stores),
            },
            ...sections,
          ].map((group) => (
            <button
              key={group.status}
              type="button"
              aria-pressed={filter === group.status}
              onClick={() => setFilter(group.status)}
            >
              {group.label} <span>{group.stores.length}</span>
            </button>
          ))}
        </div>
      </div>
      {visible.length === 0 && (
        <div className="empty">
          <p>
            {stores.length
              ? "No stores match your search or filter."
              : "No stores have registered yet."}
          </p>
          {stores.length > 0 && (
            <button
              type="button"
              className="button small"
              onClick={() => {
                setQuery("");
                setFilter("All");
              }}
            >
              Clear filters
            </button>
          )}
        </div>
      )}
      {visible.map((group) => (
        <section key={group.status} className="store-group">
          <h3>{group.label}</h3>
          <ul>
            {group.stores.map((store) => (
              <li key={String(store.sme_id)} className="store-directory-row">
                <div>
                  <strong>{String(store.store_name)}</strong>
                  <p>
                    {String(store.business_type)} · {String(store.address)}
                  </p>
                </div>
                <Status
                  value={store.status === "Inactive" ? "Paused" : store.status}
                />
                <button
                  type="button"
                  className="store-manage"
                  aria-label={`Manage ${store.store_name}`}
                  onClick={() => {
                    setManagedId(store.sme_id);
                    dialog.current?.showModal();
                  }}
                >
                  Manage
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
      <dialog
        ref={dialog}
        className="store-dialog"
        aria-labelledby="manage-store-title"
        onClose={() => setManagedId(undefined)}
      >
        <div className="store-dialog-header">
          <h3 id="manage-store-title">
            {managed ? String(managed.store_name) : "Manage store"}
          </h3>
          <button
            type="button"
            className="store-manage"
            onClick={() => dialog.current?.close()}
          >
            Close
          </button>
        </div>
        {managed && (
          <>
            <p>
              {String(managed.business_type)} · {String(managed.address)}
            </p>
            <p>Registered {date(managed.registered_at)}</p>
            <Status
              value={managed.status === "Inactive" ? "Paused" : managed.status}
            />
            <ActionForm
              key={String(managed.sme_id)}
              action="store_status"
              hidden={{ sme_id: String(managed.sme_id) }}
              fields={[
                {
                  name: "status",
                  label:
                    managed.status === "Pending" ? "Decision" : "Change access",
                  options: [
                    ...(managed.status !== "Active"
                      ? [
                          {
                            value: "Active",
                            label:
                              managed.status === "Pending"
                                ? "Approve store"
                                : "Reactivate store",
                          },
                        ]
                      : []),
                    ...(managed.status !== "Inactive"
                      ? [
                          {
                            value: "Inactive",
                            label:
                              managed.status === "Pending"
                                ? "Keep store inactive"
                                : "Pause store",
                          },
                        ]
                      : []),
                  ],
                },
              ]}
              submit="Save change"
            />
          </>
        )}
      </dialog>
    </Panel>
  );
}
