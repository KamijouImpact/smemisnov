import { Suspense } from "react";
import { AccountMenu } from "@/components/account-menu";
import { SidebarLayout } from "@/components/sidebar-layout";
import { SiteHeader } from "@/components/site-header";
import { getViewer } from "@/lib/viewer";

async function Catalog() {
  const viewer = await getViewer();

  return (
    <SidebarLayout
      canManageAccounts={viewer?.role === "admin"}
      accountMenu={
        <AccountMenu
          account={
            viewer ? { email: viewer.email, role: viewer.roleName } : undefined
          }
        />
      }
    >
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
        Products
      </h1>
    </SidebarLayout>
  );
}

export default function Home() {
  return (
    <div className="flex min-h-svh flex-col">
      <Suspense fallback={<SiteHeader />}>
        <Catalog />
      </Suspense>
    </div>
  );
}
