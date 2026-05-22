"use client";

import AgentifiedNotification from "@/components/AgentifiedNotification";
import { useAuth } from "@/context/AuthContext";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

interface ProgressState {
  total_tests: number;
  total_questions: number;
  total_correct: number;
  xp: number;
  streak: number;
}

interface SessionRecord {
  id?: string | number;
  topic?: string;
  subject?: string;
  score?: number;
  correct?: number;
  total_questions?: number;
  questions?: number;
  xp_earned?: number;
  xp?: number;
  timestamp?: string;
  date?: string;
  createdAt?: string;
}

interface LeaderboardEntry {
  user_id: string;
  display_name?: string;
  name?: string;
  email?: string;
  phone?: string;
  xp?: number;
}

interface WeakArea {
  topic?: string;
  accuracy?: number;
  value?: number;
}

function toNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizeProgress(value: unknown): ProgressState {
  const source = isRecord(value) ? value : {};
  const summary = isRecord(source.summary) ? source.summary : source;
  return {
    total_tests: toNumber(summary.total_tests ?? summary.totalTests ?? summary.sessions),
    total_questions: toNumber(summary.total_questions ?? summary.totalQuestions ?? summary.total_mcqs_attempted),
    total_correct: toNumber(summary.total_correct ?? summary.totalCorrect),
    xp: toNumber(summary.xp ?? summary.total_xp),
    streak: toNumber(summary.streak),
  };
}

function normalizeSessions(value: unknown): SessionRecord[] {
  if (Array.isArray(value)) return value.filter(Boolean) as SessionRecord[];
  if (isRecord(value) && Array.isArray(value.sessions)) return value.sessions.filter(Boolean) as SessionRecord[];
  return [];
}

function normalizeLeaderboard(value: unknown): LeaderboardEntry[] {
  if (!Array.isArray(value)) return [];
  return value.filter(Boolean).map((item) => item as LeaderboardEntry).slice(0, 3);
}

function normalizeWeakAreas(value: unknown): WeakArea[] {
  const source = isRecord(value) ? value : {};
  const weak = Array.isArray(source.weak_areas) ? source.weak_areas : [];
  const heatmap = Array.isArray(source.topic_heatmap) ? source.topic_heatmap : [];
  return [...weak, ...heatmap].filter(Boolean).slice(0, 3) as WeakArea[];
}

function accuracy(progress: ProgressState) {
  if (!progress.total_questions) return 0;
  return Math.round((progress.total_correct / progress.total_questions) * 100);
}

function formatTopic(value?: string) {
  return (value || "Study topic").replace(/_/g, " ");
}

function getSessionDate(session: SessionRecord) {
  const raw = session.timestamp || session.date || session.createdAt;
  if (!raw) return "No date";
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return "No date";
  return parsed.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
}

function getDisplayName(entry: LeaderboardEntry, fallback: string) {
  return entry.display_name || entry.name || entry.email || entry.phone || fallback;
}

function MetricCard({ label, value, helper }: { label: string; value: string | number; helper: string }) {
  return (
    <div className="rounded-[1.5rem] border border-white/60 bg-white/70 p-5 shadow-[0_18px_55px_rgba(15,23,42,0.08)] backdrop-blur-2xl dark:border-white/10 dark:bg-white/[0.05]">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{label}</p>
      <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 dark:text-white">{value}</p>
      <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{helper}</p>
    </div>
  );
}

function ActionCard({
  href,
  eyebrow,
  title,
  description,
  tone,
}: {
  href: string;
  eyebrow: string;
  title: string;
  description: string;
  tone: "teal" | "gold" | "navy";
}) {
  const toneClass =
    tone === "gold"
      ? "from-[#FFF4D8] to-[#FFE8AE] text-[#7A4B00]"
      : tone === "navy"
        ? "from-[#0F172A] to-[#0E7490] text-white"
        : "from-[#E6FFFB] to-[#D8F6EF] text-[#0E5264]";

  return (
    <Link
      href={href}
      className={`group relative overflow-hidden rounded-[2rem] bg-gradient-to-br ${toneClass} p-6 shadow-[0_24px_80px_rgba(15,23,42,0.10)] transition hover:-translate-y-1 hover:shadow-[0_30px_90px_rgba(15,23,42,0.16)]`}
    >
      <div className="absolute right-[-3rem] top-[-3rem] h-36 w-36 rounded-full bg-white/32 blur-2xl transition group-hover:scale-125" />
      <p className="relative text-xs font-bold uppercase tracking-[0.22em] opacity-70">{eyebrow}</p>
      <h2 className="relative mt-5 text-2xl font-semibold tracking-tight">{title}</h2>
      <p className="relative mt-3 max-w-sm text-sm leading-6 opacity-75">{description}</p>
      <span className="relative mt-8 inline-flex rounded-full bg-white/30 px-4 py-2 text-sm font-semibold backdrop-blur-xl">
        Open
      </span>
    </Link>
  );
}

