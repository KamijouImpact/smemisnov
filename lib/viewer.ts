import { createClient } from "@/lib/supabase/server";
import { hasEnvVars } from "@/lib/utils";

export const accountNames = new Map([
  ["owner", "Store Owner"],
  ["customer", "Customer"],
  ["admin", "Administrator"],
]);

export async function getViewer() {
  if (!hasEnvVars) return null;

  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims) return null;

  const { data: account } = await supabase
    .from("account_roles")
    .select("account_type, suspended_at")
    .eq("user_id", data.claims.sub)
    .single();

  if (!account) return null;

  return {
    supabase,
    email: data.claims.email,
    role: account.account_type,
    suspended: account.suspended_at !== null,
    roleName: accountNames.get(account.account_type),
  };
}
