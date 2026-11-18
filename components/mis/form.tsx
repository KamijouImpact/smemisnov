"use client";
import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Field } from "@/lib/mis/types";
export function ActionForm({
  action,
  fields = [],
  hidden = {},
  title,
  submit = "Save",
  children,
}: {
  action: string;
  fields?: Field[];
  hidden?: Record<string, string | number>;
  title?: string;
  submit?: string;
  children?: React.ReactNode;
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
      const { data, error: failure } = await createClient().rpc("mis_command", {
        action,
        a: { ...values, ...hidden },
      });
      if (failure) throw failure;
      setError(false);
      setMessage(data?.message || "Saved.");
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
  return (
    <form onSubmit={save} className="action-form">
      {title && <h3>{title}</h3>}
      {children}
      <div className="fields">
        {fields.map((f) => (
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
                defaultValue={f.value ?? ""}
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
              />
            )}
            {f.help && <small>{f.help}</small>}
          </label>
        ))}
      </div>
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
