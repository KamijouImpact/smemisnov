import Link from "next/link";
import { account } from "@/lib/mis/data";
import { Header } from "@/components/mis/header";
import { WorkspaceNav } from "@/components/mis/nav";
export default async function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = (await account(true))!;
  if (user.status !== "Active")
    return (
      <>
        <Header user={user} />
        <main className="password-page">
          <h1>Your account is inactive</h1>
          <p>Contact the Administrator to restore access.</p>
          <Link href="/">Browse public products</Link>
        </main>
      </>
    );
  return (
    <>
      <Header user={user} />
      <div className="workspace">
        <aside>
          <span className="eyebrow">
            {user.role === "Administrator"
              ? "ADMINISTRATOR"
              : user.role === "Owner"
                ? "MY STORE"
                : "MY ACCOUNT"}
          </span>
          <WorkspaceNav role={user.role} />
          <div className="sidebar-account">
            <span className="avatar">
              {user.full_name.charAt(0).toUpperCase()}
            </span>
            <div>
              <strong>{user.full_name}</strong>
              <small>{user.role}</small>
            </div>
          </div>
        </aside>
        <main className="workspace-main">{children}</main>
      </div>
    </>
  );
}
