"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
export function WorkspaceNav({ role }: { role: string }) {
  const path = usePathname();
  const items =
    role === "Customer"
      ? [
          ["concerns", "My reports", "◎"],
          ["account", "My account", "◉"],
        ]
      : [
          ["overview", "Overview", "▦"],
          ["stores", "Stores", "⌂"],
          ["products", "Store products", "▧"],
          ...(role === "Administrator"
            ? [["catalog", "Shared products", "◇"]]
            : []),
          ["prices", "Price requests", "₱"],
          ["stock", "Stock records", "▤"],
          ["promotions", "Promotions", "✧"],
          ["reports", "Management reports", "◷"],
          ["concerns", "Customer reports", "◎"],
          ...(role === "Administrator"
            ? [
                ["rules", "Price rules", "≋"],
                ["accounts", "Accounts", "◉"],
              ]
            : []),
          ["account", "My account", "◉"],
        ];
  return (
    <nav aria-label="Workspace navigation">
      {items.map(([key, name, icon]) => (
        <Link
          className={path === `/workspace/${key}` ? "active" : ""}
          key={key}
          href={`/workspace/${key}`}
        >
          <span>{icon}</span>
          {name}
        </Link>
      ))}
    </nav>
  );
}
