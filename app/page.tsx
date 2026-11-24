import { Suspense } from "react";
import { HeaderAccountMenu } from "@/components/account-menu";
import { SidebarLayout } from "@/components/sidebar-layout";

export default function Home() {
  return (
    <div className="flex min-h-svh flex-col">
      <SidebarLayout
        accountMenu={
          <Suspense>
            <HeaderAccountMenu />
          </Suspense>
        }
      >
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Products
        </h1>
      </SidebarLayout>
    </div>
  );
}
