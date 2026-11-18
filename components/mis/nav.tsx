"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { navigation } from "@/lib/mis/navigation";
import type { Account } from "@/lib/mis/types";

export function WorkspaceNav({ role }: { role: Account["role"] }) {
  const path = usePathname();
  const { primary, groups } = navigation(role);
  const links = (items: typeof primary) =>
    items.map(({ path: key, label }) => {
      const href = `/workspace/${key}`;
      return (
        <Link
          className={path === href ? "active" : ""}
          aria-current={path === href ? "page" : undefined}
          key={key}
          href={href}
        >
          {label}
        </Link>
      );
    });
  return (
    <nav aria-label="Workspace">
      {links(primary)}
      {groups.map(({ label, items }) => (
        <details
          className="more-menu"
          key={label + path}
          open={items.some((i) => path === `/workspace/${i.path}`)}
        >
          <summary>{label}</summary>
          <div>{links(items)}</div>
        </details>
      ))}
    </nav>
  );
}
