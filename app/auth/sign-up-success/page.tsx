import Link from "next/link";
export default function Success() {
  return (
    <main className="password-page">
      <section className="panel">
        <h1>Check your email</h1>
        <p>Use the confirmation link, then log in to continue.</p>
        <Link className="button" href="/auth/login">
          Back to login
        </Link>
      </section>
    </main>
  );
}