export default function DashboardPage() {
  const { user, userId, loading, claimsLoading, isAdmin, getAuthHeaders } = useAuth();
  const backendURL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://127.0.0.1:8000";

  const [progress, setProgress] = useState<ProgressState>({ total_tests: 0, total_questions: 0, total_correct: 0, xp: 0, streak: 0 });
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [weakAreas, setWeakAreas] = useState<WeakArea[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [showAgentNotification, setShowAgentNotification] = useState(false);

  const displayName = user?.displayName || user?.email?.split("@")[0] || "Student";
  const firstName = displayName.split(" ")[0] || "Student";
  const accuracyValue = accuracy(progress);
  const level = Math.floor(progress.xp / 100) + 1;
  const recentSessions = sessions.slice(0, 3);

  const focusMessage = useMemo(() => {
    if (!progress.total_questions) return "Start with one short mission today.";
    if (accuracyValue < 60) return "Focus on clarity before speed.";
    if (accuracyValue < 80) return "You are close. Practice weak spots.";
    return "Strong momentum. Move to exam-style practice.";
  }, [accuracyValue, progress.total_questions]);

  useEffect(() => {
    const seen = localStorage.getItem("agentify-agentified-seen");
    if (!seen) {
      setShowAgentNotification(true);
      localStorage.setItem("agentify-agentified-seen", "true");
    }
  }, []);

  useEffect(() => {
    if (loading || claimsLoading || !userId) return;
    let active = true;

    async function loadDashboard() {
      setLoadingData(true);
      try {
        const headers = await getAuthHeaders();
        const [progressRes, sessionsRes, leaderboardRes, analyticsRes] = await Promise.all([
          fetch(`${backendURL}/get-progress/${userId}`, { cache: "no-store", headers }),
          fetch(`${backendURL}/sessions/${userId}`, { cache: "no-store", headers }),
          fetch(`${backendURL}/leaderboard`, { cache: "no-store", headers }),
          fetch(`${backendURL}/analytics/${userId}`, { cache: "no-store", headers }),
        ]);

        const [progressJson, sessionsJson, leaderboardJson, analyticsJson] = await Promise.all([
          progressRes.ok ? progressRes.json() : null,
          sessionsRes.ok ? sessionsRes.json() : null,
          leaderboardRes.ok ? leaderboardRes.json() : null,
          analyticsRes.ok ? analyticsRes.json() : null,
        ]);

        if (!active) return;
        setProgress(normalizeProgress(progressJson));
        setSessions(normalizeSessions(sessionsJson));
        setLeaderboard(normalizeLeaderboard(leaderboardJson));
        setWeakAreas(normalizeWeakAreas(analyticsJson));
      } catch {
        if (!active) return;
      } finally {
        if (active) setLoadingData(false);
      }
    }

    void loadDashboard();
    return () => {
      active = false;
    };
  }, [backendURL, claimsLoading, getAuthHeaders, loading, userId]);

  if (loading || claimsLoading) {
    return (
      <div className="flex min-h-[70svh] items-center justify-center text-sm text-[#0E7490]">
        Preparing dashboard...
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <section className="relative overflow-hidden rounded-[2.2rem] border border-white/60 bg-white/72 p-6 shadow-[0_28px_100px_rgba(15,23,42,0.10)] backdrop-blur-2xl dark:border-white/10 dark:bg-white/[0.05] sm:p-8">
        <div className="absolute right-[-8rem] top-[-8rem] h-72 w-72 rounded-full bg-[#14B8A6]/18 blur-3xl" />
        <div className="absolute bottom-[-9rem] left-1/3 h-72 w-72 rounded-full bg-[#F2B84B]/16 blur-3xl" />
        <div className="relative grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#0E7490]">Learning Hub</p>
            <h1 className="mt-4 text-4xl font-semibold tracking-tight text-slate-950 dark:text-white sm:text-5xl">
              Good to see you, {firstName}
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-slate-500 dark:text-slate-400">
              Pick one path and start. Study is for open doubts. Mission is for guided improvement. Sessions keep your learning history.
            </p>
          </div>
          <div className="rounded-[1.7rem] border border-white/60 bg-white/68 p-5 shadow-[0_18px_60px_rgba(15,23,42,0.08)] backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.05]">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Today&apos;s focus</p>
            <p className="mt-3 text-2xl font-semibold text-slate-950 dark:text-white">{focusMessage}</p>
            <div className="mt-5 h-2 rounded-full bg-slate-100 dark:bg-white/10">
              <div className="h-full rounded-full bg-[linear-gradient(90deg,#0E7490,#14B8A6,#F2B84B)] transition-all" style={{ width: `${Math.max(6, Math.min(100, accuracyValue || 6))}%` }} />
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <ActionCard
          href="/dashboard/study"
          eyebrow="Ask"
          title="Study with AI"
          description="A full-window tutor chat for doubts, examples, and follow-up explanations."
          tone="navy"
        />
        <ActionCard
          href="/dashboard/mission"
          eyebrow="Improve"
          title="Start Mission"
          description="One focused plan, one diagnostic question, and a personalized next step."
          tone="teal"
        />
        <ActionCard
          href="/dashboard/sessions"
          eyebrow="Review"
          title="See Sessions"
          description="Replay your attempts and understand what improved or needs repair."
          tone="gold"
        />
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        <MetricCard label="Level" value={`LVL ${level}`} helper="Based on XP earned" />
        <MetricCard label="Accuracy" value={`${accuracyValue}%`} helper="All recorded questions" />
        <MetricCard label="Streak" value={`${progress.streak}d`} helper="Learning momentum" />
        <MetricCard label="XP" value={progress.xp} helper={loadingData ? "Updating..." : "Current progress"} />
      </section>

      <section className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-[2rem] border border-white/60 bg-white/72 p-5 shadow-[0_22px_80px_rgba(15,23,42,0.08)] backdrop-blur-2xl dark:border-white/10 dark:bg-white/[0.05]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">How to use AgentifyAI</p>
              <h2 className="mt-2 text-xl font-semibold text-slate-950 dark:text-white">Three simple moves</h2>
            </div>
            <Link href="/dashboard/mission" className="rounded-full bg-[#0E7490]/10 px-3 py-2 text-xs font-semibold text-[#0E7490]">
              Guided start
            </Link>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            {[
              ["1", "Ask a doubt", "Use Study when you want a clear explanation."],
              ["2", "Run mission", "Use Mission when you want the app to choose the next step."],
              ["3", "Review result", "Use Sessions to learn from wrong answers."],
            ].map(([step, title, body]) => (
              <div key={step} className="rounded-3xl border border-slate-200 bg-white/65 p-4 dark:border-white/10 dark:bg-white/[0.03]">
                <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[#0E7490] text-sm font-bold text-white">{step}</span>
                <h3 className="mt-4 text-sm font-semibold text-slate-950 dark:text-white">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">{body}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[2rem] border border-white/60 bg-white/72 p-5 shadow-[0_22px_80px_rgba(15,23,42,0.08)] backdrop-blur-2xl dark:border-white/10 dark:bg-white/[0.05]">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Weak areas</p>
          <h2 className="mt-2 text-xl font-semibold text-slate-950 dark:text-white">What to repair next</h2>
          <div className="mt-5 space-y-3">
            {weakAreas.length ? weakAreas.map((area, index) => {
              const score = Math.round(toNumber(area.accuracy ?? area.value));
              return (
                <div key={`${area.topic}-${index}`} className="rounded-2xl border border-slate-200 bg-white/65 p-4 dark:border-white/10 dark:bg-white/[0.03]">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold capitalize text-slate-900 dark:text-white">{formatTopic(area.topic)}</p>
                    <span className="text-sm font-bold text-[#0E7490]">{score}%</span>
                  </div>
                  <div className="mt-3 h-1.5 rounded-full bg-slate-100 dark:bg-white/10">
                    <div className="h-full rounded-full bg-[#14B8A6]" style={{ width: `${Math.max(5, Math.min(100, score))}%` }} />
                  </div>
                </div>
              );
            }) : (
              <p className="rounded-2xl border border-slate-200 bg-white/65 p-4 text-sm leading-6 text-slate-500 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-400">
                Complete one mission to unlock weak-topic signals.
              </p>
            )}
          </div>
        </div>
      </section>

      <section className="rounded-[2rem] border border-white/60 bg-white/62 p-5 shadow-[0_18px_60px_rgba(15,23,42,0.07)] backdrop-blur-2xl dark:border-white/10 dark:bg-white/[0.04]">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Advanced tools</p>
            <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
              Kept out of the main path so students can focus, but still available when needed.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/dashboard/progress" className="rounded-full border border-slate-200 bg-white/70 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:border-[#0E7490]/30 hover:text-[#0E7490] dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300">
              Analytics
            </Link>
            {isAdmin ? (
              <Link href="/dashboard/internal/ops" className="rounded-full border border-amber-300/30 bg-amber-300/10 px-4 py-2 text-sm font-semibold text-amber-700 transition hover:bg-amber-300/15 dark:text-amber-200">
                Ops
              </Link>
            ) : null}
          </div>
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-2">
        <div className="rounded-[2rem] border border-white/60 bg-white/72 p-5 shadow-[0_22px_80px_rgba(15,23,42,0.08)] backdrop-blur-2xl dark:border-white/10 dark:bg-white/[0.05]">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Recent sessions</p>
          <div className="mt-5 space-y-3">
            {recentSessions.length ? recentSessions.map((session, index) => (
              <div key={session.id ?? index} className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white/65 p-4 dark:border-white/10 dark:bg-white/[0.03]">
                <div>
                  <p className="text-sm font-semibold capitalize text-slate-900 dark:text-white">{formatTopic(session.topic)}</p>
                  <p className="mt-1 text-xs text-slate-500">{getSessionDate(session)}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-[#0E7490]">{toNumber(session.score ?? session.correct)}/{toNumber(session.total_questions ?? session.questions)}</p>
                  <p className="mt-1 text-xs text-slate-500">{toNumber(session.xp_earned ?? session.xp)} XP</p>
                </div>
              </div>
            )) : (
              <p className="rounded-2xl border border-slate-200 bg-white/65 p-4 text-sm text-slate-500 dark:border-white/10 dark:bg-white/[0.03]">
                No sessions yet. Start a mission to create your first record.
              </p>
            )}
          </div>
        </div>

        <div className="rounded-[2rem] border border-white/60 bg-white/72 p-5 shadow-[0_22px_80px_rgba(15,23,42,0.08)] backdrop-blur-2xl dark:border-white/10 dark:bg-white/[0.05]">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Leaderboard</p>
          <div className="mt-5 space-y-3">
            {leaderboard.length ? leaderboard.map((entry, index) => (
              <div key={entry.user_id || index} className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white/65 p-4 dark:border-white/10 dark:bg-white/[0.03]">
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[#0E7490]/10 text-sm font-bold text-[#0E7490]">#{index + 1}</span>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">{getDisplayName(entry, `Student ${index + 1}`)}</p>
                </div>
                <p className="text-sm font-bold text-[#0E7490]">{toNumber(entry.xp)} XP</p>
              </div>
            )) : (
              <p className="rounded-2xl border border-slate-200 bg-white/65 p-4 text-sm text-slate-500 dark:border-white/10 dark:bg-white/[0.03]">
                Rankings will appear after students earn XP.
              </p>
            )}
          </div>
        </div>
      </section>

      {showAgentNotification ? (
        <AgentifiedNotification onDismiss={() => setShowAgentNotification(false)} />
      ) : null}
    </div>
  );
}
