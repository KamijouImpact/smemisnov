"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";

export type DirectoryAccount = {
  id: string;
  email: string | null;
  account_type: "owner" | "customer";
  created_at: string;
  email_confirmed: boolean;
  last_sign_in_at: string | null;
};

const date = new Intl.DateTimeFormat("en-PH", {
  dateStyle: "medium",
  timeZone: "Asia/Manila",
});

function accountLabel(account: DirectoryAccount) {
  return account.account_type === "owner" ? "Store Owner" : "Customer";
}

function emailLabel(account: DirectoryAccount) {
  return account.email ?? "No email address";
}

export function Directory({ accounts }: { accounts: DirectoryAccount[] }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [selected, setSelected] = useState<DirectoryAccount>();

  return (
    <>
      <ul className="divide-y rounded-xl border">
        {accounts.map((account) => (
          <li
            key={account.id}
            className="grid gap-3 px-4 py-4 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center sm:gap-5"
          >
            <div className="min-w-0">
              <p className="break-all font-medium">{emailLabel(account)}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Joined {date.format(new Date(account.created_at))}
              </p>
            </div>
            <span className="w-fit rounded-full bg-muted px-2.5 py-1 text-xs font-medium">
              {accountLabel(account)}
            </span>
            <Button
              type="button"
              variant="outline"
              className="min-h-11 w-fit"
              aria-label={`View details for ${emailLabel(account)}`}
              onClick={() => {
                setSelected(account);
                dialog.current?.showModal();
              }}
            >
              View details
            </Button>
          </li>
        ))}
      </ul>
      <dialog
        ref={dialog}
        onClose={() => setSelected(undefined)}
        aria-labelledby="directory-account-details"
        className="fixed inset-y-0 left-auto right-0 m-0 h-dvh max-h-none w-full max-w-md overflow-y-auto border-l bg-background p-5 text-foreground shadow-xl backdrop:bg-black/30 sm:p-6"
      >
        <div className="mb-6 flex items-center justify-between gap-3 border-b pb-4">
          <h2 id="directory-account-details" className="text-lg font-semibold">
            Account details
          </h2>
          <Button
            type="button"
            variant="ghost"
            className="min-h-11"
            onClick={() => dialog.current?.close()}
          >
            Close
          </Button>
        </div>
        {selected && (
          <dl className="space-y-4 text-sm">
            <div>
              <dt className="text-muted-foreground">Email</dt>
              <dd className="break-all font-medium">{emailLabel(selected)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Account type</dt>
              <dd>{accountLabel(selected)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Email confirmation</dt>
              <dd>
                {selected.email_confirmed
                  ? "Confirmed"
                  : "Awaiting confirmation"}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Joined</dt>
              <dd>{date.format(new Date(selected.created_at))}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Last sign-in</dt>
              <dd>
                {selected.last_sign_in_at
                  ? date.format(new Date(selected.last_sign_in_at))
                  : "Never"}
              </dd>
            </div>
          </dl>
        )}
      </dialog>
    </>
  );
}
