import { account, workspaceData } from "@/lib/mis/data";
import { pageName } from "@/lib/mis/navigation";
import { WorkspacePage } from "@/components/mis/workspace";
import { createClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
export default async function Section({
  params,
  searchParams,
}: {
  params: Promise<{ section: string }>;
  searchParams: Promise<{ item?: string }>;
}) {
  const { section } = await params;
  const { item } = await searchParams;
  const user = (await account(true))!;
  if (!pageName(user.role, section)) {
    if (user.role === "Customer") redirect("/workspace/concerns");
    notFound();
  }
  const supabase = await createClient();
  const [db, { data: publicRows, error }] = await Promise.all([
    workspaceData(user.role, section),
    section === "concerns" && user.role !== "Owner"
      ? supabase.rpc("browse_products", { search: "" })
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (error)
    throw new Error("Could not load public listings. Please try again.");
  return (
    <WorkspacePage
      section={section}
      user={user}
      db={db}
      publicRows={publicRows || []}
      requestedItem={item}
    />
  );
}
