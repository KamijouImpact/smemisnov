"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { reviewBusiness, saveBusiness, type Result } from "./actions";

import { LocationPicker, type Location } from "./location-picker";
import { GoogleLocation } from "./google-location";

export type Business = {
  owner_id: string;
  business_name: string;
  business_type: string;
  address: string;
  barangay_code: string | null;
  location_detail: string | null;
  google_place_id: string | null;
  status: "pending" | "active" | "paused";
  updated_at: string;
};

function Feedback({ result }: { result: Result }) {
  return result.message ? (
    <p
      role={result.error ? "alert" : "status"}
      className={
        result.error
          ? "text-sm text-destructive"
          : "text-sm text-muted-foreground"
      }
    >
      {result.message}
    </p>
  ) : null;
}

export function ProfileForm({
  business,
  types,
  locationPath,
  mapsKey,
}: {
  business?: Business;
  types: string[];
  locationPath: Location[];
  mapsKey?: string;
}) {
  const [result, action, pending] = useActionState(saveBusiness, {
    message: "",
  });

  return (
    <form action={action} className="space-y-4">
      <div className="grid gap-2">
        <Label htmlFor="business-name">Business name</Label>
        <Input
          id="business-name"
          name="name"
          required
          minLength={2}
          maxLength={100}
          defaultValue={business?.business_name}
          className="h-11"
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="business-type">Business type</Label>
        <select
          id="business-type"
          name="type"
          required
          defaultValue={business?.business_type ?? ""}
          className="h-11 w-full rounded-md border border-input bg-background px-3"
        >
          <option value="" disabled>
            Choose a business type
          </option>
          {types.map((type) => (
            <option key={type}>{type}</option>
          ))}
        </select>
      </div>
      {mapsKey ? (
        <GoogleLocation
          apiKey={mapsKey}
          initialId={business?.google_place_id}
        />
      ) : (
        <input
          type="hidden"
          name="google_place_id"
          value={business?.google_place_id ?? ""}
        />
      )}
      {business && !business.barangay_code && (
        <p className="text-sm text-muted-foreground">
          Previous address: {business.address}
        </p>
      )}
      <LocationPicker initialPath={locationPath} />
      <div className="grid gap-2">
        <Label htmlFor="location-detail">Street or building (optional)</Label>
        <Input
          id="location-detail"
          name="location_detail"
          maxLength={100}
          defaultValue={business?.location_detail ?? ""}
          className="h-11"
        />
      </div>
      {business?.status === "active" && (
        <p className="text-sm text-muted-foreground">
          Changes to this profile go back to the Administrator for review.
        </p>
      )}
      <Button type="submit" disabled={pending} className="min-h-11">
        {pending ? "Saving…" : business ? "Save changes" : "Submit for review"}
      </Button>
      <Feedback result={result} />
    </form>
  );
}

export function ReviewForm({ business }: { business: Business }) {
  const [result, action, pending] = useActionState(reviewBusiness, {
    message: "",
  });
  const label = {
    active: "Pause business",
    paused: "Reactivate business",
    pending: "Approve business",
  }[business.status];
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="owner" value={business.owner_id} />
      <input type="hidden" name="version" value={business.updated_at} />
      <input
        type="hidden"
        name="status"
        value={business.status === "active" ? "paused" : "active"}
      />
      <Button
        type="submit"
        variant={business.status === "pending" ? "default" : "outline"}
        disabled={pending}
        className="min-h-11"
      >
        {pending ? "Saving…" : label}
      </Button>
      <Feedback result={result} />
    </form>
  );
}
