import type { Account } from "./types";
type LinkItem = { path: string; label: string; icon: string };
const item = (path: string, label: string, icon: string): LinkItem => ({
  path,
  label,
  icon,
});
export function navigation(role: Account["role"]) {
  if (role === "Customer")
    return {
      main: [item("concerns", "My price reports", "◎")],
      more: [item("account", "My account", "◉")],
    };
  return {
    main: [
      item("overview", "Home", "▦"),
      ...(role === "Administrator" ? [item("stores", "Stores", "⌂")] : []),
      item(role === "Administrator" ? "catalog" : "products", "Products", "▧"),
      item("prices", "Prices", "₱"),
      item("stock", "Stock", "▤"),
      item("reports", "Reports", "◷"),
      item("concerns", "Price reports", "◎"),
    ],
    more: [
      ...(role === "Owner" ? [item("stores", "My stores", "⌂")] : []),
      item("promotions", "Promotions", "✧"),
      ...(role === "Administrator"
        ? [
            item("rules", "Price settings", "≋"),
            item("accounts", "User accounts", "◉"),
          ]
        : []),
      item("account", "My account", "◉"),
    ],
  };
}
export const pageNames: Record<string, string> = {
  overview: "Home",
  stores: "Stores",
  products: "Products",
  catalog: "Products",
  prices: "Prices",
  stock: "Stock",
  reports: "Reports",
  concerns: "Price reports",
  promotions: "Promotions",
  rules: "Price settings",
  accounts: "User accounts",
  account: "My account",
};
