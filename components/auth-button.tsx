import Link from "next/link";
import { Button } from "./ui/button";
import { createClient } from "@/lib/supabase/server";
import { hasEnvVars } from "@/lib/utils";

export async function AuthButton() {
  if (hasEnvVars) {
    const supabase = await createClient();
    const { data } = await supabase.auth.getClaims();

    if (data?.claims) {
      return (
        <Button asChild className="h-11 sm:h-9">
          <Link href="/protected">Account</Link>
        </Button>
      );
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="mr-1 text-sm text-muted-foreground">Guest</span>
      <Button asChild className="h-11 sm:h-9" variant="outline">
        <Link href="/auth/login">Log in</Link>
      </Button>
      <Button asChild className="h-11 sm:h-9">
        <Link href="/auth/sign-up">Register</Link>
      </Button>
    </div>
  );
}
