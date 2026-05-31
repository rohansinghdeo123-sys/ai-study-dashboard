"use client";

import { useAuth } from "@/context/AuthContext";
import { LoadingState } from "@/components/ui/Polished";
import { apiJson } from "@/lib/apiClient";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
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
    <div className="rounded-[1.5rem] border border-white/60 bg-white/70 p-5 shadow-[0_18px_55px_rgba(15,23,42,0.08)] backdrop-blur-2xl">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{label}</p>
      <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">{value}</p>
      <p className="mt-2 text-sm text-slate-500">{helper}</p>
    </div>
  );
}

type HubIconName = "dashboard" | "study" | "mission" | "sessions";

function HubIcon({ name }: { name: HubIconName }) {
  if (name === "dashboard") {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24" className="h-6 w-6">
        <path d="M4 5.5A1.5 1.5 0 0 1 5.5 4h4A1.5 1.5 0 0 1 11 5.5v4A1.5 1.5 0 0 1 9.5 11h-4A1.5 1.5 0 0 1 4 9.5v-4Z" />
        <path d="M13 5.5A1.5 1.5 0 0 1 14.5 4h4A1.5 1.5 0 0 1 20 5.5v4a1.5 1.5 0 0 1-1.5 1.5h-4A1.5 1.5 0 0 1 13 9.5v-4Z" />
        <path d="M4 14.5A1.5 1.5 0 0 1 5.5 13h4a1.5 1.5 0 0 1 1.5 1.5v4A1.5 1.5 0 0 1 9.5 20h-4A1.5 1.5 0 0 1 4 18.5v-4Z" />
        <path d="M13 14.5a1.5 1.5 0 0 1 1.5-1.5h4a1.5 1.5 0 0 1 1.5 1.5v4a1.5 1.5 0 0 1-1.5 1.5h-4a1.5 1.5 0 0 1-1.5-1.5v-4Z" />
      </svg>
    );
  }

  if (name === "study") {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24" className="h-6 w-6">
        <path d="M5 6.5A2.5 2.5 0 0 1 7.5 4h9A2.5 2.5 0 0 1 19 6.5v6A2.5 2.5 0 0 1 16.5 15H12l-4.5 4v-4A2.5 2.5 0 0 1 5 12.5v-6Z" />
        <path d="M8 8h8M8 11h5" />
      </svg>
    );
  }

  if (name === "mission") {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24" className="h-6 w-6">
        <path d="M12 21a9 9 0 1 0-9-9" />
        <path d="M12 17a5 5 0 1 0-5-5" />
        <path d="M12 13a1 1 0 1 0-1-1" />
        <path d="M4 20 12 12M4 20h4M4 20v-4" />
      </svg>
    );
  }

  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-6 w-6">
      <path d="M12 8v5l3 2" />
      <path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3" />
      <path d="M4.5 5.5v4h4" />
    </svg>
  );
}

