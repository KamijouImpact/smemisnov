import { Suspense } from "react";
import Link from "next/link";
import { AuthButton } from "@/components/auth-button";

export default function Home() {
  return (
    <div className="min-h-svh">
      <header className="border-b bg-background">
        <div className="mx-auto flex min-h-16 max-w-7xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-2 sm:px-6 lg:px-8">
          <Link href="/" className="text-lg font-semibold tracking-tight">
            SME MIS
          </Link>
          <nav aria-label="Account">
            <Suspense>
              <AuthButton />
            </Suspense>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Products
        </h1>
      </main>
    </div>
  );
}
