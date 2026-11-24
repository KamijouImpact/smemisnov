import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AccountMenu } from "@/components/account-menu";
import { SidebarLayout } from "@/components/sidebar-layout";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";

const accountNames = new Map([
  ["owner", "Store Owner"],
  ["customer", "Customer"],
  ["admin", "Administrator"],
]);

async function Account() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims) redirect("/auth/login");

  const { data: account } = await supabase
    .from("account_roles")
    .select("account_type")
    .eq("user_id", data.claims.sub)
    .single();
  const accountName = accountNames.get(account?.account_type);

  return (
    <>
      <SiteHeader>
        <AccountMenu
          account={{ email: data.claims.email, role: accountName }}
          onAccountPage
        />
      </SiteHeader>
      <SidebarLayout>
        <h1 className="mb-6 text-2xl font-semibold tracking-tight sm:text-3xl">
          {accountName ? `${accountName} account` : "Account"}
        </h1>
        {!accountName && (
          <p role="alert" className="mb-4 text-sm text-destructive">
            Could not load your account type.
          </p>
        )}
        <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <Card className="min-w-0 space-y-4 p-5 sm:p-6">
            <h2 className="font-semibold">Account details</h2>
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-muted-foreground">Email</dt>
                <dd className="break-all font-medium">{data.claims.email}</dd>
              </div>
              {accountName && (
                <div>
                  <dt className="text-muted-foreground">Account type</dt>
                  <dd className="font-medium">{accountName}</dd>
                </div>
              )}
            </dl>
          </Card>
          <Card className="space-y-4 p-5 sm:p-6">
            <h2 className="font-semibold">Security</h2>
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="outline" className="min-h-11">
                <Link href="/auth/update-password">Change password</Link>
              </Button>
            </div>
          </Card>
        </div>
      </SidebarLayout>
    </>
  );
}

export default function ProtectedPage() {
  return (
    <div className="flex min-h-svh flex-col">
      <Suspense fallback={<SiteHeader />}>
        <Account />
      </Suspense>
    </div>
  );
}
