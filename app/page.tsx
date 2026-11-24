import { Suspense } from "react";
import { HeaderAccountMenu } from "@/components/account-menu";
import { SiteHeader } from "@/components/site-header";

export default function Home() {
  return (
    <div className="min-h-svh">
      <SiteHeader>
        <Suspense>
          <HeaderAccountMenu />
        </Suspense>
      </SiteHeader>
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Products
        </h1>
      </main>
    </div>
  );
}
