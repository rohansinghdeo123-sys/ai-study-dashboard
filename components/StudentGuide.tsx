"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

type GuideItem = {
  step: string;
  title: string;
  href: string;
  detail: string;
  bestFor: string;
};

const GUIDE_ITEMS: GuideItem[] = [
  {
    step: "01",
    title: "Dashboard",
    href: "/dashboard?workspace=overview",
    detail: "See your level, XP, streak, accuracy, weak areas, recent sessions, and the next study move.",
    bestFor: "Checking where you stand today.",
  },
  {
    step: "02",
    title: "Study Page",
    href: "/dashboard/study",
    detail: "Ask doubts, get simple explanations, generate revision notes, make key points, and practice exam questions.",
    bestFor: "Learning a topic when something feels confusing.",
  },
  {
    step: "03",
    title: "Autonomous Mission",
    href: "/dashboard/mission",
    detail: "Pick a chapter and topic. AgentifyAI creates a guided plan, gives a question, checks your answer, and suggests what to do next.",
    bestFor: "Starting focused study without deciding everything yourself.",
  },
  {
    step: "04",
    title: "Sessions",
    href: "/dashboard/sessions",
    detail: "Review previous attempts, replay mistakes, and continue learning from a topic you already practiced.",
    bestFor: "Improving after a quiz or mission.",
  },
  {
    step: "05",
    title: "Analytics",
    href: "/dashboard/progress",
    detail: "Explore deeper performance, topic trends, rankings, activity, study time, and weak-topic signals.",
    bestFor: "Planning longer-term improvement.",
  },
];

function GuideStep({ item, onNavigate }: { item: GuideItem; onNavigate: () => void }) {
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      className="student-guide-card group rounded-2xl border border-slate-200 bg-white/80 p-4 text-left shadow-[0_12px_34px_rgba(15,23,42,0.06)] transition hover:-translate-y-0.5 hover:border-[#0E7490]/30 hover:bg-white hover:shadow-[0_18px_48px_rgba(14,116,144,0.10)]"
    >
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#0E7490]/10 text-xs font-bold text-[#0E7490]">
          {item.step}
        </span>
        <span className="min-w-0">
          <span className="block text-base font-semibold text-slate-950">{item.title}</span>
          <span className="mt-1 block text-sm leading-6 text-slate-500">{item.detail}</span>
          <span className="mt-3 block rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600">
            {item.bestFor}
          </span>
        </span>
      </div>
    </Link>
  );
}

export default function StudentGuide({ isAdmin = false }: { isAdmin?: boolean }) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const trigger = triggerRef.current;
    closeRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;

      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      );
      if (!focusable.length) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      trigger?.focus();
    };
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="agentify-action dashboard-nav-card rounded-2xl border border-white/70 bg-white/80 px-3 py-2 text-xs font-semibold text-slate-600 shadow-[0_18px_60px_rgba(15,23,42,0.08)] backdrop-blur-2xl transition hover:-translate-y-0.5 hover:text-[#0E7490]"
      >
        Guide
      </button>

      {open ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="student-guide-title"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
          className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/40 p-3 backdrop-blur-sm sm:p-6"
        >
          <div ref={dialogRef} className="student-guide-panel max-h-[calc(100svh-32px)] w-full max-w-5xl overflow-y-auto rounded-[2rem] border border-white/70 bg-[#F8FAFC]/95 shadow-[0_34px_120px_rgba(15,23,42,0.24)] backdrop-blur-2xl">
            <div className="student-guide-header sticky top-0 z-10 border-b border-slate-200/80 bg-white/90 px-5 py-4 backdrop-blur-xl sm:px-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#0E7490]">Student guide</p>
                  <h2 id="student-guide-title" className="mt-2 text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">
                    How to use AgentifyAI
                  </h2>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                    Start from the hub, choose one card, and come back here whenever you are unsure where to go next.
                  </p>
                </div>
                <button
                  ref={closeRef}
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Close guide"
                  className="agentify-action rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 transition hover:border-[#0E7490]/30 hover:text-[#0E7490]"
                >
                  Close
                </button>
              </div>
            </div>

            <div className="grid gap-5 p-5 sm:p-6 lg:grid-cols-[0.9fr_1.1fr]">
              <section className="student-guide-card rounded-3xl border border-white/70 bg-white/75 p-5 shadow-[0_18px_54px_rgba(15,23,42,0.08)]">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Simple route</p>
                <h3 className="mt-3 text-xl font-semibold text-slate-950">A good study flow</h3>
                <div className="mt-5 space-y-3">
                  {[
                    ["1", "Start with Mission", "Let the app create a focused plan and diagnostic question."],
                    ["2", "Use Study Page", "Ask anything that was confusing in the mission."],
                    ["3", "Check Sessions", "Review what you got wrong and try again later."],
                    ["4", "Open Dashboard", "See if your XP, streak, and accuracy improved."],
                  ].map(([step, title, detail]) => (
                    <div key={step} className="student-guide-soft-card flex gap-3 rounded-2xl border border-slate-200 bg-slate-50/80 p-3">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#0E7490] text-xs font-bold text-white">
                        {step}
                      </span>
                      <span>
                        <span className="block text-sm font-semibold text-slate-900">{title}</span>
                        <span className="mt-1 block text-xs leading-5 text-slate-500">{detail}</span>
                      </span>
                    </div>
                  ))}
                </div>

                <div className="student-guide-info mt-5 rounded-2xl border border-[#0E7490]/20 bg-[#0E7490]/10 p-4">
                  <p className="text-sm font-semibold text-slate-950">Top bar shortcuts</p>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    Home hub returns to the 4-section grid. Analytics opens deeper progress. Theme changes light or dark mode. Log out safely exits your account.
                  </p>
                  {isAdmin ? (
                    <p className="mt-2 text-sm leading-6 text-amber-700">
                      Ops is only for admins and is hidden from regular student accounts.
                    </p>
                  ) : null}
                </div>
              </section>

              <section className="grid gap-3">
                {GUIDE_ITEMS.map((item) => (
                  <GuideStep key={item.title} item={item} onNavigate={() => setOpen(false)} />
                ))}
              </section>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
