"use client";

import Link from "next/link";
import { useId, useState, useSyncExternalStore, type ReactNode } from "react";
import { SiteHeader } from "./site-header";
import { cn } from "@/lib/utils";

const wideScreen = "(min-width: 768px)";

function subscribeToViewport(onChange: () => void) {
  const media = window.matchMedia(wideScreen);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

export function SidebarLayout({
  children,
  accountMenu,
  onAccountPage = false,
}: {
  children: ReactNode;
  accountMenu: ReactNode;
  onAccountPage?: boolean;
}) {
  const sidebarId = useId();
  const isWide = useSyncExternalStore(
    subscribeToViewport,
    () => window.matchMedia(wideScreen).matches,
    () => false,
  );
  const [sidebarOverride, setSidebarOverride] = useState<boolean | null>(null);
  const open = sidebarOverride ?? isWide;

  return (
    <>
      <SiteHeader
        leading={
          <button
            type="button"
            aria-label={open ? "Close sidebar" : "Open sidebar"}
            aria-expanded={open}
            aria-controls={sidebarId}
            onClick={() => setSidebarOverride(!open)}
            className="grid size-11 shrink-0 cursor-pointer place-items-center rounded-md border hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <svg
              aria-hidden="true"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
            >
              {open ? (
                <path d="m6 6 12 12M18 6 6 18" />
              ) : (
                <path d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        }
      >
        {accountMenu}
      </SiteHeader>
      <div
        className={cn(
          "grid w-full flex-1 grid-rows-[auto_1fr]",
          open &&
            "md:grid-cols-[10rem_minmax(0,1fr)] md:grid-rows-1 lg:grid-cols-[14rem_minmax(0,1fr)]",
        )}
      >
        <aside
          id={sidebarId}
          hidden={!open}
          className="border-b bg-muted/30 px-4 py-3 md:border-b-0 md:border-r md:py-5"
        >
          <nav aria-label="Sidebar">
            <Link
              href="/protected"
              aria-current={onAccountPage ? "page" : undefined}
              className="flex min-h-11 items-center rounded-md px-3 text-xs font-semibold tracking-wide hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring aria-[current=page]:bg-accent"
            >
              ACCOUNT
            </Link>
          </nav>
        </aside>
        <main
          className={cn(
            "min-w-0 px-4 py-8 sm:px-6 lg:px-8",
            !open && "row-span-2",
          )}
        >
          {children}
        </main>
      </div>
    </>
  );
}
