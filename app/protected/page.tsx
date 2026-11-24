import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LogoutButton } from "@/components/logout-button";
import { createClient } from "@/lib/supabase/server";

async function Account() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims) redirect("/auth/login");

  return (
    <div className="space-y-4">
      <p className="break-words text-muted-foreground">{data.claims.email}</p>
      <LogoutButton />
    </div>
  );
}

export default function ProtectedPage() {
  return (
    <main className="mx-auto w-full max-w-lg space-y-5 px-6 py-16">
      <Link href="/" className="text-sm underline">Home</Link>
      <h1 className="text-2xl font-semibold">Account</h1>
      <Suspense>
        <Account />
      </Suspense>
    </main>
  );
}
