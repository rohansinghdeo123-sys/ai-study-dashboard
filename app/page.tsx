"use client";

import Link from "next/link";
import { Manrope } from "next/font/google";
import { useAuth } from "@/context/AuthContext";
import ThemeToggle from "@/components/ThemeToggle";
import { AppIcon, type AppIconName } from "@/components/ui/Polished";

const landingFont = Manrope({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-landing",
});

const features = [
  {
    icon: "study" as AppIconName,
    title: "Ask doubts anytime",
    detail: "Chat with an AI coach that answers from your own chapters — not random internet facts.",
  },
  {
    icon: "check" as AppIconName,
    title: "Practice that adapts",
    detail: "Exam-style questions tuned to your level, with instant feedback on every answer.",
  },
  {
    icon: "analytics" as AppIconName,
    title: "See your progress",
    detail: "Streaks, XP, and weak-topic tracking show you exactly what to fix next.",
  },
];

const steps = [
  { step: "01", title: "Plan", detail: "Pick a chapter path", icon: "dashboard" as AppIconName },
  { step: "02", title: "Teach", detail: "Learn it in simple words", icon: "study" as AppIconName },
  { step: "03", title: "Test", detail: "Practice exam questions", icon: "check" as AppIconName },
  { step: "04", title: "Revise", detail: "Fix the exact weak point", icon: "book" as AppIconName },
];

const primaryCta =
  "agentify-action agentify-action-primary inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-transparent bg-[linear-gradient(135deg,#0F172A_0%,#0E7490_46%,#14B8A6_100%)] px-6 py-3 text-base font-semibold text-white shadow-[0_14px_30px_rgba(14,116,144,0.18)] transition-all hover:brightness-110 active:brightness-95";

export default function Home() {
  const { user, loading } = useAuth();
  const signedIn = !loading && !!user;

  return (
    <div className={`login-shell relative min-h-[100dvh] overflow-hidden antialiased ${landingFont.className}`}>
      <div className="login-backdrop" aria-hidden="true" />

      <div className="relative z-10 mx-auto flex min-h-[100dvh] w-full max-w-[80rem] flex-col px-4 pb-10 pt-4 sm:px-6 sm:pt-5 lg:px-10">
        <header className="login-topbar flex items-center justify-between rounded-2xl px-4 py-3 sm:px-5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#0E7490] text-sm font-black text-white">
              A
            </div>
            <div>
              <div className="text-sm font-semibold text-[var(--agentify-primary-text)]">AgentifyAI</div>
              <div className="text-xs text-[var(--agentify-muted-text)]">Private study workspace</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle compact />
            <Link
              href={signedIn ? "/dashboard" : "/login"}
              className="agentify-action agentify-action-secondary inline-flex min-h-10 items-center justify-center rounded-2xl border border-[var(--agentify-border)] bg-[var(--agentify-card-bg)] px-4 py-2 text-sm font-semibold text-[var(--agentify-primary-text)] transition hover:border-[#0E7490]/40"
            >
              {signedIn ? "Open dashboard" : "Sign in"}
            </Link>
          </div>
        </header>

        <main className="flex-1">
          {/* Hero */}
          <section className="mx-auto max-w-[52rem] pt-14 text-center sm:pt-20">
            <div className="login-chip inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-medium text-[var(--agentify-muted-text)]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#14B8A6]" aria-hidden="true" />
              Built for school students who want clear next steps
            </div>

            <h1 className="login-hero-title mt-6 text-4xl font-semibold leading-[1.06] tracking-tight text-[var(--agentify-primary-text)] sm:text-5xl xl:text-[3.75rem]">
              Your AI study companion for school.
            </h1>

            <p className="mx-auto mt-5 max-w-[38rem] text-base leading-7 text-[var(--agentify-muted-text)] sm:text-lg sm:leading-8">
              AgentifyAI helps you ask doubts, revise chapters, practice questions, and always know
              what to do next — without feeling lost.
            </p>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link href={signedIn ? "/dashboard" : "/login"} className={primaryCta}>
                {signedIn ? "Continue learning" : "Start learning"}
                <AppIcon name="arrowRight" className="h-4 w-4" />
              </Link>
              <a
                href="#how-it-works"
                className="login-chip inline-flex min-h-12 items-center justify-center rounded-2xl px-5 py-3 text-base font-semibold text-[var(--agentify-primary-text)] transition hover:border-[#0E7490]/40"
              >
                See how it works
              </a>
            </div>
          </section>

          {/* Features */}
          <section aria-label="What you get" className="mx-auto mt-16 grid max-w-[64rem] gap-4 sm:mt-20 sm:grid-cols-3">
            {features.map((feature) => (
              <div key={feature.title} className="login-card rounded-3xl p-6">
                <span className="login-step-icon flex h-10 w-10 items-center justify-center rounded-xl">
                  <AppIcon name={feature.icon} className="h-5 w-5" />
                </span>
                <h2 className="mt-4 text-lg font-semibold tracking-tight text-[var(--agentify-primary-text)]">
                  {feature.title}
                </h2>
                <p className="mt-2 text-sm leading-6 text-[var(--agentify-muted-text)]">{feature.detail}</p>
              </div>
            ))}
          </section>

          {/* How it works */}
          <section id="how-it-works" className="mx-auto mt-16 max-w-[64rem] scroll-mt-8 sm:mt-20">
            <div className="login-card rounded-3xl p-6 sm:p-8">
              <div className="login-gold-eyebrow text-[11px] font-semibold uppercase tracking-[0.18em]">
                How it works
              </div>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[var(--agentify-primary-text)]">
                One chapter becomes a clear study path.
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--agentify-muted-text)]">
                The journey stays simple: choose a topic, learn it, test it, then revise the exact weak point.
              </p>

              <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
                {steps.map((item) => (
                  <div key={item.title} className="login-step rounded-2xl p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-[var(--agentify-muted-text)]">{item.step}</span>
                      <span className="login-step-icon flex h-8 w-8 items-center justify-center rounded-xl">
                        <AppIcon name={item.icon} />
                      </span>
                    </div>
                    <div className="mt-3 text-sm font-semibold text-[var(--agentify-primary-text)]">{item.title}</div>
                    <div className="mt-1 text-xs leading-5 text-[var(--agentify-muted-text)]">{item.detail}</div>
                  </div>
                ))}
              </div>

              <div className="mt-7 flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-[var(--agentify-muted-text)]">
                  Free to start. Your progress stays private to you.
                </p>
                <Link href={signedIn ? "/dashboard" : "/login"} className={primaryCta}>
                  {signedIn ? "Open your dashboard" : "Get started"}
                  <AppIcon name="arrowRight" className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </section>
        </main>

        <footer className="mt-14 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--agentify-border)] pt-6 text-xs text-[var(--agentify-muted-text)]">
          <span>© {new Date().getFullYear()} AgentifyAI — your private study workspace.</span>
          <Link href="/login" className="font-semibold text-[var(--agentify-accent)] hover:underline">
            Sign in
          </Link>
        </footer>
      </div>
    </div>
  );
}
