"use server";

import { revalidatePath } from "next/cache";
import { getViewer } from "@/lib/viewer";

export async function setAccountSuspension(userId: string, suspend: boolean) {
  const viewer = await getViewer();
  if (viewer?.role !== "admin")
    return { error: "Administrator access is required." };

  if (
    typeof userId !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      userId,
    ) ||
    typeof suspend !== "boolean"
  ) {
    return { error: "Choose a valid account and action." };
  }

  const { error } = await viewer.supabase.rpc(
    "set_managed_account_suspension",
    {
      target_user_id: userId,
      suspend,
    },
  );

  if (error) {
    return {
      error:
        error.code === "P0002"
          ? "This account can no longer be managed."
          : "Could not update the account. Try again.",
    };
  }

  revalidatePath("/protected/manage-accounts");
  return { error: null };
}
