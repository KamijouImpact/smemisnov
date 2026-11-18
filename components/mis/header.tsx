import Link from "next/link";
import { Account } from "@/lib/mis/types";
import { Logout } from "./logout";
export function Header({ user }: { user: Account | null }) {
  return (
    <header className="topbar">
      <Link className="brand" href="/">
        <span className="brand-icon">
          s<span>m</span>e
        </span>
        <span>
          SME MIS<small>Price & Stock Control</small>
        </span>
      </Link>
      <nav aria-label="Main navigation">
        <Link href="/">Browse products</Link>
        {user ? (
          <>
            <Link href="/workspace">
              {user.role === "Customer" ? "My reports" : "Workspace"}
            </Link>
            <Logout />
          </>
        ) : (
          <Link className="button small" href="/auth/login">
            Log in / Register <span>↗</span>
          </Link>
        )}
      </nav>
    </header>
  );
}
