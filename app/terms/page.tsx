import Link from "next/link";

export const metadata = {
  title: "Terms of Service — AgentifyAI",
};

export default function TermsPage() {
  return (
    <main className="mx-auto flex min-h-[100dvh] w-full max-w-2xl flex-col justify-center px-6 py-16 text-[var(--agentify-primary-text)]">
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#0E7490]">AgentifyAI</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Terms of Service</h1>
      <p className="mt-4 text-sm leading-7 text-[var(--agentify-muted-text)]">
        Our full Terms of Service are being finalized ahead of public launch. By using AgentifyAI you agree to
        use it for personal study, to keep your account secure, and to use generated study material responsibly.
        The complete, binding terms will be published on this page before general availability.
      </p>
      <Link
        href="/login"
        className="mt-8 inline-flex w-fit items-center gap-2 rounded-2xl border border-[var(--agentify-border)] bg-[var(--agentify-card-bg)] px-5 py-3 text-sm font-semibold transition hover:border-[#0E7490]/40"
      >
        Back to sign in
      </Link>
    </main>
  );
}
