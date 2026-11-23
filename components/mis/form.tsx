"use client";
import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { simpleMessage } from "@/lib/mis/words";
import { Field } from "@/lib/mis/types";
export function ActionForm({
  action,
  rpc,
  fields = [],
  hidden = {},
  title,
  submit = "Save",
  children,
  extraFields = [],
}: (
  | { action: string; rpc?: never }
  | { action?: never; rpc: "create_store_product" }
) & {
  fields?: Field[];
  hidden?: Record<string, string | number>;
  title?: string;
  submit?: string;
  children?: React.ReactNode;
  extraFields?: string[];
}) {
  const id = useId();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setMessage("");
    const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form).entries());
    for (const field of fields) {
      if (field.type === "datetime-local" && values[field.name])
        values[field.name] = String(values[field.name]) + ":00+08:00";
    }
    try {
      const client = createClient();
      const a = { ...values, ...hidden };
      const { data, error: failure } = rpc
        ? await client.rpc(rpc, { a })
        : await client.rpc("mis_command", { action, a });
      if (failure) throw failure;
      setError(false);
      setMessage(simpleMessage(data?.message || "Saved."));
      form.reset();
      router.refresh();
    } catch (e) {
      setError(true);
      const raw =
        e instanceof Error
          ? e.message
          : (e as { message?: string })?.message ||
            "Could not save. Please try again.";
      setMessage(
        raw.includes("duplicate key")
          ? "This record already exists, or there is already a pending request."
          : raw.includes("no rows")
            ? "The selected record is unavailable. Refresh and try again."
            : raw,
      );
    } finally {
      setBusy(false);
    }
  }
  const available = fields.filter(
    (f) => !f.options || f.options.length > 0 || f.required !== false,
  );
  const renderField = (f: Field) => (
    <label
      key={f.name}
      htmlFor={`${id}-${f.name}`}
      className={f.type === "textarea" ? "wide" : ""}
    >
      <span>
        {f.label}
        {f.required !== false && <small aria-hidden="true"> *</small>}
      </span>
      {f.options ? (
        <select
          id={`${id}-${f.name}`}
          name={f.name}
          required={f.required !== false}
          defaultValue={
            f.value ??
            (f.required !== false && f.options.length === 1
              ? f.options[0].value
              : "")
          }
        >
          <option value="">Choose…</option>
          {f.options.map((o, i) => (
            <option key={`${o.value}-${i}`} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      ) : f.type === "textarea" ? (
        <textarea
          id={`${id}-${f.name}`}
          name={f.name}
          required={f.required !== false}
          maxLength={4000}
          defaultValue={f.value}
          rows={3}
        />
      ) : (
        <>
          <input
            id={`${id}-${f.name}`}
            name={f.name}
            type={f.type || "text"}
            required={f.required !== false}
            defaultValue={f.value}
            min={f.min}
            max={f.max}
            step={f.step}
            maxLength={f.type === "text" || !f.type ? 160 : undefined}
            list={f.suggestions?.length ? `${id}-${f.name}-options` : undefined}
          />
          {!!f.suggestions?.length && (
            <datalist id={`${id}-${f.name}-options`}>
              {f.suggestions.map((value) => (
                <option key={value} value={value} />
              ))}
            </datalist>
          )}
        </>
      )}
      {f.help && <small>{f.help}</small>}
    </label>
  );
  return (
    <form onSubmit={save} className="action-form">
      {title && <h3>{title}</h3>}
      {children}
      <div className="fields">
        {available
          .filter((f) => !extraFields.includes(f.name))
          .map(renderField)}
      </div>
      {available.some((f) => extraFields.includes(f.name)) && (
        <details className="extra-fields">
          <summary>More details (optional)</summary>
          <div className="fields">
            {available
              .filter((f) => extraFields.includes(f.name))
              .map(renderField)}
          </div>
        </details>
      )}
      {message && (
        <p
          role={error ? "alert" : "status"}
          className={`notice ${error ? "error" : "success"}`}
        >
          {message}
        </p>
      )}
      <button disabled={busy} className="button" type="submit">
        {busy ? "Saving…" : submit}
      </button>
    </form>
  );
}
