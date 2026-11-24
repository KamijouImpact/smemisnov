import { Suspense } from "react";
import { HeaderAccountMenu } from "@/components/account-menu";
import { SidebarLayout } from "@/components/sidebar-layout";
import { SiteHeader } from "@/components/site-header";

export default function Home() {
  return (
    <div className="flex min-h-svh flex-col">
      <SiteHeader>
        <Suspense>
          <HeaderAccountMenu />
        </Suspense>
      </SiteHeader>
      <SidebarLayout>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Products
        </h1>
      </SidebarLayout>
    </div>
  );
}
