import { Suspense } from "react";
import { AuthButton } from "@/components/auth-button";
import { hasEnvVars } from "@/lib/utils";

export default function Home() {
  return (
    <main className="grid min-h-svh place-items-center px-6">
      <section className="w-full max-w-sm space-y-5">
        <h1 className="text-3xl font-semibold tracking-tight">SME MIS</h1>
        {hasEnvVars && (
          <Suspense>
            <AuthButton />
          </Suspense>
        )}
      </section>
    </main>
  );
}
