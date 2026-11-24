import Link from "next/link";
import { LogoutButton } from "./logout-button";
import { createClient } from "@/lib/supabase/server";
import { hasEnvVars } from "@/lib/utils";

type Account = { email?: string; role?: string };

export function AccountMenu({
  account,
  onAccountPage = false,
}: {
  account?: Account;
  onAccountPage?: boolean;
}) {
  const initial = account?.email?.charAt(0).toUpperCase();
  return (
    <>
      <button
        type="button"
        popoverTarget="account-menu"
        aria-label="Open account menu"
        className="grid size-11 shrink-0 cursor-pointer place-items-center rounded-full border bg-muted text-sm font-semibold hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {initial || (
          <svg
            aria-hidden="true"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
          >
            <circle cx="12" cy="8" r="3.25" />
            <path d="M5 20v-1.1A4.9 4.9 0 0 1 9.9 14h4.2a4.9 4.9 0 0 1 4.9 4.9V20" />
          </svg>
        )}
      </button>
      <nav
        id="account-menu"
        popover="auto"
        aria-label="Account actions"
        className="fixed inset-auto right-4 top-16 m-0 w-64 max-w-[calc(100vw-2rem)] rounded-xl border bg-popover p-2 text-popover-foreground shadow-lg sm:right-6 lg:right-[max(2rem,calc((100vw-76rem)/2))]"
      >
        <div className="mb-1 border-b px-3 pb-3 pt-2">
          <p className="text-sm font-semibold">
            {account ? (account.role ?? "Account") : "Guest"}
          </p>
          {account?.email && (
            <p className="mt-1 break-all text-sm text-muted-foreground">
              {account.email}
            </p>
          )}
        </div>
        {account ? (
          <>
            {!onAccountPage && (
              <AccountLink href="/protected">My account</AccountLink>
            )}
            <LogoutButton
              className="w-full justify-start font-normal"
              variant="ghost"
            />
          </>
        ) : (
          <>
            <AccountLink href="/auth/login">Log in</AccountLink>
            <AccountLink href="/auth/sign-up">Register</AccountLink>
          </>
        )}
      </nav>
    </>
  );
}

function AccountLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="flex min-h-11 items-center rounded-md px-3 text-sm hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {children}
    </Link>
  );
}

export async function HeaderAccountMenu() {
  if (!hasEnvVars) return <AccountMenu />;

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  return (
    <AccountMenu
      account={data?.claims ? { email: data.claims.email } : undefined}
    />
  );
}
