import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { AccountMenu } from "@/components/account-menu";
import { SidebarLayout } from "@/components/sidebar-layout";
import { SiteHeader } from "@/components/site-header";
import { Card } from "@/components/ui/card";
import { getViewer } from "@/lib/viewer";
import { ProfileForm, ReviewForm, type Business } from "./forms";

import type { Location } from "./location-picker";

const statuses = {
  pending: "Waiting for approval",
  active: "Active",
  paused: "Paused",
};

function Status({ status }: { status: Business["status"] }) {
  return (
    <span className="w-fit rounded-full bg-muted px-3 py-1 text-xs font-medium">
      {statuses[status]}
    </span>
  );
}

async function Settings() {
  const viewer = await getViewer();
  if (!viewer) redirect("/auth/login");
  if (viewer.suspended) redirect("/protected");
  if (viewer.role !== "owner" && viewer.role !== "admin") notFound();

  const admin = viewer.role === "admin";
  const [records, choices] = await Promise.all([
    viewer.supabase
      .from("businesses")
      .select(
        "owner_id,business_name,business_type,address,status,updated_at,barangay_code,location_detail,google_place_id",
      )
      .order("business_name")
      .order("owner_id"),
    admin
      ? null
      : viewer.supabase.from("business_types").select("label").order("label"),
  ]);
  const businesses = (records.data ?? []) as Business[];
  const business = businesses[0];
  const location =
    !admin && business?.barangay_code
      ? await viewer.supabase.rpc("psgc_location_path", {
          location_code: business.barangay_code,
        })
      : null;

  return (
    <SidebarLayout
      canManageAccounts={admin}
      canManageBusiness
      onBusinessSettingsPage
      accountMenu={
        <AccountMenu account={{ email: viewer.email, role: viewer.roleName }} />
      }
    >
      <section className="max-w-5xl space-y-5">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Business settings
        </h1>
        {records.error || choices?.error || location?.error ? (
          <p
            role="alert"
            className="rounded-xl border p-5 text-sm text-destructive"
          >
            Could not load business settings. Refresh to try again.
          </p>
        ) : admin ? (
          <>
            {businesses.length === 0 && (
              <p className="rounded-xl border p-5 text-sm text-muted-foreground">
                No business profiles have been submitted yet.
              </p>
            )}
            {(["pending", "active", "paused"] as const).map((status) => {
              const group = businesses.filter((item) => item.status === status);
              if (!group.length) return null;
              return (
                <section key={status} className="space-y-2">
                  <h2 className="font-semibold">
                    {statuses[status]} ({group.length})
                  </h2>
                  <Card>
                    <ul className="divide-y">
                      {group.map((item) => (
                        <li
                          key={item.owner_id}
                          className="grid gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
                        >
                          <div className="min-w-0 space-y-1">
                            <p className="break-words font-medium">
                              {item.business_name}
                            </p>
                            <p className="break-words text-sm text-muted-foreground">
                              {item.business_type} · {item.address}
                            </p>
                          </div>
                          <ReviewForm business={item} />
                        </li>
                      ))}
                    </ul>
                  </Card>
                </section>
              );
            })}
          </>
        ) : (
          <Card className="max-w-xl space-y-5 p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-semibold">Business profile</h2>
              {business && <Status status={business.status} />}
            </div>
            {!business && (
              <p className="text-sm text-muted-foreground">
                Register your business for Administrator review.
              </p>
            )}
            <ProfileForm
              key={business?.updated_at}
              business={business}
              locationPath={(location?.data ?? []) as Location[]}
              mapsKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}
              types={(choices?.data ?? []).map((choice) => choice.label)}
            />
          </Card>
        )}
      </section>
    </SidebarLayout>
  );
}

export default function Page() {
  return (
    <div className="flex min-h-svh flex-col">
      <Suspense fallback={<SiteHeader />}>
        <Settings />
      </Suspense>
    </div>
  );
}
