import Link from "next/link";
export default function AuthError() {
  return (
    <main className="password-page">
      <section className="panel">
        <h1>This link could not be used.</h1>
        <p>
          It may have expired or already been used. Log in, register again, or
          request a new password reset link.
        </p>
        <Link className="button" href="/auth/login">
          Back to login
        </Link>
      </section>
    </main>
  );
}
