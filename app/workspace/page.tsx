import { account } from "@/lib/mis/data";
import { redirect } from "next/navigation";

export default async function Workspace() {
  const user = await account(true);
  redirect(
    user?.role === "Customer" ? "/workspace/concerns" : "/workspace/overview",
  );
}
