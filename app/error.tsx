"use client";

import Link from "next/link";
import { useEffect } from "react";
import { AppIcon } from "@/components/ui/Polished";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main id="main-content" className="flex min-h-[100dvh] items-center justify-center bg-[var(--ds-bg-app)] px-5 text-center">
      <section className="ds-card-elevated w-full max-w-lg p-7" aria-labelledby="error-title">
        <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--ds-danger-soft)] text-[var(--ds-danger)]" aria-hidden="true">
          <AppIcon name="history" className="h-5 w-5" />
        </span>
        <p className="mt-5 text-xs font-semibold text-[var(--ds-text-muted)]">Workspace interrupted</p>
        <h1 id="error-title" className="mt-2 text-2xl font-semibold tracking-tight text-[var(--ds-text-primary)]">
          That view could not finish loading.
        </h1>
        <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-[var(--ds-text-muted)]">
          Your account and study history are safe. Try the view again, or return to the learning hub.
        </p>
        <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
          <button type="button" onClick={reset} className="ds-button ds-button-primary">
            Try again
          </button>
          <Link href="/dashboard" className="ds-button ds-button-secondary">
            Open learning hub
          </Link>
        </div>
      </section>
    </main>
  );
}
