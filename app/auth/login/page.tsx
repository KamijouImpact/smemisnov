import { AuthPortal } from "@/components/mis/auth";
export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string; next?: string }>;
}) {
  const p = await searchParams;
  return <AuthPortal initialMode={p.mode} next={p.next} />;
}
