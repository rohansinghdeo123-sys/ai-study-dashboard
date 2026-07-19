import Link from "next/link";
import {
  DATA_REQUEST_LINKS,
  LEGAL_EFFECTIVE_DATE,
  SUPPORT_EMAIL,
  STUDENT_PRIVACY_COMMITMENTS,
} from "@/lib/legal";

export const metadata = {
  title: "Terms of Service - AgentifyAI",
};

const termsSections = [
  {
    id: "study-use",
    title: "Study-first use",
    body:
      "AgentifyAI is provided as an AI learning workspace for study support, revision, practice, exam preparation, progress tracking, and related student workflows. You agree to use it for lawful learning activity and not to disrupt, scrape, abuse, reverse engineer, or overload the service.",
  },
  {
    id: "acceptable-use",
    title: "Acceptable use",
    body:
      "Do not upload content you do not have the right to use, attempt to bypass security, impersonate another person, submit harmful instructions, use the service to cheat in live assessments, or rely on generated answers as a substitute for your own exam work.",
  },
  {
    id: "ai-guidance",
    title: "AI-generated educational content",
    body:
      "AI answers, summaries, missions, quizzes, citations, and feedback are educational guidance. They can be incomplete or incorrect. Students should verify important work with source material, teachers, guardians, or official curriculum resources before relying on it.",
  },
  {
    id: "accounts",
    title: "Accounts and security",
    body:
      "You are responsible for activity under your account and for keeping sign-in access secure. If you believe your account was accessed without permission, contact support promptly so access and related study data can be reviewed.",
  },
  {
    id: "uploads",
    title: "Uploaded material and study data",
    body:
      "When you upload notes, papers, answers, prompts, or other study material, you give AgentifyAI permission to process that content to provide tutoring, retrieval, analytics, evaluation, and progress features for your account.",
  },
  {
    id: "changes",
    title: "Changes and availability",
    body:
      "AgentifyAI may update features, safety rules, models, limits, or these terms as the product improves. If changes materially affect student rights or responsibilities, the updated effective date will be shown on this page.",
  },
] as const;

export default function TermsPage() {
  return (
    <main id="main-content" className="min-h-[100dvh] bg-[radial-gradient(circle_at_12%_0%,rgba(20,184,166,0.14),transparent_32%),radial-gradient(circle_at_88%_10%,rgba(242,184,75,0.12),transparent_28%),var(--agentify-bg)] px-5 py-8 text-[var(--agentify-primary-text)] sm:px-8">
      <section className="mx-auto w-full max-w-5xl">
        <nav className="flex flex-wrap items-center justify-between gap-3 py-2 text-sm">
          <Link href="/login" className="font-semibold text-[#0E7490] hover:underline">
            Back to sign in
          </Link>
          <Link href="/privacy" className="font-semibold text-[var(--agentify-muted-text)] hover:text-[#0E7490]">
            Privacy Policy
          </Link>
        </nav>

        <header className="pt-12">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#0E7490]">
            AgentifyAI terms
          </p>
          <h1 className="mt-4 max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl">
            Terms of Service
          </h1>
          <p className="mt-4 text-sm font-semibold text-[var(--agentify-muted-text)]">
            Effective {LEGAL_EFFECTIVE_DATE}
          </p>
          <p className="mt-5 max-w-3xl text-sm leading-7 text-[var(--agentify-muted-text)] sm:text-base">
            These terms explain how students may use AgentifyAI and how the product treats AI-generated study support.
            They are written to keep the learning workspace safe, honest, and useful.
          </p>
        </header>

        <div className="mt-10 grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <section className="space-y-4" aria-label="Terms sections">
            {termsSections.map((section) => (
              <article
                key={section.id}
                id={section.id}
                className="rounded-[1.5rem] border border-[var(--agentify-border)] bg-[var(--agentify-card-bg)] p-5 shadow-[0_18px_52px_rgba(15,23,42,0.08)] backdrop-blur-xl"
              >
                <h2 className="text-lg font-semibold tracking-tight">{section.title}</h2>
                <p className="mt-3 text-sm leading-7 text-[var(--agentify-muted-text)]">
                  {section.body}
                </p>
              </article>
            ))}
          </section>

          <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
            <div className="rounded-[1.5rem] border border-[#14B8A6]/25 bg-[#14B8A6]/10 p-5">
              <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-[#0E7490]">
                Student commitments
              </h2>
              <ul className="mt-4 space-y-3 text-sm leading-6 text-[var(--agentify-muted-text)]">
                {STUDENT_PRIVACY_COMMITMENTS.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>

            <div className="rounded-[1.5rem] border border-[var(--agentify-border)] bg-[var(--agentify-card-bg)] p-5">
              <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-[var(--agentify-muted-text)]">
                Account and data requests
              </h2>
              <div className="mt-4 space-y-3">
                {DATA_REQUEST_LINKS.map((item) => (
                  <a
                    key={item.label}
                    href={item.href}
                    className="block rounded-2xl border border-[var(--agentify-border)] bg-white/[0.04] p-4 transition hover:border-[#0E7490]/35"
                  >
                    <span className="text-sm font-semibold text-[var(--agentify-primary-text)]">
                      {item.label}
                    </span>
                    <span className="mt-1 block text-xs leading-5 text-[var(--agentify-muted-text)]">
                      {item.detail}
                    </span>
                  </a>
                ))}
              </div>
            </div>

            <p className="rounded-[1.5rem] border border-amber-300/25 bg-amber-300/10 p-4 text-xs leading-6 text-[var(--agentify-muted-text)]">
              Questions about these terms can be sent to{" "}
              <a className="font-semibold text-[#0E7490] hover:underline" href={`mailto:${SUPPORT_EMAIL}`}>
                {SUPPORT_EMAIL}
              </a>
              .
            </p>
          </aside>
        </div>
      </section>
    </main>
  );
}
