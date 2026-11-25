import { Suspense } from "react";
import Form from "next/form";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AccountMenu } from "@/components/account-menu";
import { SidebarLayout } from "@/components/sidebar-layout";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getViewer } from "@/lib/viewer";
import { cn } from "@/lib/utils";
import { Directory, type DirectoryAccount } from "./directory";

const route = "/protected/manage-accounts";
const pageSize = 25;
const filters = [
  { label: "All accounts", value: "" },
  { label: "Store Owners", value: "owner" },
  { label: "Customers", value: "customer" },
];

type Search = Promise<{
  q?: string | string[];
  type?: string | string[];
  page?: string | string[];
}>;

function directoryUrl(query: string, role: string, page = 1) {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  if (role) params.set("type", role);
  if (page > 1) params.set("page", String(page));
  return params.size ? `${route}?${params}` : route;
}

async function ManageAccounts({ searchParams }: { searchParams: Search }) {
  const viewer = await getViewer();
  if (!viewer) redirect("/auth/login");
  if (viewer.role !== "admin") notFound();

  const params = await searchParams;
  const query =
    typeof params.q === "string" ? params.q.trim().slice(0, 254) : "";
  const role =
    params.type === "owner" || params.type === "customer" ? params.type : "";
  const requestedPage =
    typeof params.page === "string" ? Number(params.page) : 1;
  const page =
    Number.isSafeInteger(requestedPage) &&
    requestedPage >= 1 &&
    requestedPage <= 85_899_345
      ? requestedPage
      : 1;

  const { data: result, error } = await viewer.supabase.rpc(
    "list_managed_accounts",
    {
      search_email: query || null,
      filter_role: role || null,
      page_offset: (page - 1) * pageSize,
    },
  );
  const data = result as { total: number; accounts: DirectoryAccount[] } | null;

  const total = data?.total ?? 0;
  const lastPage = Math.max(1, Math.ceil(total / pageSize));
  if (!error && page > lastPage) redirect(directoryUrl(query, role, lastPage));

  return (
    <SidebarLayout
      canManageBusiness
      canManageAccounts
      onManageAccountsPage
      accountMenu={
        <AccountMenu account={{ email: viewer.email, role: viewer.roleName }} />
      }
    >
      <div className="max-w-6xl space-y-5">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Manage accounts
        </h1>
        <nav aria-label="Account type" className="flex flex-wrap gap-2">
          {filters.map(({ label, value }) => (
            <Link
              key={value}
              href={directoryUrl(query, value)}
              aria-current={role === value ? "page" : undefined}
              className={cn(
                "inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                role === value
                  ? "border-primary bg-primary text-primary-foreground"
                  : "hover:bg-accent",
              )}
            >
              {label}
            </Link>
          ))}
        </nav>
        <Form action={route} className="flex flex-wrap gap-2">
          {role && <input type="hidden" name="type" value={role} />}
          <Input
            key={query}
            type="search"
            name="q"
            aria-label="Search by email"
            placeholder="Search by email"
            defaultValue={query}
            maxLength={254}
            className="h-11 w-full sm:max-w-sm"
          />
          <Button type="submit" variant="outline" className="min-h-11">
            Search
          </Button>
          {query && (
            <Button asChild variant="ghost" className="min-h-11">
              <Link href={directoryUrl("", role)}>Clear search</Link>
            </Button>
          )}
        </Form>

        {error ? (
          <p
            role="alert"
            className="rounded-xl border p-5 text-sm text-destructive"
          >
            Could not load accounts. Try refreshing the page.
          </p>
        ) : data?.accounts.length ? (
          <>
            <p className="text-sm text-muted-foreground">
              {total === 1 ? "1 account" : `${total} accounts`}
            </p>
            <Directory
              key={directoryUrl(query, role, page)}
              accounts={data.accounts}
            />
            {lastPage > 1 && (
              <nav
                aria-label="Account pages"
                className="flex flex-wrap items-center gap-3"
              >
                {page > 1 && (
                  <Button asChild variant="outline" className="min-h-11">
                    <Link href={directoryUrl(query, role, page - 1)}>
                      Previous
                    </Link>
                  </Button>
                )}
                <span className="text-sm text-muted-foreground">
                  Page {page} of {lastPage}
                </span>
                {page < lastPage && (
                  <Button asChild variant="outline" className="min-h-11">
                    <Link href={directoryUrl(query, role, page + 1)}>Next</Link>
                  </Button>
                )}
              </nav>
            )}
          </>
        ) : (
          <p className="rounded-xl border p-5 text-sm text-muted-foreground">
            {query
              ? "No accounts match this email search."
              : role
                ? "No accounts of this type yet."
                : "No Store Owners or Customers have registered yet."}
          </p>
        )}
      </div>
    </SidebarLayout>
  );
}

export default function Page({ searchParams }: { searchParams: Search }) {
  return (
    <div className="flex min-h-svh flex-col">
      <Suspense fallback={<SiteHeader />}>
        <ManageAccounts searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
