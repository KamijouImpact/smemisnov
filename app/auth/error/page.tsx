import Link from "next/link";
export default function AuthError() {
  return (
    <main className="password-page">
      <section className="panel">
        <h1>This link is unavailable</h1>
        <p>It may have expired or already been used.</p>
        <Link className="button" href="/auth/login">
          Back to log in
        </Link>
      </section>
    </main>
  );
}
