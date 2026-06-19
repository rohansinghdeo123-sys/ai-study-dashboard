import Link from "next/link";

export const metadata = {
  title: "Privacy Policy - AgentifyAI",
};

const privacyHighlights = [
  {
    label: "Study activity",
    detail: "Questions, sessions, answers, and progress are used to personalize learning paths and analytics.",
  },
  {
    label: "Student profile",
    detail: "Class level, display name, and onboarding choices help AgentifyAI adapt the study experience.",
  },
  {
    label: "Learning controls",
    detail: "Account access, sign-in security, and future data controls stay connected to the student account.",
  },
];

export default function PrivacyPage() {
  return (
    <main className="min-h-[100dvh] bg-[radial-gradient(circle_at_12%_0%,rgba(20,184,166,0.14),transparent_32%),radial-gradient(circle_at_88%_10%,rgba(242,184,75,0.12),transparent_28%),var(--agentify-bg)] px-5 py-10 text-[var(--agentify-primary-text)] sm:px-8">
      <section className="mx-auto grid min-h-[calc(100dvh-5rem)] w-full max-w-6xl items-center gap-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(360px,1fr)]">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#0E7490]">AgentifyAI privacy</p>
          <h1 className="mt-4 max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl">Privacy Policy</h1>
          <p className="mt-5 max-w-2xl text-sm leading-7 text-[var(--agentify-muted-text)] sm:text-base">
            Your privacy matters. AgentifyAI stores your study activity, including questions, sessions, and progress, to
            personalize learning and show your analytics. We do not sell your data. A complete, binding Privacy Policy
            will be published on this page before general availability.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link
              href="/login"
              className="inline-flex items-center rounded-2xl border border-[#0E7490]/25 bg-[#0E7490]/10 px-5 py-3 text-sm font-semibold text-[#0E7490] transition hover:-translate-y-0.5 hover:bg-[#0E7490]/15"
            >
              Back to sign in
            </Link>
            <Link
              href="/terms"
              className="inline-flex items-center rounded-2xl border border-[var(--agentify-border)] bg-[var(--agentify-card-bg)] px-5 py-3 text-sm font-semibold transition hover:-translate-y-0.5 hover:border-[#0E7490]/35"
            >
              View terms
            </Link>
          </div>
        </div>

        <div className="rounded-[2rem] border border-[var(--agentify-border)] bg-[var(--agentify-card-bg)] p-5 shadow-[0_28px_80px_rgba(15,23,42,0.10)] backdrop-blur-xl sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--agentify-border)] pb-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--agentify-muted-text)]">At a glance</p>
              <h2 className="mt-1 text-xl font-semibold">How privacy supports learning</h2>
            </div>
            <span className="rounded-full border border-[#14B8A6]/25 bg-[#14B8A6]/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[#0E7490]">
              No data sale
            </span>
          </div>
          <div className="mt-5 space-y-3">
            {privacyHighlights.map((item) => (
              <article key={item.label} className="rounded-2xl border border-[var(--agentify-border)] bg-white/[0.035] p-4">
                <p className="text-sm font-semibold">{item.label}</p>
                <p className="mt-2 text-sm leading-6 text-[var(--agentify-muted-text)]">{item.detail}</p>
              </article>
            ))}
          </div>
          <p className="mt-5 rounded-2xl border border-amber-300/25 bg-amber-300/10 p-4 text-xs leading-6 text-[var(--agentify-muted-text)]">
            This page is prepared for launch policy content and keeps the privacy promise visible without hiding it behind sign-in.
          </p>
        </div>
      </section>
    </main>
  );
}
