"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { navigation } from "@/lib/mis/navigation";
import type { Account } from "@/lib/mis/types";
export function WorkspaceNav({ role }: { role: Account["role"] }) {
  const path = usePathname();
  const { main, more } = navigation(role);
  const links = (items: typeof main) =>
    items.map(({ path: key, label, icon }) => (
      <Link
        className={path === `/workspace/${key}` ? "active" : ""}
        aria-current={path === `/workspace/${key}` ? "page" : undefined}
        key={key}
        href={`/workspace/${key}`}
      >
        <span aria-hidden="true">{icon}</span>
        {label}
      </Link>
    ));
  return (
    <nav aria-label="Store menu">
      {links(main)}
      <details
        className="more-menu"
        key={path}
        open={more.some((i) => path === `/workspace/${i.path}`)}
      >
        <summary>More</summary>
        <div>{links(more)}</div>
      </details>
    </nav>
  );
}
