import type { ReactNode } from "react";

export function SidebarLayout({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto grid w-full max-w-7xl flex-1 md:grid-cols-[10rem_minmax(0,1fr)] lg:grid-cols-[14rem_minmax(0,1fr)]">
      <aside
        aria-hidden="true"
        className="hidden border-r bg-muted/30 md:block"
      />
      <main className="min-w-0 px-4 py-8 sm:px-6 lg:px-8">{children}</main>
    </div>
  );
}