function HubTile({
  href,
  eyebrow,
  title,
  description,
  helper,
  action,
  icon,
  tone,
}: {
  href: string;
  eyebrow: string;
  title: string;
  description: string;
  helper: string;
  action: string;
  icon: HubIconName;
  tone: "teal" | "gold" | "study" | "mission";
}) {
  const toneClass =
    tone === "gold"
      ? "from-[#FFF8E7] via-[#FFF0C8] to-[#FFE3A3] text-[#744900]"
      : tone === "mission"
        ? "from-[#ECFDF5] via-[#E5FAF3] to-[#CDEFE5] text-[#075F54]"
        : tone === "study"
        ? "from-[#F1FBFF] via-[#E7F8F6] to-[#C9F0EC] text-[#0B5363]"
        : "from-[#EAFDFC] via-[#DFF8F3] to-[#D5F0EA] text-[#0E5264]";

  return (
    <Link
      href={href}
      aria-label={`${title}: ${description}`}
      className={`hub-tile hub-tile--${tone} group relative min-h-[238px] overflow-hidden bg-gradient-to-br ${toneClass} p-6 outline-none sm:p-7`}
    >
      <div className="hub-tile-glow absolute right-[-3.5rem] top-[-3.5rem] h-36 w-36 rounded-full bg-white/28 blur-2xl transition duration-500 group-hover:scale-110" />
      <div className="hub-tile-content relative z-20 flex h-full flex-col">
        <div className="hub-tile-top flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] opacity-70">{eyebrow}</p>
            <h2 className="mt-4 text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h2>
          </div>
          <span className="hub-tile-icon flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/50 bg-white/40 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)]">
            <HubIcon name={icon} />
          </span>
        </div>

        <p className="hub-tile-description mt-4 max-w-sm text-sm leading-6 opacity-[0.78]">{description}</p>
        <div className="hub-tile-footer mt-auto pt-7">
          <div className="flex items-end justify-between gap-4">
            <span className="hub-tile-helper min-w-0 text-xs font-semibold leading-5 opacity-[0.68]">{helper}</span>
            <span className="hub-tile-action inline-flex shrink-0 items-center rounded-full border border-white/60 bg-white/48 px-4 py-2 text-sm font-semibold shadow-[inset_0_1px_0_rgba(255,255,255,0.72),0_10px_24px_rgba(15,23,42,0.08)] backdrop-blur-xl">
              {action}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}

export default function DashboardPage() {
  const { user, userId, loading, claimsLoading, isAdmin, getAuthHeaders } = useAuth();
  const searchParams = useSearchParams();
  const backendURL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://127.0.0.1:8000";

  const [progress, setProgress] = useState<ProgressState>({ total_tests: 0, total_questions: 0, total_correct: 0, xp: 0, streak: 0 });
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [weakAreas, setWeakAreas] = useState<WeakArea[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  const displayName = user?.displayName || user?.email?.split("@")[0] || "Student";
  const firstName = displayName.split(" ")[0] || "Student";
  const showOverview = searchParams.get("workspace") === "overview";
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
    if (loading || claimsLoading || !userId) return;
    let active = true;

    async function loadDashboard() {
      setLoadingData(true);
      try {
        const headers = await getAuthHeaders();
        const [progressJson, sessionsJson, leaderboardJson, analyticsJson] = await Promise.all([
          apiJson<unknown>(`${backendURL}/get-progress/${userId}`, {
            headers,
            cacheKey: `progress:${userId}`,
            cacheTtlMs: 30000,
            retries: 1,
            timeoutMs: 7000,
          }).catch(() => null),
          apiJson<unknown>(`${backendURL}/sessions/${userId}`, {
            headers,
            cacheKey: `sessions:${userId}`,
            cacheTtlMs: 30000,
            retries: 1,
            timeoutMs: 7000,
          }).catch(() => null),
          apiJson<unknown>(`${backendURL}/leaderboard`, {
            headers,
            cacheKey: "leaderboard",
            cacheTtlMs: 45000,
            retries: 1,
            timeoutMs: 7000,
          }).catch(() => null),
          apiJson<unknown>(`${backendURL}/analytics/${userId}`, {
            headers,
            cacheKey: `analytics:${userId}`,
            cacheTtlMs: 30000,
            retries: 1,
            timeoutMs: 7000,
          }).catch(() => null),
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
      <LoadingState title="Preparing dashboard..." detail="Loading your hub, progress signals, and next best study move." />
    );
  }

  if (!showOverview) {
    return (
      <div className="w-full">
        <section className="flex min-h-[calc(100svh-118px)] flex-col items-center justify-center gap-8 py-8">
          <div className="max-w-3xl text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.26em] text-[#0E7490]">Learning Hub</p>
            <h1 className="mt-4 text-4xl font-semibold tracking-tight text-slate-950 sm:text-6xl">
              Good to see you, {firstName}
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-slate-500">
              Pick one section from the hub. Each card opens a focused learning space, and the Guide button explains the whole app.
            </p>
          </div>

          <div className="relative w-full max-w-[1180px] px-1 sm:px-4">
            <div className="hub-grid grid overflow-visible rounded-[3rem] border border-white/70 bg-white/60 shadow-[0_36px_120px_rgba(15,23,42,0.14)] backdrop-blur-2xl md:grid-cols-2">
              <HubTile
                href="/dashboard?workspace=overview"
                eyebrow="Overview"
                title="Dashboard"
                description="Check your level, XP, accuracy, streak, weak areas, and today's best next step."
                helper="Best for a quick check-in"
                action="View progress"
                icon="dashboard"
                tone="teal"
              />
              <HubTile
                href="/dashboard/study"
                eyebrow="Ask"
                title="Study Page"
                description="Ask doubts, get examples, create revision notes, and practice exam-style questions."
                helper="Best when you are stuck"
                action="Ask a doubt"
                icon="study"
                tone="study"
              />
              <HubTile
                href="/dashboard/mission"
                eyebrow="Improve"
                title="Autonomous Mission"
                description="Choose a chapter and let AgentifyAI plan, quiz, explain, and guide your next move."
                helper="Best for guided study"
                action="Start mission"
                icon="mission"
                tone="mission"
              />
              <HubTile
                href="/dashboard/sessions"
                eyebrow="Review"
                title="Sessions"
                description="Replay past attempts, review answers, and learn from mistakes before the next test."
                helper="Best after practice"
                action="Review work"
                icon="sessions"
                tone="gold"
              />
            </div>
          </div>

          <div className="w-full max-w-3xl rounded-[1.7rem] border border-white/70 bg-white/70 p-5 text-center shadow-[0_18px_60px_rgba(15,23,42,0.08)] backdrop-blur-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Today&apos;s focus</p>
            <p className="mt-3 text-2xl font-semibold text-slate-950">{focusMessage}</p>
            <div className="mx-auto mt-5 h-2 max-w-xl rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-[linear-gradient(90deg,#0E7490,#14B8A6,#F2B84B)] transition-all" style={{ width: `${Math.max(6, Math.min(100, accuracyValue || 6))}%` }} />
            </div>
          </div>
        </section>

      </div>
    );
  }

  return (
    <div className="w-full space-y-5">
      <section className="rounded-[2rem] border border-white/70 bg-white/74 p-5 shadow-[0_24px_90px_rgba(15,23,42,0.10)] backdrop-blur-2xl">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#0E7490]">Dashboard workspace</p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-950">Learning overview</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500">
              A focused overview of progress, weak areas, rankings, and the next best study move.
            </p>
          </div>
          <Link href="/dashboard" className="agentify-action agentify-action-secondary rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-sm font-semibold text-slate-600 transition hover:border-[#0E7490]/30 hover:text-[#0E7490]">
            Back to hub
          </Link>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        <MetricCard label="Level" value={`LVL ${level}`} helper="Based on XP earned" />
        <MetricCard label="Accuracy" value={`${accuracyValue}%`} helper="All recorded questions" />
        <MetricCard label="Streak" value={`${progress.streak}d`} helper="Learning momentum" />
        <MetricCard label="XP" value={progress.xp} helper={loadingData ? "Updating..." : "Current progress"} />
      </section>

      <section className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-[2rem] border border-white/60 bg-white/72 p-5 shadow-[0_22px_80px_rgba(15,23,42,0.08)] backdrop-blur-2xl">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">How to use AgentifyAI</p>
              <h2 className="mt-2 text-xl font-semibold text-slate-950">Three simple moves</h2>
            </div>
            <Link href="/dashboard/mission" className="agentify-action rounded-full bg-[#0E7490]/10 px-3 py-2 text-xs font-semibold text-[#0E7490]">
              Guided start
            </Link>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            {[
              ["1", "Ask a doubt", "Use Study when you want a clear explanation."],
              ["2", "Run mission", "Use Mission when you want the app to choose the next step."],
              ["3", "Review result", "Use Sessions to learn from wrong answers."],
            ].map(([step, title, body]) => (
              <div key={step} className="rounded-3xl border border-slate-200 bg-white/65 p-4">
                <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[#0E7490] text-sm font-bold text-white">{step}</span>
                <h3 className="mt-4 text-sm font-semibold text-slate-950">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-500">{body}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[2rem] border border-white/60 bg-white/72 p-5 shadow-[0_22px_80px_rgba(15,23,42,0.08)] backdrop-blur-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Weak areas</p>
          <h2 className="mt-2 text-xl font-semibold text-slate-950">What to repair next</h2>
          <div className="mt-5 space-y-3">
            {weakAreas.length ? weakAreas.map((area, index) => {
              const score = Math.round(toNumber(area.accuracy ?? area.value));
              return (
                <div key={`${area.topic}-${index}`} className="rounded-2xl border border-slate-200 bg-white/65 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold capitalize text-slate-900">{formatTopic(area.topic)}</p>
                    <span className="text-sm font-bold text-[#0E7490]">{score}%</span>
                  </div>
                  <div className="mt-3 h-1.5 rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-[#14B8A6]" style={{ width: `${Math.max(5, Math.min(100, score))}%` }} />
                  </div>
                </div>
              );
            }) : (
              <p className="rounded-2xl border border-slate-200 bg-white/65 p-4 text-sm leading-6 text-slate-500">
                Complete one mission to unlock weak-topic signals.
              </p>
            )}
          </div>
        </div>
      </section>

      <section className="rounded-[2rem] border border-white/60 bg-white/62 p-5 shadow-[0_18px_60px_rgba(15,23,42,0.07)] backdrop-blur-2xl">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Advanced tools</p>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Kept out of the main path so students can focus, but still available when needed.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/dashboard/progress" className="agentify-action agentify-action-secondary rounded-full border border-slate-200 bg-white/70 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:border-[#0E7490]/30 hover:text-[#0E7490]">
              Analytics
            </Link>
            {isAdmin ? (
              <Link href="/dashboard/internal/ops" className="agentify-action rounded-full border border-amber-300/30 bg-amber-300/10 px-4 py-2 text-sm font-semibold text-amber-700 transition hover:bg-amber-300/15">
                Ops
              </Link>
            ) : null}
          </div>
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-2">
        <div className="rounded-[2rem] border border-white/60 bg-white/72 p-5 shadow-[0_22px_80px_rgba(15,23,42,0.08)] backdrop-blur-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Recent sessions</p>
          <div className="mt-5 space-y-3">
            {recentSessions.length ? recentSessions.map((session, index) => (
              <div key={session.id ?? index} className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white/65 p-4">
                <div>
                  <p className="text-sm font-semibold capitalize text-slate-900">{formatTopic(session.topic)}</p>
                  <p className="mt-1 text-xs text-slate-500">{getSessionDate(session)}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-[#0E7490]">{toNumber(session.score ?? session.correct)}/{toNumber(session.total_questions ?? session.questions)}</p>
                  <p className="mt-1 text-xs text-slate-500">{toNumber(session.xp_earned ?? session.xp)} XP</p>
                </div>
              </div>
            )) : (
              <p className="rounded-2xl border border-slate-200 bg-white/65 p-4 text-sm text-slate-500">
                No sessions yet. Start a mission to create your first record.
              </p>
            )}
          </div>
        </div>

        <div className="rounded-[2rem] border border-white/60 bg-white/72 p-5 shadow-[0_22px_80px_rgba(15,23,42,0.08)] backdrop-blur-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Leaderboard</p>
          <div className="mt-5 space-y-3">
            {leaderboard.length ? leaderboard.map((entry, index) => (
              <div key={entry.user_id || index} className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white/65 p-4">
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[#0E7490]/10 text-sm font-bold text-[#0E7490]">#{index + 1}</span>
                  <p className="text-sm font-semibold text-slate-900">{getDisplayName(entry, `Student ${index + 1}`)}</p>
                </div>
                <p className="text-sm font-bold text-[#0E7490]">{toNumber(entry.xp)} XP</p>
              </div>
            )) : (
              <p className="rounded-2xl border border-slate-200 bg-white/65 p-4 text-sm text-slate-500">
                Rankings will appear after students earn XP.
              </p>
            )}
          </div>
        </div>
      </section>

    </div>
  );
}
