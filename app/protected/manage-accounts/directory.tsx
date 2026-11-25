"use client";

import { useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { setAccountSuspension } from "./actions";

export type DirectoryAccount = {
  id: string;
  email: string | null;
  account_type: "owner" | "customer";
  created_at: string | null;
  email_confirmed: boolean;
  last_sign_in_at: string | null;
  suspended_at: string | null;
};

const date = new Intl.DateTimeFormat("en-PH", {
  dateStyle: "medium",
  timeZone: "Asia/Manila",
});

function emailLabel(account: DirectoryAccount) {
  return account.email ?? "No email address";
}

export function Directory({ accounts }: { accounts: DirectoryAccount[] }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [selected, setSelected] = useState<DirectoryAccount>();
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const selectedIsSuspended = Boolean(selected?.suspended_at);
  const action = selectedIsSuspended ? "Unsuspend" : "Suspend";

  function confirmChange() {
    if (!selected || pending) return;
    setError("");
    startTransition(async () => {
      try {
        const result = await setAccountSuspension(
          selected.id,
          !selectedIsSuspended,
        );
        if (result.error) {
          setError(result.error);
          return;
        }
        setNotice(
          selectedIsSuspended ? "Account unsuspended." : "Account suspended.",
        );
        dialog.current?.close();
      } catch {
        setError("Could not update the account. Try again.");
      }
    });
  }

  return (
    <>
      {notice && (
        <p
          role="status"
          className="rounded-md border bg-muted px-4 py-3 text-sm"
        >
          {notice}
        </p>
      )}
      <ul className="divide-y rounded-xl border">
        {accounts.map((account) => {
          const suspended = Boolean(account.suspended_at);
          const accountAction = suspended ? "Unsuspend" : "Suspend";
          return (
            <li
              key={account.id}
              className="grid gap-4 p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start sm:p-5"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <p className="break-all font-semibold">
                    {emailLabel(account)}
                  </p>
                  <span
                    className={cn(
                      "rounded-full px-2.5 py-1 text-xs font-medium",
                      suspended
                        ? "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200"
                        : "bg-muted text-foreground",
                    )}
                  >
                    {suspended ? "Suspended" : "Active"}
                  </span>
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-x-5 gap-y-2 text-sm lg:flex lg:flex-wrap lg:gap-x-6">
                  <div>
                    <dt className="text-muted-foreground">Account type</dt>
                    <dd>
                      {account.account_type === "owner"
                        ? "Store Owner"
                        : "Customer"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">
                      Email confirmation
                    </dt>
                    <dd>
                      {account.email_confirmed
                        ? "Confirmed"
                        : "Awaiting confirmation"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Joined</dt>
                    <dd>
                      {account.created_at
                        ? date.format(new Date(account.created_at))
                        : "Unavailable"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Last sign-in</dt>
                    <dd>
                      {account.last_sign_in_at
                        ? date.format(new Date(account.last_sign_in_at))
                        : "Never"}
                    </dd>
                  </div>
                </dl>
              </div>
              <Button
                type="button"
                variant="outline"
                className={cn(
                  "min-h-11 w-fit",
                  !suspended && "text-destructive",
                )}
                aria-label={`${accountAction} ${emailLabel(account)}`}
                onClick={() => {
                  setSelected(account);
                  setNotice("");
                  setError("");
                  dialog.current?.showModal();
                }}
              >
                {accountAction}
              </Button>
            </li>
          );
        })}
      </ul>
      <dialog
        ref={dialog}
        aria-labelledby="account-action-title"
        aria-describedby="account-action-description"
        onCancel={(event) => {
          if (pending) event.preventDefault();
        }}
        onClose={() => setSelected(undefined)}
        className="fixed inset-0 m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-md overflow-y-auto rounded-xl border bg-background p-5 text-foreground shadow-xl backdrop:bg-black/40 sm:p-6"
      >
        <h2 id="account-action-title" className="text-lg font-semibold">
          {action} account?
        </h2>
        <p
          id="account-action-description"
          className="mt-2 text-sm text-muted-foreground"
        >
          {selected && (
            <strong className="break-all font-medium text-foreground">
              {emailLabel(selected)}.{" "}
            </strong>
          )}
          {selectedIsSuspended
            ? "They’ll be able to log in again."
            : "This ends their current sessions and blocks future sign-ins until an Administrator unsuspends them."}
        </p>
        {error && (
          <p role="alert" className="mt-3 text-sm text-destructive">
            {error}
          </p>
        )}
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            disabled={pending}
            onClick={() => dialog.current?.close()}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant={selectedIsSuspended ? "default" : "destructive"}
            className="min-h-11"
            disabled={pending}
            onClick={confirmChange}
          >
            {pending ? "Saving…" : action}
          </Button>
        </div>
      </dialog>
    </>
  );
}
