import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LogoutButton } from "@/components/logout-button";
import { createClient } from "@/lib/supabase/server";

async function Account() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims) redirect("/auth/login");

  const { data: account, error: accountError } = await supabase
    .from("account_roles")
    .select("account_type")
    .eq("user_id", data.claims.sub)
    .single();

  return (
    <div className="space-y-4">
      <p className="break-words text-muted-foreground">{data.claims.email}</p>
      {accountError ? (
        <p role="alert" className="text-sm text-destructive">
          Could not load your account type.
        </p>
      ) : (
        <p className="text-sm font-medium">
          {account.account_type === "owner" ? "Store Owner" : "Customer"}
        </p>
      )}
      <LogoutButton />
    </div>
  );
}

export default function ProtectedPage() {
  return (
    <main className="mx-auto w-full max-w-lg space-y-5 px-6 py-16">
      <Link href="/" className="text-sm underline">
        Home
      </Link>
      <h1 className="text-2xl font-semibold">Account</h1>
      <Suspense>
        <Account />
      </Suspense>
    </main>
  );
}
