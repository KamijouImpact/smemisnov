"use client";

import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { type ComponentProps } from "react";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";

export function LogoutButton({
  className,
  variant,
}: Pick<ComponentProps<typeof Button>, "className" | "variant">) {
  const router = useRouter();

  const logout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/auth/login");
  };

  return (
    <Button
      type="button"
      className={cn("min-h-11", className)}
      variant={variant}
      onClick={logout}
    >
      Log out
    </Button>
  );
}
