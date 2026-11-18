"use client";
import Link from "next/link";
import { safeNext } from "@/lib/mis/paths";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
export function AuthPortal({
  initialMode = "login",
  next = "/workspace",
}: {
  initialMode?: string;
  next?: string;
}) {
  const router = useRouter();
  const [mode, setMode] = useState(
    initialMode === "register" ? "register" : "login",
  );
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    const f = new FormData(e.currentTarget);
    const supabase = createClient();
    const email = String(f.get("email")).trim();
    const password = String(f.get("password"));
    try {
      if (mode === "register") {
        if (password !== f.get("confirm_password"))
          throw new Error("The passwords do not match.");
        const full_name = String(f.get("full_name")).trim();
        const requested_role = String(f.get("role"));
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo:
              window.location.origin + "/auth/confirm?next=/workspace",
            data: { full_name, requested_role },
          },
        });
        if (error) throw error;
        if (data.session) {
          const { error } = await supabase.rpc("mis_command", {
            action: "complete_registration",
            a: { role: requested_role, full_name },
          });
          if (error) throw error;
          router.push("/workspace");
          router.refresh();
          return;
        }
        setError(false);
        setMessage(
          "Check your email to confirm your account. Then return here to log in.",
        );
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        const { data: profile } = await supabase
          .from("user_account")
          .select("role,status")
          .eq("user_id", data.user.id)
          .single();
        if (profile?.status === "Inactive") {
          await supabase.auth.signOut();
          throw new Error(
            "Your account is inactive. Contact the Administrator.",
          );
        }
        if (
          profile?.role === "Customer" &&
          data.user.user_metadata.requested_role === "Owner"
        ) {
          const { error } = await supabase.rpc("mis_command", {
            action: "complete_registration",
            a: {
              role: "Owner",
              full_name: data.user.user_metadata.full_name || "Store Owner",
            },
          });
          if (error) throw error;
        }
        router.push(safeNext(next));
        router.refresh();
      }
    } catch (e) {
      setError(true);
      setMessage(
        e instanceof Error
          ? e.message
          : "Could not continue. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="auth-layout">
      <div className="auth-top">
        <Link className="brand" href="/">
          SME MIS
        </Link>
        <Link href="/">← Browse products</Link>
      </div>
      <main className="auth-panel">
        <div className="auth-box">
          <h2>{mode === "login" ? "Log in" : "Create an account"}</h2>
          <p>
            {mode === "login"
              ? "Log in to manage your store or check your price reports."
              : "Choose how you’ll use the system."}
          </p>
          <div className="auth-tabs">
            <button
              className={mode === "login" ? "selected" : ""}
              onClick={() => {
                setMode("login");
                setMessage("");
              }}
            >
              Log in
            </button>
            <button
              className={mode === "register" ? "selected" : ""}
              onClick={() => {
                setMode("register");
                setMessage("");
              }}
            >
              Register
            </button>
          </div>
          <form onSubmit={submit} className="action-form">
            <div className="fields single">
              {mode === "register" && (
                <>
                  <label>
                    <span>Full name</span>
                    <input
                      name="full_name"
                      required
                      maxLength={120}
                      autoComplete="name"
                    />
                  </label>
                  <label>
                    <span>I am a</span>
                    <select name="role" required>
                      <option value="Owner">Store Owner</option>
                      <option value="Customer">Customer</option>
                    </select>
                  </label>
                </>
              )}
              <label>
                <span>Email address</span>
                <input
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                />
              </label>
              <label>
                <span>Password</span>
                <input
                  name="password"
                  type="password"
                  required
                  minLength={8}
                  autoComplete={
                    mode === "login" ? "current-password" : "new-password"
                  }
                />
              </label>
              {mode === "register" && (
                <label>
                  <span>Confirm password</span>
                  <input
                    name="confirm_password"
                    type="password"
                    required
                    minLength={8}
                    autoComplete="new-password"
                  />
                </label>
              )}
            </div>
            {message && (
              <p
                role={error ? "alert" : "status"}
                className={`notice ${error ? "error" : "success"}`}
              >
                {message}
              </p>
            )}
            <button className="button full" disabled={busy}>
              {busy
                ? "Please wait…"
                : mode === "login"
                  ? "Log in →"
                  : "Create account →"}
            </button>
          </form>
          <Link className="subtle-link" href="/auth/forgot-password">
            Forgot your password?
          </Link>
          <p className="auth-note">
            Administrator access is assigned by the project owner.
          </p>
        </div>
      </main>
    </div>
  );
}
export function PasswordForm({ update = false }: { update?: boolean }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <main className="password-page">
      <Link href="/">← SME MIS</Link>
      <section className="panel">
        <h1>{update ? "Set a new password" : "Reset your password"}</h1>
        <form
          className="action-form"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            const f = new FormData(e.currentTarget);
            const client = createClient();
            try {
              if (update) {
                const { error } = await client.auth.updateUser({
                  password: String(f.get("password")),
                });
                if (error) throw error;
                router.push("/workspace");
                router.refresh();
              } else {
                const { error } = await client.auth.resetPasswordForEmail(
                  String(f.get("email")),
                  {
                    redirectTo:
                      window.location.origin + "/auth/update-password",
                  },
                );
                if (error) throw error;
                setMessage(
                  "If the account exists, a reset link has been sent.",
                );
              }
            } catch (e) {
              setMessage(e instanceof Error ? e.message : "Please try again.");
            } finally {
              setBusy(false);
            }
          }}
        >
          <label>
            <span>{update ? "New password" : "Email address"}</span>
            <input
              required
              type={update ? "password" : "email"}
              name={update ? "password" : "email"}
              minLength={update ? 8 : undefined}
            />
          </label>
          {message && (
            <p role="status" className="notice">
              {message}
            </p>
          )}
          <button className="button" disabled={busy}>
            {busy
              ? "Please wait…"
              : update
                ? "Save password"
                : "Send reset link"}
          </button>
        </form>
        <Link href="/auth/login">Back to login</Link>
      </section>
    </main>
  );
}
