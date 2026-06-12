import Link from "next/link";

export const metadata = {
  title: "Privacy Policy — AgentifyAI",
};

export default function PrivacyPage() {
  return (
    <main className="mx-auto flex min-h-[100dvh] w-full max-w-2xl flex-col justify-center px-6 py-16 text-[var(--agentify-primary-text)]">
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#0E7490]">AgentifyAI</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Privacy Policy</h1>
      <p className="mt-4 text-sm leading-7 text-[var(--agentify-muted-text)]">
        Your privacy matters. AgentifyAI stores your study activity — questions, sessions, and progress — to
        personalize learning and show your analytics. We do not sell your data. A complete, binding Privacy
        Policy will be published on this page before general availability.
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
