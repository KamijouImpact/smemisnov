"use server";

import { revalidatePath } from "next/cache";
import { getViewer } from "@/lib/viewer";

export type Result = { message: string; error?: boolean };

export async function saveBusiness(
  _state: Result,
  fields: FormData,
): Promise<Result> {
  const viewer = await getViewer();
  if (viewer?.role !== "owner" || viewer.suspended)
    return { message: "Store Owner access is required.", error: true };

  const { error } = await viewer.supabase.rpc("save_business_profile", {
    name_input: String(fields.get("name") ?? ""),
    type_input: String(fields.get("type") ?? ""),
    address_input: String(fields.get("address") ?? ""),
  });
  if (error)
    return {
      message:
        error.code === "22023"
          ? error.message
          : "Could not save your business. Try again.",
      error: true,
    };

  revalidatePath("/protected/business-settings");
  return { message: "Business profile saved." };
}

export async function reviewBusiness(
  _state: Result,
  fields: FormData,
): Promise<Result> {
  const viewer = await getViewer();
  if (viewer?.role !== "admin" || viewer.suspended)
    return { message: "Administrator access is required.", error: true };

  const { error } = await viewer.supabase.rpc("review_business", {
    business_owner: String(fields.get("owner") ?? ""),
    expected_updated_at: String(fields.get("version") ?? ""),
    next_status: String(fields.get("status") ?? ""),
  });
  if (error)
    return {
      message:
        error.code === "P0002"
          ? error.message
          : "Could not update this business. Try again.",
      error: true,
    };

  revalidatePath("/protected/business-settings");
  return { message: "Business status updated." };
}
