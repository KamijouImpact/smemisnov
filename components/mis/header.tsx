import Link from "next/link";
import { Account } from "@/lib/mis/types";
import { Logout } from "./logout";
export function Header({
  user,
  showBrowseLink = true,
}: {
  user: Account | null;
  showBrowseLink?: boolean;
}) {
  const ownerWorkspace = user?.role === "Owner";
  return (
    <header className="topbar">
      <Link
        className="brand"
        href={ownerWorkspace ? "/workspace/overview" : "/"}
      >
        <span className="brand-icon">
          s<span>m</span>e
        </span>
        <span>
          SME MIS<small>Price & Stock Control</small>
        </span>
      </Link>
      <nav aria-label="Main navigation">
        {showBrowseLink && !ownerWorkspace && (
          <Link href="/">Browse products</Link>
        )}
        {user ? (
          <>
            <Link
              href={
                user.role === "Customer" ? "/workspace/concerns" : "/workspace"
              }
            >
              {user.role === "Customer" ? "My price reports" : "Workspace"}
            </Link>
            <Logout />
          </>
        ) : (
          <>
            <Link href="/auth/login">Log in</Link>
            <Link className="button small" href="/auth/sign-up">
              Register
            </Link>
          </>
        )}
      </nav>
    </header>
  );
}
