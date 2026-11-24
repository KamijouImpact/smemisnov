import Link from "next/link";
import type { ReactNode } from "react";

export function SiteHeader({ children }: { children?: ReactNode }) {
  return (
    <header className="border-b bg-background">
      <div className="mx-auto flex min-h-16 max-w-7xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-2 sm:px-6 lg:px-8">
        <Link href="/" className="text-lg font-semibold tracking-tight">
          SME MIS
        </Link>
        {children}
      </div>
    </header>
  );
}
