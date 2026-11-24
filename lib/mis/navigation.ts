import type { Account } from "./types";

type LinkItem = { path: string; label: string };
const item = (path: string, label: string): LinkItem => ({ path, label });

export function navigation(role: Account["role"]) {
  const account = item("account", "My account");
  if (role === "Customer")
    return {
      primary: [item("concerns", "My price reports"), account],
      groups: [],
    };

  const promotions = item("promotions", "Promotions");

  if (role === "Administrator")
    return {
      primary: [
        item("overview", "Overview"),
        item("stores", "Stores"),
        item("choice-requests", "Option requests"),
        item("prices", "Price approvals"),
        item("concerns", "Price reports"),
      ],
      groups: [
        {
          label: "Catalog and promotions",
          items: [
            item("catalog", "Product catalog"),
            promotions,
          ],
        },
        {
          label: "Settings",
          items: [
            item("rules", "Price rules"),
            item("accounts", "User accounts"),
            account,
          ],
        },
      ],
    };

  return {
    primary: [
      item("overview", "Overview"),
      item("products", "My products"),
      item("prices", "Price requests"),
      item("stock", "Stock"),
      item("reports", "Sales & stock reports"),
      item("stores", "My store"),
      account,
    ],
    groups: [
      {
        label: "More",
        items: [item("concerns", "Price reports"), promotions],
      },
    ],
  };
}

export function pageName(role: Account["role"], section: string) {
  const { primary, groups } = navigation(role);
  return [...primary, ...groups.flatMap(({ items }) => items)].find(
    (item) => item.path === section,
  )?.label;
}
