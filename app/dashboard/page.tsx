"use client";

import { useAuth } from "@/context/AuthContext";
import { AlertState, AppIcon, LoadingSkeleton, LoadingState, type AppIconName } from "@/components/ui/Polished";
import { apiJson, ensureBackendReady, invalidateApiCache } from "@/lib/apiClient";
import Link from "next/link";
import { Fraunces, Manrope } from "next/font/google";
import { useEffect, useMemo, useState } from "react";

const uiFont = Manrope({ subsets: ["latin"], display: "swap" });
const displayFont = Fraunces({
  subsets: ["latin"],
  display: "swap",
  style: ["normal", "italic"],
  weight: ["400", "500", "600"],
});

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

function greetingForHour(hour: number) {
  if (hour >= 5 && hour < 12) return "Good morning";
  if (hour >= 12 && hour < 17) return "Good afternoon";
  if (hour >= 17 && hour < 22) return "Good evening";
  return "Late-night focus";
}

const spaces: Array<{
  href: string;
  icon: AppIconName;
  tone: string;
  title: string;
  description: string;
  hint: string;
}> = [
  {
    href: "/dashboard/study",
    icon: "study",
    tone: "dash-space--mint",
    title: "Study Lab",
    description: "Ask doubts, get worked examples, and build revision notes with your AI coach.",
    hint: "Best when you're stuck",
  },
  {
    href: "/dashboard/mission",
    icon: "mission",
    tone: "dash-space--teal",
    title: "Autonomous Mission",
    description: "Pick a chapter and let AgentifyAI plan, quiz, explain, and steer your next move.",
    hint: "Best for guided study",
  },
  {
    href: "/dashboard/sessions",
    icon: "history",
    tone: "dash-space--gold",
    title: "Sessions",
    description: "Replay past attempts and learn from every wrong answer before the next test.",
    hint: "Best after practice",
  },
  {
    href: "/dashboard/progress",
    icon: "analytics",
    tone: "dash-space--ink",
    title: "Analytics",
    description: "Deep-dive charts: topic mastery, pace, consistency, and exam readiness.",
    hint: "Best for a weekly review",
  },
];

