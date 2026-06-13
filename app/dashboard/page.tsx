"use client";

import { useAuth } from "@/context/AuthContext";
import { AlertState, LoadingState } from "@/components/ui/Polished";
import { apiJson, ensureBackendReady, invalidateApiCache } from "@/lib/apiClient";
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

interface LeaderboardEntry {
  rank: number;
  user_id: string;
  display_name?: string;
  name?: string;
  xp: number;
  streak: number;
}

interface SessionRecord {
  id: string;
  subject: string;
  topic: string;
  total_questions: number;
  score: number;
  xp_earned: number;
  time_spent_seconds: number;
  session_type: string;
  completed_at: string;
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

function getLeaderboardRows(value: unknown) {
  if (Array.isArray(value)) return value;
  if (!isRecord(value)) return [];
  if (Array.isArray(value.leaderboard)) return value.leaderboard;
  if (Array.isArray(value.rankings)) return value.rankings;
  if (Array.isArray(value.users)) return value.users;
  return [];
}

function normalizeLeaderboard(value: unknown): LeaderboardEntry[] {
  return getLeaderboardRows(value)
    .map((item, index): LeaderboardEntry | null => {
      if (!isRecord(item)) return null;
      const userId = String(item.user_id ?? item.uid ?? item.id ?? item.terminal_id ?? "");
      if (!userId) return null;
      return {
        rank: toNumber(item.rank, index + 1),
        user_id: userId,
        display_name: item.display_name ? String(item.display_name) : undefined,
        name: item.name ? String(item.name) : undefined,
        xp: toNumber(item.xp ?? item.total_xp),
        streak: toNumber(item.streak),
      };
    })
    .filter((entry): entry is LeaderboardEntry => entry !== null);
}

function normalizeSessions(value: unknown): SessionRecord[] {
  const list = Array.isArray(value)
    ? value
    : isRecord(value) && Array.isArray(value.sessions)
      ? value.sessions
      : [];

  return list
    .map((item, index): SessionRecord | null => {
      if (!isRecord(item)) return null;
      return {
        id: String(item.id ?? item.session_id ?? `${item.topic || "session"}-${index}`),
        subject: String(item.subject || "Study"),
        topic: String(item.topic || "Learning session"),
        total_questions: Math.max(0, toNumber(item.total_questions ?? item.questions)),
        score: Math.max(0, toNumber(item.score ?? item.correct)),
        xp_earned: Math.max(0, toNumber(item.xp_earned ?? item.xp)),
        time_spent_seconds: Math.max(0, toNumber(item.time_spent_seconds ?? item.duration_seconds)),
        session_type: String(item.session_type || item.type || "study"),
        completed_at: String(item.completed_at ?? item.completedAt ?? item.timestamp ?? item.date ?? item.createdAt ?? ""),
      };
    })
    .filter((session): session is SessionRecord => session !== null)
    .sort((left, right) => {
      const leftTime = new Date(left.completed_at).getTime();
      const rightTime = new Date(right.completed_at).getTime();
      return (Number.isFinite(rightTime) ? rightTime : 0) - (Number.isFinite(leftTime) ? leftTime : 0);
    });
}

function buildLeaderboard({
  source,
  currentUserId,
  currentDisplayName,
  progress,
}: {
  source: unknown;
  currentUserId: string;
  currentDisplayName: string;
  progress: ProgressState;
}) {
  const entries = new Map<string, LeaderboardEntry>();

  for (const entry of normalizeLeaderboard(source)) {
    entries.set(entry.user_id, entry);
  }

  const current = entries.get(currentUserId);
  entries.set(currentUserId, {
    rank: current?.rank ?? entries.size + 1,
    user_id: currentUserId,
    display_name: currentDisplayName,
    name: current?.name,
    xp: Math.max(current?.xp ?? 0, progress.xp),
    streak: Math.max(current?.streak ?? 0, progress.streak),
  });

  return [...entries.values()]
    .sort((a, b) => b.xp - a.xp || b.streak - a.streak)
    .map((entry, index) => ({ ...entry, rank: index + 1 }));
}

function accuracy(progress: ProgressState) {
  if (!progress.total_questions) return 0;
  return Math.round((progress.total_correct / progress.total_questions) * 100);
}

function getInitials(value: string) {
  return (
    value
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "AI"
  );
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-IN").format(value);
}

function getStudentName(entry: LeaderboardEntry, currentUserId: string, currentDisplayName: string) {
  if (entry.user_id === currentUserId) return currentDisplayName;
  return entry.display_name || entry.name || `Student ${entry.rank}`;
}

function getSessionAccuracy(session: SessionRecord) {
  if (!session.total_questions) return 0;
  return Math.round((session.score / session.total_questions) * 100);
}

function getSessionLabel(session: SessionRecord) {
  const type = session.session_type.toLowerCase();
  if (type.includes("exam")) return "Exam Mode";
  if (type.includes("mission")) return "Autonomous Mission";
  return "Study practice";
}

function getSessionDestination(session: SessionRecord) {
  const topic = encodeURIComponent(session.topic);
  const type = session.session_type.toLowerCase();
  if (type.includes("exam")) return `/dashboard/exam?topic=${topic}`;
  if (type.includes("mission")) return `/dashboard/mission?topic=${topic}`;
  return `/dashboard/study?topic=${topic}`;
}

function formatSessionDate(value: string) {
  const date = new Date(value);
  if (!value || Number.isNaN(date.getTime())) return "Recently";
  return date.toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function MetricCard({
  label,
  value,
  helper,
  accent,
}: {
  label: string;
  value: string;
  helper: string;
  accent: "teal" | "gold" | "cyan" | "mint";
}) {
  return (
    <article className="dashboard-core-metric" data-accent={accent}>
      <div className="dashboard-core-metric-top">
        <p>{label}</p>
        <span aria-hidden="true" />
      </div>
      <p className="dashboard-core-metric-value">{value}</p>
      <p className="dashboard-core-metric-helper">{helper}</p>
    </article>
  );
}

type HubIconName = "dashboard" | "study" | "mission" | "exam";

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
      <path d="M8 3.5h8A1.5 1.5 0 0 1 17.5 5v14A1.5 1.5 0 0 1 16 20.5H8A1.5 1.5 0 0 1 6.5 19V5A1.5 1.5 0 0 1 8 3.5Z" />
      <path d="M9 8h6M9 12h2M13 12h2M9 16h2M13 16h2" />
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

function DashboardDataAlert({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-2 px-1 pt-2 sm:flex-row sm:items-center sm:px-4">
      <div className="min-w-0 flex-1">
        <AlertState tone="amber" message={message} />
      </div>
      <button
        type="button"
        onClick={onRetry}
        className="agentify-action agentify-action-secondary shrink-0 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-700 transition hover:bg-amber-100"
      >
        Retry
      </button>
    </div>
  );
}

function LeaderboardRow({
  entry,
  currentUserId,
  currentDisplayName,
}: {
  entry: LeaderboardEntry;
  currentUserId: string;
  currentDisplayName: string;
}) {
  const isCurrent = entry.user_id === currentUserId;
  const studentName = getStudentName(entry, currentUserId, currentDisplayName);
  const level = Math.floor(entry.xp / 100) + 1;

  return (
    <li className="dashboard-leaderboard-row" data-current={isCurrent ? "true" : "false"}>
      <div className="dashboard-rank-cell" data-rank={entry.rank <= 3 ? entry.rank : undefined}>
        {entry.rank}
      </div>
      <div className="dashboard-student-cell">
        <span className="dashboard-student-avatar" aria-hidden="true">
          {getInitials(studentName)}
        </span>
        <span className="min-w-0">
          <span className="dashboard-student-name">
            {studentName}
            {isCurrent ? <span className="dashboard-you-label">You</span> : null}
          </span>
          <span className="dashboard-student-mobile-meta">
            Level {level} · {entry.streak} day streak
          </span>
        </span>
      </div>
      <div className="dashboard-leaderboard-stat dashboard-leaderboard-level">
        <strong>{level}</strong>
        <span>Level</span>
      </div>
      <div className="dashboard-leaderboard-stat dashboard-leaderboard-streak">
        <strong>{entry.streak}</strong>
        <span>Days</span>
      </div>
      <div className="dashboard-leaderboard-xp">
        <strong>{formatNumber(entry.xp)}</strong>
        <span>XP</span>
      </div>
    </li>
  );
}

function RecentSessionRow({ session }: { session: SessionRecord }) {
  const sessionAccuracy = getSessionAccuracy(session);

  return (
    <li className="dashboard-session-row">
      <div className="dashboard-session-icon" aria-hidden="true">
        {session.session_type.toLowerCase().includes("exam") ? "E" : session.session_type.toLowerCase().includes("mission") ? "M" : "S"}
      </div>
      <div className="dashboard-session-main">
        <div>
          <span>{getSessionLabel(session)}</span>
          <h3>{session.topic.replace(/_/g, " ")}</h3>
        </div>
        <p>{session.subject} / {formatSessionDate(session.completed_at)}</p>
      </div>
      <div className="dashboard-session-stat">
        <strong>{sessionAccuracy}%</strong>
        <span>Accuracy</span>
      </div>
      <div className="dashboard-session-stat">
        <strong>+{session.xp_earned}</strong>
        <span>XP</span>
      </div>
      <Link href={getSessionDestination(session)} className="dashboard-session-action">
        Revise
      </Link>
    </li>
  );
}

export default function DashboardPage() {
  const { user, userId, loading, getAuthHeaders } = useAuth();
  const searchParams = useSearchParams();
  const backendURL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://127.0.0.1:8000";

  const [progress, setProgress] = useState<ProgressState>({
    total_tests: 0,
    total_questions: 0,
    total_correct: 0,
    xp: 0,
    streak: 0,
  });
  const [leaderboardSource, setLeaderboardSource] = useState<unknown>([]);
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [sessionsError, setSessionsError] = useState("");
  const [loadingData, setLoadingData] = useState(true);
  const [dataError, setDataError] = useState("");
  const [reloadToken, setReloadToken] = useState(0);

  const displayName = user?.displayName || user?.email?.split("@")[0] || user?.phoneNumber || "Student";
  const firstName = displayName.split(" ")[0] || "Student";
  const showOverview = searchParams.get("workspace") === "overview";
  const accuracyValue = accuracy(progress);
  const level = Math.floor(progress.xp / 100) + 1;

  const rankedLeaderboard = useMemo(
    () =>
      buildLeaderboard({
        source: leaderboardSource,
        currentUserId: userId,
        currentDisplayName: displayName,
        progress,
      }),
    [displayName, leaderboardSource, progress, userId],
  );

  const currentRank = rankedLeaderboard.find((entry) => entry.user_id === userId);
  const topLeaderboard = rankedLeaderboard.slice(0, 10);
  const currentOutsideTop = currentRank && currentRank.rank > 10 ? currentRank : null;
  const recentSessions = sessions.slice(0, 3);

  const focusMessage = useMemo(() => {
    if (!progress.total_questions) return "Start with one short mission today.";
    if (accuracyValue < 60) return "Focus on clarity before speed.";
    if (accuracyValue < 80) return "You are close. Practice weak spots.";
    return "Strong momentum. Move to exam-style practice.";
  }, [accuracyValue, progress.total_questions]);

  useEffect(() => {
    if (loading || !userId) return;
    let active = true;

    async function loadDashboard() {
      setLoadingData(true);
      setDataError("");
      try {
        await ensureBackendReady(backendURL, { timeoutMs: 12000, pollMs: 1200 }).catch(() => null);
        const headers = await getAuthHeaders();
        const forceFresh = reloadToken > 0;
        const [progressJson, leaderboardJson, sessionsJson] = await Promise.all([
          apiJson<unknown>(`${backendURL}/get-progress/${userId}`, {
            headers,
            cacheKey: `progress:${userId}`,
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
          apiJson<unknown>(`${backendURL}/sessions/${userId}`, {
            headers,
            cacheKey: `sessions:${userId}`,
            cacheTtlMs: 30000,
            forceFresh,
            retries: 1,
            timeoutMs: 7000,
          }).catch(() => null),
        ]);

        if (!active) return;
        const normalizedProgress = normalizeProgress(progressJson);
        setProgress(normalizedProgress);
        setLeaderboardSource(leaderboardJson ?? []);
        setSessions(normalizeSessions(sessionsJson));
        setSessionsError(sessionsJson === null ? "Recent learning could not refresh right now." : "");
        setDataError(
          progressJson === null || leaderboardJson === null
            ? "Some progress signals could not refresh. Showing your latest available results."
            : "",
        );
      } catch {
        if (!active) return;
        setDataError("Progress could not refresh. Showing a safe learning view.");
      } finally {
        if (active) setLoadingData(false);
      }
    }

    void loadDashboard();
    return () => {
      active = false;
    };
  }, [backendURL, getAuthHeaders, loading, reloadToken, userId]);

  const retryDashboard = () => {
    invalidateApiCache(`progress:${userId}`);
    invalidateApiCache("leaderboard");
    invalidateApiCache(`sessions:${userId}`);
    setReloadToken((current) => current + 1);
  };

  if (loading) {
    return <LoadingState title="Preparing dashboard…" detail="Loading your learning hub and progress." />;
  }

  if (!showOverview) {
    return (
      <div className="w-full">
        {dataError ? <DashboardDataAlert message={dataError} onRetry={retryDashboard} /> : null}
        <section className="flex min-h-[calc(100svh-118px)] flex-col items-center justify-center gap-8 py-8">
          <div className="max-w-3xl text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.26em] text-[#0E7490]">Learning Hub</p>
            <h1 className="mt-4 text-4xl font-semibold tracking-tight text-slate-950 sm:text-6xl">
              Good to see you, {firstName}
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-slate-500">
              Pick one section from the hub. Each card opens a focused learning space built around one clear student task.
            </p>
          </div>

          <div className="relative w-full max-w-[1180px] px-1 sm:px-4">
            <div
              aria-label="AgentifyAI learning spaces"
              className="hub-grid grid grid-cols-1 overflow-visible rounded-[3rem] border border-white/70 bg-white/60 shadow-[0_36px_120px_rgba(15,23,42,0.14)] backdrop-blur-2xl md:grid-cols-2"
            >
              <HubTile
                href="/dashboard?workspace=overview"
                eyebrow="Overview"
                title="Dashboard"
                description="See your level, accuracy, streak, XP, and current student rank."
                helper="Your essential progress view"
                action="View progress"
                icon="dashboard"
                tone="teal"
              />
              <HubTile
                href="/dashboard/study"
                eyebrow="Ask"
                title="Study Page"
                description="Ask doubts, get examples, create revision notes, and build focused recall tools."
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
                href="/dashboard/exam"
                eyebrow="Test"
                title="Exam Mode"
                description="Generate grounded MCQs and probable questions, submit once, and review every mistake."
                helper="Best for focused exam preparation"
                action="Start exam"
                icon="exam"
                tone="gold"
              />
            </div>
          </div>

          <div className="w-full max-w-3xl rounded-[1.7rem] border border-white/70 bg-white/70 p-5 text-center shadow-[0_18px_60px_rgba(15,23,42,0.08)] backdrop-blur-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Today&apos;s focus</p>
            <p className="mt-3 text-2xl font-semibold text-slate-950">{focusMessage}</p>
            <div className="mx-auto mt-5 h-2 max-w-xl rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-[linear-gradient(90deg,#0E7490,#14B8A6,#F2B84B)] transition-[width]"
                style={{ width: `${Math.max(6, Math.min(100, accuracyValue || 6))}%` }}
              />
            </div>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="dashboard-overview mx-auto w-full max-w-[1180px]" aria-busy={loadingData}>
      {dataError ? <DashboardDataAlert message={dataError} onRetry={retryDashboard} /> : null}

      <header className="dashboard-overview-header">
        <div className="min-w-0">
          <nav aria-label="Breadcrumb" className="dashboard-breadcrumb">
            <Link href="/dashboard">Learning Hub</Link>
            <span aria-hidden="true">/</span>
            <span aria-current="page">Dashboard</span>
          </nav>
          <h1>Student Progress</h1>
          <p>Your essential learning signals and student rank, all in one focused view.</p>
        </div>
        <div className="dashboard-rank-summary" aria-label={`Your rank is ${currentRank?.rank ?? 1} of ${rankedLeaderboard.length}`}>
          <span>Your Rank</span>
          <strong>#{currentRank?.rank ?? 1}</strong>
          <small>of {rankedLeaderboard.length} students</small>
        </div>
      </header>

      <section className="dashboard-core-metrics" aria-label="Core progress metrics" aria-live="polite">
        <MetricCard label="Level" value={`${level}`} helper="Based on total XP" accent="cyan" />
        <MetricCard label="Accuracy" value={`${accuracyValue}%`} helper="Across recorded questions" accent="teal" />
        <MetricCard label="Streak" value={`${progress.streak} d`} helper="Current learning streak" accent="gold" />
        <MetricCard label="XP" value={formatNumber(progress.xp)} helper={loadingData ? "Updating…" : "Total experience earned"} accent="mint" />
      </section>

      <section className="dashboard-recent-panel" aria-labelledby="recent-learning-title">
        <div className="dashboard-recent-header">
          <div>
            <p className="dashboard-section-kicker">Recent Learning</p>
            <h2 id="recent-learning-title">Continue from your latest work</h2>
            <p>Only your three newest attempts are shown here, with the result that matters and a direct route back to practice.</p>
          </div>
          <span>{recentSessions.length} recent</span>
        </div>

        {sessionsError ? <div className="dashboard-recent-notice">{sessionsError}</div> : null}

        {recentSessions.length ? (
          <ol className="dashboard-session-list">
            {recentSessions.map((session) => <RecentSessionRow key={session.id} session={session} />)}
          </ol>
        ) : (
          <div className="dashboard-session-empty">
            <div>
              <h3>No completed attempts yet</h3>
              <p>Your latest Exam Mode and Autonomous Mission results will appear here automatically.</p>
            </div>
            <div>
              <Link href="/dashboard/exam">Start Exam Mode</Link>
              <Link href="/dashboard/mission">Start a mission</Link>
            </div>
          </div>
        )}
      </section>

      <section className="dashboard-leaderboard-panel" aria-labelledby="leaderboard-title">
        <div className="dashboard-leaderboard-header">
          <div>
            <p className="dashboard-section-kicker">Global Rankings</p>
            <h2 id="leaderboard-title">Student Leaderboard</h2>
            <p>Ranked by total XP. Streak breaks ties between students with equal XP.</p>
          </div>
          <div className="dashboard-leaderboard-count">
            <span aria-hidden="true" />
            {rankedLeaderboard.length} students
          </div>
        </div>

        <div className="dashboard-leaderboard-columns" aria-hidden="true">
          <span>Rank</span>
          <span>Student</span>
          <span>Level</span>
          <span>Streak</span>
          <span>XP</span>
        </div>

        <ol className="dashboard-leaderboard-list">
          {topLeaderboard.map((entry) => (
            <LeaderboardRow
              key={entry.user_id}
              entry={entry}
              currentUserId={userId}
              currentDisplayName={displayName}
            />
          ))}
        </ol>

        {currentOutsideTop ? (
          <div className="dashboard-current-position">
            <span>Your Position</span>
            <ol>
              <LeaderboardRow
                entry={currentOutsideTop}
                currentUserId={userId}
                currentDisplayName={displayName}
              />
            </ol>
          </div>
        ) : null}
      </section>
    </div>
  );
}
