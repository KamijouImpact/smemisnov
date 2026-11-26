import { Suspense } from "react";
import Form from "next/form";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
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

const route = "/protected/business-settings";
const pageSize = 25;
const filters = [
  { label: "All", value: "" },
  { label: "Pending", value: "pending" },
  { label: "Active", value: "active" },
  { label: "Paused", value: "paused" },
] as const;

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function applicationsUrl(query: string, status: string, page = 1) {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  if (status) params.set("status", status);
  if (page > 1) params.set("page", String(page));
  return params.size ? `${route}?${params}` : route;
}

function Status({ status }: { status: Business["status"] }) {
  return (
    <span className="w-fit rounded-full bg-muted px-3 py-1 text-xs font-medium">
      {statuses[status]}
    </span>
  );
}

async function Settings({ searchParams }: { searchParams: SearchParams }) {
  const viewer = await getViewer();
  if (!viewer) redirect("/auth/login");
  if (viewer.suspended) redirect("/protected");
  if (viewer.role !== "owner" && viewer.role !== "admin") notFound();

  const admin = viewer.role === "admin";
  const params = admin ? await searchParams : {};
  const query =
    typeof params.q === "string" ? params.q.trim().slice(0, 100) : "";
  const status =
    filters.find((filter) => filter.value === params.status)?.value ?? "";
  const requestedPage =
    typeof params.page === "string" ? Number(params.page) : 1;
  const page =
    Number.isSafeInteger(requestedPage) &&
    requestedPage > 0 &&
    requestedPage <= Math.floor(2_147_483_647 / pageSize)
      ? requestedPage
      : 1;
  const offset = (page - 1) * pageSize;

  let request = viewer.supabase
    .from("businesses")
    .select(
      "owner_id,business_name,business_type,address,status,updated_at,barangay_code,location_detail,google_place_id",
      admin ? { count: "exact" } : undefined,
    );
  if (admin) {
    if (status) request = request.eq("status", status);
    if (query)
      request = request.ilike(
        "business_name",
        `%${query.replaceAll(/[%_\\]/g, "\\$&")}%`,
      );
    request = request
      .order("status", { ascending: false })
      .order("business_name")
      .order("owner_id")
      .range(offset, offset + pageSize - 1);
  }
  const [records, choices] = await Promise.all([
    request,
    admin
      ? null
      : viewer.supabase.from("business_types").select("label").order("label"),
  ]);
  if (admin && page > 1 && records.error?.code === "PGRST103")
    redirect(applicationsUrl(query, status));

  const total = records.count ?? 0;
  const lastPage = Math.max(1, Math.ceil(total / pageSize));
  if (admin && !records.error && page > lastPage)
    redirect(applicationsUrl(query, status, lastPage));

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
          {admin ? "Businesses" : "Business settings"}
        </h1>
        {admin ? (
          <>
            <div
              role="tablist"
              aria-label="Business sections"
              className="border-b"
            >
              <button
                type="button"
                id="business-applications-tab"
                role="tab"
                aria-selected="true"
                aria-controls="business-applications-panel"
                className="-mb-px min-h-11 border-b-2 border-primary px-1 text-sm font-semibold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Business Applications
              </button>
            </div>
            <div
              id="business-applications-panel"
              role="tabpanel"
              aria-labelledby="business-applications-tab"
              tabIndex={0}
              className="space-y-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <nav
                className="flex flex-wrap gap-2"
                aria-label="Application status"
              >
                {filters.map((filter) => (
                  <Link
                    key={filter.value}
                    href={applicationsUrl(query, filter.value)}
                    aria-current={status === filter.value ? "page" : undefined}
                    className={cn(
                      "inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      status === filter.value
                        ? "border-primary bg-primary text-primary-foreground"
                        : "hover:bg-accent",
                    )}
                  >
                    {filter.label}
                  </Link>
                ))}
              </nav>
              <Form action={route} className="flex flex-wrap gap-2">
                {status && <input type="hidden" name="status" value={status} />}
                <Input
                  key={query}
                  type="search"
                  name="q"
                  aria-label="Search by business name"
                  placeholder="Search by business name"
                  defaultValue={query}
                  maxLength={100}
                  className="h-11 w-full sm:max-w-sm"
                />
                <Button type="submit" variant="outline" className="min-h-11">
                  Search
                </Button>
                {query && (
                  <Button asChild variant="ghost" className="min-h-11">
                    <Link href={applicationsUrl("", status)}>Clear search</Link>
                  </Button>
                )}
              </Form>
              {!records.error && total > 0 && (
                <p className="text-sm text-muted-foreground">
                  {total === 1 ? "1 business" : `${total} businesses`}
                </p>
              )}
              {records.error && (
                <p
                  role="alert"
                  className="rounded-xl border p-5 text-sm text-destructive"
                >
                  Could not load business applications. Refresh to try again.
                </p>
              )}
              {!records.error && businesses.length === 0 && (
                <p className="rounded-xl border p-5 text-sm text-muted-foreground">
                  {query || status
                    ? "No businesses match this search or status."
                    : "No business profiles have been submitted yet."}
                </p>
              )}
              {(["pending", "active", "paused"] as const).map((status) => {
                const group = businesses.filter(
                  (item) => item.status === status,
                );
                if (!group.length) return null;
                return (
                  <section key={status} className="space-y-2">
                    <h2 className="font-semibold">{statuses[status]}</h2>
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
              {!records.error && lastPage > 1 && (
                <nav
                  aria-label="Application pages"
                  className="flex flex-wrap items-center gap-3"
                >
                  {page > 1 && (
                    <Button asChild variant="outline" className="min-h-11">
                      <Link href={applicationsUrl(query, status, page - 1)}>
                        Previous
                      </Link>
                    </Button>
                  )}
                  <span className="text-sm text-muted-foreground">
                    Page {page} of {lastPage}
                  </span>
                  {page < lastPage && (
                    <Button asChild variant="outline" className="min-h-11">
                      <Link href={applicationsUrl(query, status, page + 1)}>
                        Next
                      </Link>
                    </Button>
                  )}
                </nav>
              )}
            </div>
          </>
        ) : records.error || choices?.error || location?.error ? (
          <p
            role="alert"
            className="rounded-xl border p-5 text-sm text-destructive"
          >
            Could not load business settings. Refresh to try again.
          </p>
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

export default function Page({ searchParams }: { searchParams: SearchParams }) {
  return (
    <div className="flex min-h-svh flex-col">
      <Suspense fallback={<SiteHeader />}>
        <Settings searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
