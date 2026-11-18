"use client";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
export function Logout() {
  const router = useRouter();
  return (
    <button
      className="link-button"
      onClick={async () => {
        const { error } = await createClient().auth.signOut();
        if (error) {
          alert("Could not sign out. Please try again.");
          return;
        }
        router.push("/");
        router.refresh();
      }}
    >
      Log out
    </button>
  );
}
