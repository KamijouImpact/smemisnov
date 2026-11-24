import Link from "next/link";
import type { ReactNode } from "react";

export function SiteHeader({
  children,
  leading,
}: {
  children?: ReactNode;
  leading?: ReactNode;
}) {
  return (
    <header className="border-b bg-background">
      <div className="flex min-h-16 flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-2">
        <div className="flex items-center gap-3">
          {leading}
          <Link href="/" className="text-lg font-semibold tracking-tight">
            SME MIS
          </Link>
        </div>
        {children}
      </div>
    </header>
  );
}
