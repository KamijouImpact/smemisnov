"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Label } from "@/components/ui/label";

export type Location = {
  code: string;
  label: string;
  kind: "R" | "P" | "L" | "D" | "B";
};

function LocationLevel({
  parent,
  value,
  index,
  choose,
}: {
  parent?: Location;
  value?: Location;
  index: number;
  choose: (location?: Location) => void;
}) {
  const [options, setOptions] = useState<Location[]>();
  const [error, setError] = useState(false);
  useEffect(() => {
    let current = true;
    const query = createClient()
      .from("psgc_locations")
      .select("code,label,kind")
      .order("label")
      .order("code");
    void (
      parent
        ? query.eq("parent_code", parent.code)
        : query.is("parent_code", null)
    ).then(({ data, error }) => {
      if (!current) return;
      if (error) setError(true);
      else setOptions(data as Location[]);
    });
    return () => {
      current = false;
    };
  }, [parent]);

  const kind = options?.[0]?.kind;
  const label = !parent
    ? "Region"
    : parent.kind === "R" && options?.some((item) => item.kind === "P")
      ? options.some((item) => item.kind === "L")
        ? "Province or independent locality"
        : "Province"
      : kind === "B" || parent.kind === "D"
        ? "Barangay"
        : kind === "D"
          ? "District"
          : "City or municipality";

  return (
    <div className="grid gap-2">
      <Label htmlFor={`location-${index}`}>{label}</Label>
      <select
        id={`location-${index}`}
        value={value?.code ?? ""}
        required
        disabled={!options?.length}
        className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
        onChange={(event) =>
          choose(options?.find((option) => option.code === event.target.value))
        }
      >
        <option value="">
          {options
            ? options.length
              ? "Choose…"
              : "No locations found"
            : error
              ? "Locations unavailable"
              : "Loading…"}
        </option>
        {(options ?? (value ? [value] : [])).map((option) => (
          <option key={option.code} value={option.code}>
            {option.label}
          </option>
        ))}
      </select>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          Could not load locations. Refresh and try again.
        </p>
      )}
    </div>
  );
}

export function LocationPicker({ initialPath }: { initialPath: Location[] }) {
  const [path, setPath] = useState(initialPath);
  const barangay = path.at(-1);
  const levels = barangay?.kind === "B" ? path.length : path.length + 1;
  return (
    <fieldset className="space-y-3">
      <legend className="mb-2 text-sm font-semibold">Business location</legend>
      <div className="grid gap-3 sm:grid-cols-2">
        {Array.from({ length: levels }, (_, index) => (
          <LocationLevel
            key={path[index - 1]?.code ?? "regions"}
            index={index}
            parent={path[index - 1]}
            value={path[index]}
            choose={(location) =>
              setPath((previous) => [
                ...previous.slice(0, index),
                ...(location ? [location] : []),
              ])
            }
          />
        ))}
      </div>
      <input
        type="hidden"
        name="barangay"
        value={barangay?.kind === "B" ? barangay.code : ""}
      />
    </fieldset>
  );
}
