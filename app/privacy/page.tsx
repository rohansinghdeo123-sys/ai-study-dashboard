import Link from "next/link";
import {
  DATA_REQUEST_LINKS,
  LEGAL_EFFECTIVE_DATE,
  SUPPORT_EMAIL,
  STUDENT_PRIVACY_COMMITMENTS,
} from "@/lib/legal";

export const metadata = {
  title: "Privacy Policy - AgentifyAI",
};

const privacySections = [
  {
    title: "Information we collect",
    body:
      "AgentifyAI may collect verified sign-in details from Firebase Auth, display name, class level, onboarding status, study questions, uploaded learning material, generated answers, practice attempts, exam feedback, progress metrics, and basic technical information needed to keep the service reliable.",
  },
  {
    title: "How study data is used",
    body:
      "Study data is used to personalize tutoring, retrieve relevant course material, generate practice, evaluate answers, show progress, power revision queues, protect accounts, debug reliability issues, and improve safety and product quality.",
  },
  {
    title: "AI processing",
    body:
      "Prompts, selected chapters, uploaded material, and conversation context may be sent to AI or retrieval systems to produce educational responses. AgentifyAI should not be used to submit passwords, identity documents, payment details, or private information unrelated to learning.",
  },
  {
    title: "Retention",
    body:
      "Account profile and learning records are retained while the account is active so progress, history, recommendations, and study continuity work across sessions. Support can review export or deletion requests after verifying the account owner.",
  },
  {
    title: "Student and guardian expectations",
    body:
      "Students should use AgentifyAI with appropriate guardian, parent, school, or teacher permission where required. AI feedback is educational support, not a guarantee of marks, exam outcomes, or official academic judgment.",
  },
  {
    title: "Local storage and cookies",
    body:
      "The frontend may use browser storage for theme, drafts, consent state, session UI, and learning-workspace continuity. Firebase and hosting providers may use cookies or similar technologies for authentication and security.",
  },
] as const;

export default function PrivacyPage() {
  return (
    <main id="main-content" className="min-h-[100dvh] bg-[radial-gradient(circle_at_12%_0%,rgba(20,184,166,0.14),transparent_32%),radial-gradient(circle_at_88%_10%,rgba(242,184,75,0.12),transparent_28%),var(--agentify-bg)] px-5 py-8 text-[var(--agentify-primary-text)] sm:px-8">
      <section className="mx-auto w-full max-w-5xl">
        <nav className="flex flex-wrap items-center justify-between gap-3 py-2 text-sm">
          <Link href="/login" className="font-semibold text-[#0E7490] hover:underline">
            Back to sign in
          </Link>
          <Link href="/terms" className="font-semibold text-[var(--agentify-muted-text)] hover:text-[#0E7490]">
            Terms of Service
          </Link>
        </nav>

        <header className="pt-12">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#0E7490]">
            AgentifyAI privacy
          </p>
          <h1 className="mt-4 max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl">
            Privacy Policy
          </h1>
          <p className="mt-4 text-sm font-semibold text-[var(--agentify-muted-text)]">
            Effective {LEGAL_EFFECTIVE_DATE}
          </p>
          <p className="mt-5 max-w-3xl text-sm leading-7 text-[var(--agentify-muted-text)] sm:text-base">
            This policy explains how AgentifyAI handles student profile data, study activity, uploaded material,
            AI interactions, and account requests.
          </p>
        </header>

        <div className="mt-10 grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <section className="space-y-4" aria-label="Privacy sections">
            {privacySections.map((section) => (
              <article
                key={section.title}
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
                Privacy commitments
              </h2>
              <ul className="mt-4 space-y-3 text-sm leading-6 text-[var(--agentify-muted-text)]">
                {STUDENT_PRIVACY_COMMITMENTS.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>

            <div className="rounded-[1.5rem] border border-[var(--agentify-border)] bg-[var(--agentify-card-bg)] p-5">
              <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-[var(--agentify-muted-text)]">
                Your choices
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
              Privacy questions can be sent to{" "}
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
