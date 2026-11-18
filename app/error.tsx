"use client";
import Link from "next/link";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="password-page">
      <section className="panel">
        <h1>We couldn’t load this page.</h1>
        <p>Please try again. Your saved records remain in the database.</p>
        <button className="button" onClick={reset}>
          Try again
        </button>
        <Link href="/">Browse products</Link>
      </section>
    </main>
  );
}
