"use client";

import Script from "next/script";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

type Point = { lat(): number; lng(): number };
type Place = {
  id?: string;
  location?: Point;
  formattedAddress?: string;
  fetchFields(options: { fields: string[] }): Promise<unknown>;
};
type Places = {
  PlaceAutocompleteElement: new (options: {
    includedRegionCodes: string[];
  }) => HTMLElement;
};
type Maps = {
  Map: new (
    element: HTMLElement,
    options: {
      center: Point;
      zoom: number;
      disableDefaultUI: boolean;
      gestureHandling: string;
    },
  ) => unknown;
};
type MapsLoader = { importLibrary(name: "places" | "maps"): Promise<unknown> };

function mapsApi() {
  return (window as Window & { google?: { maps?: MapsLoader } }).google?.maps;
}

export function GoogleLocation({
  apiKey,
  initialId,
}: {
  apiKey: string;
  initialId?: string | null;
}) {
  const host = useRef<HTMLDivElement>(null);
  const map = useRef<HTMLDivElement>(null);
  const [opened, setOpened] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(initialId ?? "");
  const [preview, setPreview] = useState<{
    id: string;
    point: Point;
    address?: string;
  }>();

  useEffect(() => {
    if (!ready) return;
    const container = host.current;
    const api = mapsApi();
    let cancelled = false;
    let widget: HTMLElement | undefined;
    let selection = 0;
    const unavailable = () =>
      setError("Google Maps is unavailable. Use the official location picker.");

    async function choose(event: Event) {
      const request = ++selection;
      const prediction = (
        event as Event & { placePrediction?: { toPlace(): Place } }
      ).placePrediction;
      if (!prediction) return;
      setPreview(undefined);
      setError("");
      try {
        const place = prediction.toPlace();
        await place.fetchFields({
          fields: ["id", "location", "formattedAddress"],
        });
        if (cancelled || request !== selection) return;
        if (!place.id || !place.location) {
          setError(
            "That result has no storefront location. Try a street address.",
          );
          return;
        }
        setPreview({
          id: place.id,
          point: place.location,
          address: place.formattedAddress,
        });
      } catch {
        if (!cancelled && request === selection)
          setError(
            "Could not load this place. You can use the official location picker.",
          );
      }
    }
    void (async () => {
      try {
        if (!api || !container) throw new Error("Maps unavailable");
        const { PlaceAutocompleteElement } = (await api.importLibrary(
          "places",
        )) as Places;
        if (cancelled) return;
        widget = new PlaceAutocompleteElement({ includedRegionCodes: ["ph"] });
        widget.setAttribute(
          "aria-label",
          "Find your storefront in Google Maps",
        );
        widget.addEventListener("gmp-select", choose);
        widget.addEventListener("gmp-error", unavailable);
        container.append(widget);
      } catch {
        if (!cancelled)
          setError(
            "Google Maps is unavailable. Use the official location picker.",
          );
      }
    })();
    return () => {
      cancelled = true;
      widget?.removeEventListener("gmp-select", choose);
      widget?.removeEventListener("gmp-error", unavailable);
      widget?.remove();
    };
  }, [ready]);

  useEffect(() => {
    if (!preview) return;
    let cancelled = false;
    const container = map.current;
    void (async () => {
      try {
        const api = mapsApi();
        if (!api || !container) return;
        const { Map } = (await api.importLibrary("maps")) as Maps;
        if (!cancelled)
          new Map(container, {
            center: preview.point,
            zoom: 17,
            disableDefaultUI: true,
            gestureHandling: "none",
          });
      } catch {
        if (!cancelled)
          setError(
            "Map preview unavailable. Confirm the address above the map.",
          );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [preview]);

  return (
    <div className="space-y-3 rounded-lg border p-3">
      <input type="hidden" name="google_place_id" value={selected} />
      <div className="flex flex-wrap items-center gap-2">
        {!opened && (
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            onClick={() => setOpened(true)}
          >
            Find on Google Maps
          </Button>
        )}
        {selected && (
          <>
            <span className="text-sm text-muted-foreground">
              Google Maps place selected
            </span>
            <Button
              type="button"
              variant="ghost"
              className="min-h-11"
              onClick={() => setSelected("")}
            >
              Remove place
            </Button>
          </>
        )}
      </div>
      {opened && (
        <>
          <Script
            id="google-maps-places"
            src={`https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=places&v=weekly`}
            onReady={() => setReady(true)}
            onError={() =>
              setError(
                "Google Maps is unavailable. Use the official location picker.",
              )
            }
          />
          <div ref={host} />
          {!ready && !error && (
            <p role="status" className="text-sm">
              Loading Google Maps…
            </p>
          )}
        </>
      )}
      {preview && (
        <div className="space-y-2">
          {preview.address && (
            <p className="text-sm font-medium">{preview.address}</p>
          )}
          <div className="relative h-44 overflow-hidden rounded-md border">
            <div ref={map} className="h-full w-full" />
            <span
              aria-hidden="true"
              className="pointer-events-none absolute left-1/2 top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-red-600 shadow"
            />
          </div>
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            onClick={() => {
              setSelected(preview.id);
              setPreview(undefined);
            }}
          >
            Use this Google Maps place
          </Button>
        </div>
      )}
      {error && (
        <p role="status" className="text-sm text-muted-foreground">
          {error}
        </p>
      )}
    </div>
  );
}
