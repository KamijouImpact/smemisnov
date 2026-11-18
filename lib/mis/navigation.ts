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

  const support = [
    item("reports", "Sales & stock reports"),
    item("promotions", "Promotions"),
  ];

  if (role === "Administrator")
    return {
      primary: [
        item("overview", "Overview"),
        item("stores", "Store approvals"),
        item("product-requests", "Product requests"),
        item("prices", "Price approvals"),
        item("concerns", "Price reports"),
      ],
      groups: [
        {
          label: "Catalog and reports",
          items: [
            item("catalog", "Product catalog"),
            item("stock", "Stock levels"),
            ...support,
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
      item("stores", "My store"),
    ],
    groups: [
      {
        label: "Reports and promotions",
        items: [item("concerns", "Price reports"), ...support],
      },
      { label: "Account", items: [account] },
    ],
  };
}

export function pageName(role: Account["role"], section: string) {
  const { primary, groups } = navigation(role);
  return [...primary, ...groups.flatMap(({ items }) => items)].find(
    (item) => item.path === section,
  )?.label;
}
