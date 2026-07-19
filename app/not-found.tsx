import Link from "next/link";
import ChatThinkingLogo from "@/components/brand/ChatThinkingLogo";

export default function NotFound() {
  return (
    <main id="main-content" className="flex min-h-[100dvh] items-center justify-center bg-[var(--ds-bg-app)] px-5 text-center">
      <section className="ds-card-elevated w-full max-w-lg p-7" aria-labelledby="not-found-title">
        <ChatThinkingLogo state="idle" size={46} className="mx-auto" label="AgentifyAI" />
        <p className="mt-5 text-xs font-semibold text-[var(--ds-text-muted)]">404 · Page not found</p>
        <h1 id="not-found-title" className="mt-2 text-2xl font-semibold tracking-tight text-[var(--ds-text-primary)]">
          This study space does not exist.
        </h1>
        <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-[var(--ds-text-muted)]">
          The link may be outdated. Return to your learning hub or sign in again.
        </p>
        <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
          <Link href="/dashboard" className="ds-button ds-button-primary">
            Open learning hub
          </Link>
          <Link href="/login" className="ds-button ds-button-secondary">
            Go to sign in
          </Link>
        </div>
      </section>
    </main>
  );
}
