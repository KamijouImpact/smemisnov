"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type SubmitEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function CredentialsForm({ mode }: { mode: "login" | "register" }) {
  const registering = mode === "register";
  const title = registering ? "Register" : "Log in";
  const router = useRouter();
  const [visiblePassword, setVisiblePassword] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    const fields = new FormData(event.currentTarget);
    const email = String(fields.get("email")).trim().toLowerCase();
    const password = String(fields.get("password"));
    setError("");
    setSubmitting(true);

    try {
      const supabase = createClient();
      if (registering) {
        const accountType = fields.get("account_type");
        if (accountType !== "owner" && accountType !== "customer") {
          setError("Choose an account type.");
          return;
        }
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { account_type: accountType },
            emailRedirectTo: `${window.location.origin}/protected`,
          },
        });
        if (error) throw error;
        router.replace(data.session ? "/protected" : "/auth/sign-up-success");
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        router.replace("/protected");
      }
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : "Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-sm flex-col justify-center px-4 py-8 sm:px-0">
      <Link href="/" className="mb-4 self-start text-sm font-semibold">
        SME MIS
      </Link>
      <Card className="space-y-5 p-5 sm:p-6">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <form onSubmit={submit} className="space-y-4" aria-busy={submitting}>
          {registering && (
            <fieldset className="grid gap-2">
              <legend className="mb-2 text-sm font-medium">Account type</legend>
              <div className="grid grid-cols-2 gap-2">
                <label className="flex min-h-11 cursor-pointer items-center gap-2 rounded-md border border-input px-2.5 text-sm has-[:checked]:border-primary has-[:checked]:bg-muted">
                  <input
                    type="radio"
                    name="account_type"
                    value="owner"
                    required
                  />
                  Store Owner
                </label>
                <label className="flex min-h-11 cursor-pointer items-center gap-2 rounded-md border border-input px-2.5 text-sm has-[:checked]:border-primary has-[:checked]:bg-muted">
                  <input
                    type="radio"
                    name="account_type"
                    value="customer"
                    required
                  />
                  Customer
                </label>
              </div>
            </fieldset>
          )}
          <div className="grid gap-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              autoCapitalize="none"
              spellCheck={false}
              required
              className="h-11"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="password">Password</Label>
            <div className="flex items-center gap-2">
              <Input
                id="password"
                name="password"
                type={visiblePassword ? "text" : "password"}
                required
                minLength={registering ? 8 : undefined}
                autoComplete={registering ? "new-password" : "current-password"}
                aria-describedby={registering ? "password-hint" : undefined}
                className="h-11 min-w-0"
              />
              <Button
                type="button"
                variant="outline"
                className="h-11 shrink-0"
                aria-controls="password"
                aria-label={visiblePassword ? "Hide password" : "Show password"}
                onClick={() => setVisiblePassword(!visiblePassword)}
              >
                {visiblePassword ? "Hide" : "Show"}
              </Button>
            </div>
            {registering ? (
              <p id="password-hint" className="text-sm text-muted-foreground">
                Use at least 8 characters.
              </p>
            ) : (
              <Link
                href="/auth/forgot-password"
                className="justify-self-start text-sm underline underline-offset-4"
              >
                Forgot password?
              </Link>
            )}
          </div>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <Button type="submit" className="h-11 w-full" disabled={submitting}>
            {submitting
              ? registering
                ? "Registering…"
                : "Logging in…"
              : title}
          </Button>
        </form>
        <p className="text-sm">
          {registering ? "Already have an account?" : "New to SME MIS?"}{" "}
          <Link
            href={registering ? "/auth/login" : "/auth/sign-up"}
            className="font-medium underline underline-offset-4"
          >
            {registering ? "Log in" : "Register"}
          </Link>
        </p>
      </Card>
    </main>
  );
}
