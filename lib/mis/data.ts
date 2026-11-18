import { createClient } from "@/lib/supabase/server";
import { cache } from "react";
import { redirect } from "next/navigation";
import { Account, Database, Row, tables } from "./types";
export const account = cache(
  async (required = false): Promise<Account | null> => {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      if (required) redirect("/auth/login");
      return null;
    }
    const { data, error } = await supabase
      .from("user_account")
      .select("*")
      .eq("user_id", user.id)
      .single();
    if (error)
      throw new Error("Your account could not be loaded. Please try again.");
    return data as Account;
  },
);
export async function workspaceData(role: Account["role"]): Promise<Database> {
  const supabase = await createClient();
  const needed = role === "Customer" ? ["customer_report"] : tables;
  const primary: Record<string, string> = {
    user_account: "user_id",
    sme: "sme_id",
    category: "category_id",
    brand: "brand_id",
    product: "product_id",
    product_variation: "variation_id",
    product_unit: "unit_id",
    product_request: "product_request_id",
    store_product: "store_product_id",
    store_price: "store_price_id",
    price_rule: "rule_id",
    price_request: "price_request_id",
    price_reference: "price_request_id",
    price_history: "price_history_id",
    stock_transaction: "stock_transaction_id",
    promotion: "promotion_id",
    promotion_entry: "promotion_entry_id",
    customer_report: "customer_report_id",
  };
  const entries = await Promise.all(
    needed.map(async (table) => {
      const rows: Row[] = [];
      let offset = 0;
      while (true) {
        const { data, error } = await supabase
          .from(table)
          .select("*")
          .order(primary[table])
          .range(offset, offset + 999);
        if (error)
          throw new Error(
            `Could not load ${table.replaceAll("_", " ")}. Please try again.`,
          );
        rows.push(...data);
        if (data.length < 1000) break;
        offset += 1000;
      }
      return [table, rows] as const;
    }),
  );
  return Object.fromEntries(
    tables.map((t) => [t, entries.find(([key]) => key === t)?.[1] || []]),
  );
}