function RailCard({ eyebrow, title, children }: { eyebrow: string; title?: string; children: React.ReactNode }) {
  return (
    <section className="dash-card rounded-3xl p-5">
      <p className="dash-gold-eyebrow text-[10px] font-bold uppercase tracking-[0.2em]">{eyebrow}</p>
      {title ? <h2 className="mt-1.5 text-base font-semibold text-[var(--agentify-primary-text)]">{title}</h2> : null}
      <div className="mt-4">{children}</div>
    </section>
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
  const [dataError, setDataError] = useState("");
  const [reloadToken, setReloadToken] = useState(0);
  const [greeting, setGreeting] = useState("Welcome back");

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
    setGreeting(greetingForHour(new Date().getHours()));
  }, []);

  useEffect(() => {
    if (loading || claimsLoading || !userId) return;
    let active = true;

    async function loadDashboard() {
      setLoadingData(true);
      setDataError("");
      try {
        await ensureBackendReady(backendURL, { timeoutMs: 12000, pollMs: 1200 }).catch(() => null);
        const headers = await getAuthHeaders();
        const forceFresh = reloadToken > 0;
        const [progressJson, sessionsJson, leaderboardJson, analyticsJson] = await Promise.all([
          apiJson<unknown>(`${backendURL}/get-progress/${userId}`, {
            headers,
            cacheKey: `progress:${userId}`,
            cacheTtlMs: 30000,
            forceFresh,
            retries: 1,
            timeoutMs: 7000,
          }).catch(() => null),
          apiJson<unknown>(`${backendURL}/sessions/${userId}`, {
            headers,
            cacheKey: `sessions:${userId}`,
            cacheTtlMs: 30000,
            forceFresh,
            retries: 1,
            timeoutMs: 7000,
          }).catch(() => null),
          apiJson<unknown>(`${backendURL}/leaderboard`, {
            headers,
            cacheKey: "leaderboard",
            cacheTtlMs: 45000,
            forceFresh,
            retries: 1,
            timeoutMs: 7000,
          }).catch(() => null),
          apiJson<unknown>(`${backendURL}/analytics/${userId}`, {
            headers,
            cacheKey: `analytics:${userId}`,
            cacheTtlMs: 30000,
            forceFresh,
            retries: 1,
            timeoutMs: 7000,
          }).catch(() => null),
        ]);

        if (!active) return;
        const missingSignals = [progressJson, sessionsJson, leaderboardJson, analyticsJson].filter((value) => value === null).length;
        setDataError(missingSignals ? "Some progress signals could not refresh. Showing the latest available learning view." : "");
        setProgress(normalizeProgress(progressJson));
        setSessions(normalizeSessions(sessionsJson));
        setLeaderboard(normalizeLeaderboard(leaderboardJson));
        setWeakAreas(normalizeWeakAreas(analyticsJson));
      } catch {
        if (!active) return;
        setDataError("Progress signals could not refresh. Showing a safe learning view.");
      } finally {
        if (active) setLoadingData(false);
      }
    }

    void loadDashboard();
    return () => {
      active = false;
    };
  }, [backendURL, claimsLoading, getAuthHeaders, loading, reloadToken, userId]);

  const retryDashboard = () => {
    invalidateApiCache(`progress:${userId}`);
    invalidateApiCache(`sessions:${userId}`);
    invalidateApiCache(`analytics:${userId}`);
    invalidateApiCache("leaderboard");
    setReloadToken((current) => current + 1);
  };

  if (loading || claimsLoading) {
    return (
      <LoadingState title="Preparing dashboard..." detail="Loading your hub, progress signals, and next best study move." />
    );
  }

  const ticker = [
    { label: "Level", value: `${level}`, helper: "Based on XP earned" },
    { label: "XP", value: `${progress.xp}`, helper: `${progress.total_tests} sessions recorded` },
    { label: "Accuracy", value: `${accuracyValue}%`, helper: `${progress.total_correct}/${progress.total_questions} correct` },
    { label: "Streak", value: `${progress.streak}d`, helper: "Learning momentum" },
  ];

  return (
    <div className={`mx-auto w-full max-w-[1240px] px-1 sm:px-3 ${uiFont.className}`}>
      {dataError ? (
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="min-w-0 flex-1">
            <AlertState tone="amber" message={dataError} />
          </div>
          <button
            type="button"
            onClick={retryDashboard}
            className="agentify-action shrink-0 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-700 transition hover:bg-amber-100"
          >
            Retry
          </button>
        </div>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_19.5rem] lg:items-start">
        {/* ── Main column ─────────────────────────────────── */}
        <div>
          <header className="px-1 pt-2">
            <h1
              className={`text-[2.1rem] font-medium leading-[1.1] tracking-tight text-[var(--agentify-primary-text)] sm:text-5xl ${displayFont.className}`}
            >
              {greeting}, <em className="italic text-[#0E7490]">{firstName}</em>.
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-[var(--agentify-muted-text)] sm:text-base">
              {focusMessage} Pick a space below — every card opens a focused learning room.
            </p>
          </header>

          {/* Stat ticker */}
          <div className="dash-ticker mt-6 grid grid-cols-2 sm:grid-cols-4" role="list" aria-label="Progress summary">
            {ticker.map((stat) => (
              <div key={stat.label} role="listitem" className="dash-ticker-item px-4 py-4 sm:px-5">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--agentify-muted-text)]">
                  {stat.label}
                </p>
                <p className="dash-num mt-1.5 text-2xl font-semibold text-[var(--agentify-primary-text)] sm:text-3xl">
                  {loadingData ? "—" : stat.value}
                </p>
                <p className="mt-1 truncate text-[11px] text-[var(--agentify-muted-text)]">
                  {loadingData ? "Updating…" : stat.helper}
                </p>
              </div>
            ))}
          </div>

          {/* Spaces */}
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {spaces.map((space) => (
              <Link
                key={space.href}
                href={space.href}
                aria-label={`${space.title}: ${space.description}`}
                className={`dash-card dash-space ${space.tone} flex min-h-[11.5rem] flex-col rounded-3xl p-5 pl-6 outline-none sm:p-6 sm:pl-7`}
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="dash-space-icon flex h-11 w-11 items-center justify-center rounded-2xl">
                    <AppIcon name={space.icon} className="h-5 w-5" />
                  </span>
                  <span className="dash-space-arrow text-[var(--agentify-primary-text)]">
                    <AppIcon name="arrowRight" className="h-5 w-5" />
                  </span>
                </div>
                <h2 className="mt-4 text-xl font-semibold tracking-tight text-[var(--agentify-primary-text)]">
                  {space.title}
                </h2>
                <p className="mt-1.5 text-sm leading-6 text-[var(--agentify-muted-text)]">{space.description}</p>
                <p className="mt-auto pt-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--agentify-muted-text)] opacity-80">
                  {space.hint}
                </p>
              </Link>
            ))}
          </div>

          {isAdmin ? (
            <div className="mt-4 px-1">
              <Link
                href="/dashboard/internal/admin"
                className="inline-flex items-center gap-2 rounded-full border border-amber-300/40 bg-amber-300/10 px-4 py-2 text-xs font-semibold text-amber-700 transition hover:bg-amber-300/20"
              >
                <AppIcon name="spark" className="h-3.5 w-3.5" />
                Admin Console
                <span className="opacity-60">Ctrl+Shift+A</span>
              </Link>
            </div>
          ) : null}
        </div>

        {/* ── Live rail ───────────────────────────────────── */}
        <aside className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
          <RailCard eyebrow="Today's focus">
            <div className="flex items-center gap-4">
              <div
                className="dash-ring flex h-20 w-20 shrink-0 items-center justify-center rounded-full"
                style={{ "--dash-ring-value": Math.max(2, Math.min(100, accuracyValue)) } as React.CSSProperties}
                role="img"
                aria-label={`Accuracy ${accuracyValue} percent`}
              >
                <span className="dash-num text-lg font-bold text-[var(--agentify-primary-text)]">
                  {loadingData ? "—" : `${accuracyValue}%`}
                </span>
              </div>
              <p className="text-sm font-medium leading-6 text-[var(--agentify-primary-text)]">{focusMessage}</p>
            </div>
          </RailCard>

          <RailCard eyebrow="Repair next" title="Weak areas">
            {loadingData ? (
              <LoadingSkeleton rows={3} />
            ) : weakAreas.length ? (
              <ul className="space-y-3">
                {weakAreas.map((area, index) => {
                  const score = Math.round(toNumber(area.accuracy ?? area.value));
                  return (
                    <li key={`${area.topic}-${index}`}>
                      <div className="flex items-center justify-between gap-3">
                        <p className="truncate text-sm font-medium capitalize text-[var(--agentify-primary-text)]">
                          {formatTopic(area.topic)}
                        </p>
                        <span className="dash-num text-sm font-bold text-[#0E7490]">{score}%</span>
                      </div>
                      <div className="dash-bar mt-2 h-1.5 rounded-full">
                        <div
                          className="h-full rounded-full bg-[linear-gradient(90deg,#0E7490,#14B8A6)]"
                          style={{ width: `${Math.max(5, Math.min(100, score))}%` }}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-sm leading-6 text-[var(--agentify-muted-text)]">
                Complete one mission to unlock weak-topic signals.
              </p>
            )}
          </RailCard>

          <RailCard eyebrow="Latest activity" title="Recent sessions">
            {loadingData ? (
              <LoadingSkeleton rows={3} />
            ) : recentSessions.length ? (
              <ul className="space-y-2.5">
                {recentSessions.map((session, index) => (
                  <li key={session.id ?? index} className="dash-row flex items-center justify-between gap-3 rounded-2xl px-3.5 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium capitalize text-[var(--agentify-primary-text)]">
                        {formatTopic(session.topic)}
                      </p>
                      <p className="mt-0.5 text-[11px] text-[var(--agentify-muted-text)]">{getSessionDate(session)}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="dash-num text-sm font-bold text-[#0E7490]">
                        {toNumber(session.score ?? session.correct)}/{toNumber(session.total_questions ?? session.questions)}
                      </p>
                      <p className="mt-0.5 text-[11px] text-[var(--agentify-muted-text)]">
                        {toNumber(session.xp_earned ?? session.xp)} XP
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm leading-6 text-[var(--agentify-muted-text)]">
                No sessions yet. Start a mission to create your first record.
              </p>
            )}
          </RailCard>

          <RailCard eyebrow="Community" title="Top students">
            {loadingData ? (
              <LoadingSkeleton rows={3} />
            ) : leaderboard.length ? (
              <ul className="space-y-2.5">
                {leaderboard.map((entry, index) => (
                  <li key={entry.user_id || index} className="dash-row flex items-center justify-between gap-3 rounded-2xl px-3.5 py-3">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span className={`dash-num flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-xs font-bold ${index === 0 ? "bg-[#F2B84B]/20 text-[#B7791F]" : "bg-[#0E7490]/10 text-[#0E7490]"}`}>
                        #{index + 1}
                      </span>
                      <p className="truncate text-sm font-medium text-[var(--agentify-primary-text)]">
                        {getDisplayName(entry, `Student ${index + 1}`)}
                      </p>
                    </div>
                    <p className="dash-num shrink-0 text-sm font-bold text-[#0E7490]">{toNumber(entry.xp)} XP</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm leading-6 text-[var(--agentify-muted-text)]">
                Rankings will appear after students earn XP.
              </p>
            )}
          </RailCard>
        </aside>
      </div>
    </div>
  );
}
