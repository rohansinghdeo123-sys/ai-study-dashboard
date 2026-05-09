"use client";

import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

// ─── Types (unchanged) ─────────────────────────────────────────────────────
interface Progress {
  user_id: string;
  total_tests: number;
  total_questions: number;
  total_correct: number;
  xp: number;
  streak: number;
  accuracy?: number;
  level?: number;
}

interface LeaderboardUser {
  rank?: number;
  user_id: string;
  name?: string;
  display_name?: string;
  email?: string;
  phone?: string;
  xp: number;
  streak?: number;
  total_tests?: number;
}

interface SessionRecord {
  id?: string | number;
  subject?: string;
  topic?: string;
  date?: string;
  timestamp?: string;
  createdAt?: string;
  startedAt?: string;
  completedAt?: string;
  duration?: number;
  questions?: number;
  total_questions?: number;
  totalQuestions?: number;
  correct?: number;
  score?: number;
  xp?: number;
  xp_earned?: number;
  xpEarned?: number;
  accuracy?: number;
  accuracy_rate?: number;
  focusScore?: number;
  focus_score?: number;
  session_type?: string;
}

interface TrendPoint {
  day?: string;
  label?: string;
  date?: string;
  xp?: number;
  accuracy?: number;
  attempts?: number;
  sessions?: number;
  focus?: number;
}

interface WeakArea {
  topic: string;
  accuracy: number;
  attempts?: number;
  avg_time?: number;
  trend?: number; // positive = improving, negative = declining, 0 = stable
}

interface Insight {
  type?: string;
  message: string;
  severity?: string;
}

type ChartMode = "xp" | "accuracy" | "attempts";
type ChartRange = "7D" | "14D" | "30D";

const EMPTY_PROGRESS: Progress = {
  user_id: "",
  total_tests: 0,
  total_questions: 0,
  total_correct: 0,
  xp: 0,
  streak: 0,
};

const RANGE_DAYS: Record<ChartRange, number> = {
  "7D": 7,
  "14D": 14,
  "30D": 30,
};

// ─── Utility functions (unchanged) ────────────────────────────────────────
function cn(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function toNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function getLocalDayKey(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function startOfLocalDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, amount: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

function parseDate(value: string | Date | null | undefined) {
  if (!value) return null;
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatChartLabel(date: Date, range: ChartRange) {
  if (range === "7D") {
    return date.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase();
  }
  return date
    .toLocaleDateString("en-IN", { day: "2-digit", month: "short" })
    .toUpperCase();
}

function getSessionDate(session: SessionRecord) {
  return parseDate(
    session.timestamp ??
      session.date ??
      session.createdAt ??
      session.startedAt ??
      session.completedAt,
  );
}

function getSessionXp(session: SessionRecord) {
  return toNumber(session.xp ?? session.xp_earned ?? session.xpEarned);
}

function getSessionQuestions(session: SessionRecord) {
  return toNumber(session.questions ?? session.total_questions ?? session.totalQuestions);
}

function getSessionCorrect(session: SessionRecord) {
  return toNumber(session.correct ?? session.score);
}

function getSessionAccuracy(session: SessionRecord) {
  const explicit = session.accuracy ?? session.accuracy_rate;
  if (explicit !== undefined && explicit !== null) return Math.round(toNumber(explicit));
  const questions = getSessionQuestions(session);
  if (!questions) return 0;
  return Math.round((getSessionCorrect(session) / questions) * 100);
}

function shortId(value: string) {
  if (!value) return "UNKNOWN";
  if (value.length <= 18) return value;
  return `${value.slice(0, 8)}...${value.slice(-6)}`;
}

function getUserDisplayName(user: any) {
  return user?.displayName || user?.phoneNumber || user?.email || user?.uid || "UNKNOWN_USER";
}

function getLeaderboardDisplayName(entry: LeaderboardUser, currentUserId: string, currentDisplayName: string) {
  if (entry.user_id === currentUserId) return currentDisplayName;
  return entry.display_name || entry.name || entry.phone || entry.email || entry.user_id;
}

async function readJson(url: string) {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) return null;
  return response.json();
}

// ─── Data normalizers (unchanged) ─────────────────────────────────────────
function normalizeProgress(source: any, userId: string): Progress {
  if (!source || typeof source !== "object") {
    return { ...EMPTY_PROGRESS, user_id: userId };
  }
  const summary = source.summary && typeof source.summary === "object" ? source.summary : source;
  return {
    user_id: String(summary.user_id ?? source.user_id ?? userId),
    total_tests: toNumber(
      summary.total_tests ??
        summary.totalTests ??
        summary.total_sessions ??
        summary.sessions ??
        source.total_tests,
    ),
    total_questions: toNumber(
      summary.total_questions ??
        summary.totalQuestions ??
        summary.total_mcqs_attempted ??
        summary.totalMcqsAttempted ??
        source.total_questions,
    ),
    total_correct: toNumber(summary.total_correct ?? summary.totalCorrect ?? source.total_correct),
    xp: toNumber(summary.xp ?? summary.total_xp ?? summary.totalXp ?? source.xp),
    streak: toNumber(summary.streak ?? source.streak),
    accuracy:
      summary.accuracy !== undefined || summary.avg_accuracy !== undefined
        ? toNumber(summary.accuracy ?? summary.avg_accuracy)
        : undefined,
    level: summary.level !== undefined ? toNumber(summary.level, 1) : undefined,
  };
}

function normalizeLeaderboard(source: unknown): LeaderboardUser[] {
  if (!Array.isArray(source)) return [];
  return source
    .map((item, index) => {
      if (!item || typeof item !== "object") return null;
      const row = item as Record<string, unknown>;
      const userId = String(row.user_id ?? row.uid ?? row.id ?? row.terminal_id ?? "");
      if (!userId) return null;
      return {
        rank: toNumber(row.rank, index + 1),
        user_id: userId,
        name: row.name ? String(row.name) : undefined,
        display_name: row.display_name ? String(row.display_name) : undefined,
        email: row.email ? String(row.email) : undefined,
        phone: row.phone ? String(row.phone) : undefined,
        xp: toNumber(row.xp ?? row.total_xp),
        streak: toNumber(row.streak),
        total_tests: toNumber(row.total_tests),
      };
    })
    .filter((item): item is LeaderboardUser => Boolean(item));
}

function normalizeSessions(source: unknown): SessionRecord[] {
  if (Array.isArray(source)) return source.filter(Boolean) as SessionRecord[];
  if (source && typeof source === "object" && Array.isArray((source as any).sessions)) {
    return (source as any).sessions.filter(Boolean) as SessionRecord[];
  }
  return [];
}

function normalizeTrends(source: unknown): TrendPoint[] {
  if (!Array.isArray(source)) return [];
  return source.filter(Boolean) as TrendPoint[];
}

function normalizeWeakAreas(analytics: any): WeakArea[] {
  const weakAreas = Array.isArray(analytics?.weak_areas) ? analytics.weak_areas : [];
  const heatmap = Array.isArray(analytics?.topic_heatmap) ? analytics.topic_heatmap : [];

  const directWeak = weakAreas.map((item: any) => ({
    topic: String(item.topic ?? "UNKNOWN_TOPIC"),
    accuracy: toNumber(item.accuracy ?? item.value),
    attempts: item.attempts !== undefined ? toNumber(item.attempts) : undefined,
    avg_time: item.avg_time !== undefined ? toNumber(item.avg_time) : undefined,
    trend: item.trend !== undefined ? toNumber(item.trend) : undefined,
  }));

  if (directWeak.length) return directWeak.slice(0, 5);

  return heatmap
    .map((item: any) => ({
      topic: String(item.topic ?? "UNKNOWN_TOPIC"),
      accuracy: toNumber(item.accuracy ?? item.value),
      attempts: item.attempts !== undefined ? toNumber(item.attempts) : undefined,
      trend: item.trend !== undefined ? toNumber(item.trend) : undefined,
    }))
    .filter((item: WeakArea) => item.accuracy < 60)
    .slice(0, 5);
}

function normalizeInsights(analytics: any): Insight[] {
  const insights = Array.isArray(analytics?.insights) ? analytics.insights : [];
  return insights
    .map((item: any) => ({
      type: item.type ? String(item.type) : "signal",
      message: String(item.message ?? ""),
      severity: item.severity ? String(item.severity) : "info",
    }))
    .filter((item: Insight) => item.message)
    .slice(0, 3);
}

function buildChartData({
  sessions,
  trends,
  range,
  mode,
}: {
  sessions: SessionRecord[];
  trends: TrendPoint[];
  range: ChartRange;
  mode: ChartMode;
}) {
  const days = RANGE_DAYS[range];
  const end = startOfLocalDay(new Date());
  const start = addDays(end, -(days - 1));

  const buckets = new Map<
    string,
    {
      date: Date;
      label: string;
      xp: number;
      attempts: number;
      correct: number;
      accuracyTotal: number;
      accuracyCount: number;
    }
  >();

  for (let index = 0; index < days; index += 1) {
    const date = addDays(start, index);
    buckets.set(getLocalDayKey(date), {
      date,
      label: formatChartLabel(date, range),
      xp: 0,
      attempts: 0,
      correct: 0,
      accuracyTotal: 0,
      accuracyCount: 0,
    });
  }

  if (sessions.length) {
    for (const session of sessions) {
      const date = getSessionDate(session);
      if (!date) continue;
      const day = startOfLocalDay(date);
      if (day < start || day > end) continue;
      const key = getLocalDayKey(day);
      const bucket = buckets.get(key);
      if (!bucket) continue;

      const questions = getSessionQuestions(session);
      const correct = getSessionCorrect(session);
      const accuracy = getSessionAccuracy(session);

      bucket.xp += getSessionXp(session);
      bucket.attempts += questions || 1;
      bucket.correct += correct;
      bucket.accuracyTotal += accuracy;
      bucket.accuracyCount += 1;
    }
  } else {
    for (const point of trends) {
      const date = parseDate(point.date);
      const dayLabel = point.day?.slice(0, 3).toUpperCase() ?? point.label?.slice(0, 3).toUpperCase();
      const matchingKey = date
        ? getLocalDayKey(startOfLocalDay(date))
        : [...buckets.entries()].find(([, value]) => value.label.slice(0, 3) === dayLabel)?.[0];
      if (!matchingKey) continue;
      const bucket = buckets.get(matchingKey);
      if (!bucket) continue;

      bucket.xp += toNumber(point.xp);
      bucket.attempts += toNumber(point.attempts ?? point.sessions);
      bucket.accuracyTotal += toNumber(point.accuracy);
      bucket.accuracyCount += point.accuracy !== undefined ? 1 : 0;
    }
  }

  return [...buckets.values()].map((bucket) => {
    const accuracy =
      bucket.attempts > 0
        ? Math.round((bucket.correct / bucket.attempts) * 100)
        : bucket.accuracyCount
          ? Math.round(bucket.accuracyTotal / bucket.accuracyCount)
          : 0;
    const value =
      mode === "accuracy" ? accuracy : mode === "attempts" ? bucket.attempts : bucket.xp;
    return {
      label: bucket.label,
      xp: bucket.xp,
      accuracy,
      attempts: bucket.attempts,
      value,
    };
  });
}

// ─── Terminal sub‑components (enhanced for glass‑morphism) ────────────────
function TerminalBadge({
  children,
  tone = "blue",
}: {
  children: React.ReactNode;
  tone?: "orange" | "green" | "blue" | "red" | "neutral" | "amber";
}) {
  return (
    <span
      className={cn(
        "inline-flex border px-2 py-1 text-[9px] font-bold uppercase tracking-[0.22em] font-mono",
        tone === "orange" && "border-orange-500/30 bg-orange-500/10 text-orange-500",
        tone === "green" && "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
        tone === "blue" && "border-[#00A3FF]/30 bg-[#00A3FF]/10 text-[#00A3FF]",
        tone === "red" && "border-red-500/30 bg-red-500/10 text-red-400",
        tone === "neutral" && "border-white/10 bg-black/20 text-gray-400",
        tone === "amber" && "border-amber-400/40 bg-amber-400/10 text-amber-400",
      )}
    >
      {children}
    </span>
  );
}

function GlassCard({
  label,
  value,
  accent = "neutral",
}: {
  label: string;
  value: string | number;
  accent?: "neutral" | "orange" | "green" | "red" | "blue";
}) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-white/10 bg-white/[0.03] backdrop-blur-sm p-4 transition-all hover:border-white/20">
      <div className="text-[9px] uppercase tracking-[0.22em] text-gray-500 font-mono">{label}</div>
      <div
        className={cn(
          "mt-2 text-lg font-bold tracking-tight",
          accent === "orange" && "text-orange-400",
          accent === "green" && "text-emerald-400",
          accent === "red" && "text-red-400",
          accent === "blue" && "text-[#00A3FF]",
          accent === "neutral" && "text-white",
        )}
      >
        {value}
      </div>
    </div>
  );
}

function GlassPanel({
  title,
  tag,
  right,
  children,
  className,
}: {
  title: string;
  tag?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "rounded-xl border border-white/10 bg-white/[0.03] backdrop-blur-sm overflow-hidden",
        className,
      )}
    >
      <div className="flex items-center justify-between border-b border-white/10 bg-white/[0.02] px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 font-mono">
            {title}
          </span>
          {tag ? <TerminalBadge tone="orange">{tag}</TerminalBadge> : null}
        </div>
        {right}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

// ─── Mini trend indicator component ────────────────────────────────────────
function TrendIcon({ trend }: { trend?: number }) {
  if (trend === undefined || trend === 0)
    return <span className="text-gray-500 text-xs">→</span>;
  if (trend > 0)
    return <span className="text-emerald-400 text-xs">↑</span>;
  return <span className="text-red-400 text-xs">↓</span>;
}

// ─── Main Dashboard Page ───────────────────────────────────────────────────
export default function DashboardPage() {
  const backendURL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const currentUserId = user?.uid ?? "";
  const currentDisplayName = getUserDisplayName(user);

  const [chartMode, setChartMode] = useState<ChartMode>("xp");
  const [chartRange, setChartRange] = useState<ChartRange>("7D");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRankId, setSelectedRankId] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const [data, setData] = useState<{
    progress: Progress;
    leaderboard: LeaderboardUser[];
    sessions: SessionRecord[];
    trends: TrendPoint[];
    weakAreas: WeakArea[];
    insights: Insight[];
    loading: boolean;
    error: string | null;
  }>({
    progress: EMPTY_PROGRESS,
    leaderboard: [],
    sessions: [],
    trends: [],
    weakAreas: [],
    insights: [],
    loading: true,
    error: null,
  });

  // Auto‑refresh every 60 seconds
  const fetchAllData = useCallback(async () => {
    if (!currentUserId) return;
    try {
      const [dashboardPayload, progressPayload, leaderboardPayload, sessionsPayload, analyticsPayload] =
        await Promise.all([
          readJson(`${backendURL}/dashboard/${currentUserId}`),
          readJson(`${backendURL}/get-progress/${currentUserId}`),
          readJson(`${backendURL}/leaderboard`),
          readJson(`${backendURL}/sessions/${currentUserId}`),
          readJson(`${backendURL}/analytics/${currentUserId}`),
        ]);

      const dashboard = dashboardPayload && typeof dashboardPayload === "object" ? dashboardPayload : {};
      const analyticsSource =
        (dashboard as any).analytics ??
        (dashboard as any).advanced_analytics ??
        analyticsPayload ??
        {};

      const progress = normalizeProgress(
        (dashboard as any).progress ??
          (dashboard as any).user_progress ??
          (dashboard as any).summary ??
          progressPayload ??
          analyticsSource?.summary,
        currentUserId,
      );

      const rawLeaderboard =
        (dashboard as any).leaderboard ?? (dashboard as any).rankings ?? leaderboardPayload ?? [];
      let leaderboard = normalizeLeaderboard(rawLeaderboard).map((entry) =>
        entry.user_id === currentUserId
          ? {
              ...entry,
              display_name: currentDisplayName,
              email: user?.email ?? entry.email,
              phone: user?.phoneNumber ?? entry.phone,
            }
          : entry,
      );

      if (!leaderboard.some((entry) => entry.user_id === currentUserId)) {
        leaderboard.push({
          rank: leaderboard.length + 1,
          user_id: currentUserId,
          display_name: currentDisplayName,
          email: user?.email ?? undefined,
          phone: user?.phoneNumber ?? undefined,
          xp: progress.xp,
          streak: progress.streak,
          total_tests: progress.total_tests,
        });
      }

      setData({
        progress,
        leaderboard,
        sessions: normalizeSessions(
          (dashboard as any).sessions ??
            (dashboard as any).session_history ??
            (dashboard as any).recent_sessions ??
            sessionsPayload,
        ),
        trends: normalizeTrends(
          (dashboard as any).performance_trends ??
            (dashboard as any).trends ??
            analyticsSource?.performance_trends,
        ),
        weakAreas: normalizeWeakAreas(analyticsSource),
        insights: normalizeInsights(analyticsSource),
        loading: false,
        error: null,
      });
      setLastRefresh(new Date());
    } catch (error) {
      console.error("TERMINAL_FETCH_ERROR:", error);
      setData((prev) => ({
        ...prev,
        progress: { ...EMPTY_PROGRESS, user_id: currentUserId },
        loading: false,
        error: "BACKEND_SYNC_ERROR",
      }));
    }
  }, [backendURL, currentUserId, currentDisplayName, user?.email, user?.phoneNumber]);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
      return;
    }
    if (currentUserId) {
      fetchAllData();
      const interval = setInterval(fetchAllData, 60_000);
      return () => clearInterval(interval);
    }
  }, [authLoading, user, router, fetchAllData, currentUserId]);

  // Derived analytics
  const analytics = useMemo(() => {
    const computedAccuracy =
      data.progress.total_questions === 0
        ? 0
        : Math.round((data.progress.total_correct / data.progress.total_questions) * 100);
    const accuracy = Math.round(data.progress.accuracy ?? computedAccuracy);
    const level = Math.max(1, data.progress.level ?? Math.floor(data.progress.xp / 100) + 1);
    const xpProgress = data.progress.xp % 100;
    return { accuracy, level, xpProgress };
  }, [data.progress]);

  const rankedLeaderboard = useMemo(() => {
    return [...data.leaderboard]
      .sort((a, b) => b.xp - a.xp)
      .map((entry, index) => ({
        ...entry,
        rank: index + 1,
        displayLabel: getLeaderboardDisplayName(entry, currentUserId, currentDisplayName),
      }));
  }, [data.leaderboard, currentUserId, currentDisplayName]);

  const filteredLeaderboard = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return rankedLeaderboard
      .filter((entry) => {
        if (!query) return true;
        return [
          entry.user_id,
          entry.displayLabel,
          entry.name,
          entry.display_name,
          entry.email,
          entry.phone,
          shortId(entry.user_id),
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(query));
      })
      .slice(0, 12);
  }, [rankedLeaderboard, searchTerm]);

  const currentRank = rankedLeaderboard.find((entry) => entry.user_id === currentUserId);

  const selectedRank =
    rankedLeaderboard.find((entry) => entry.user_id === selectedRankId) ??
    currentRank ??
    rankedLeaderboard[0];

  const chartData = useMemo(
    () =>
      buildChartData({ sessions: data.sessions, trends: data.trends, range: chartRange, mode: chartMode }),
    [data.sessions, data.trends, chartRange, chartMode],
  );

  const chartHasSignal = chartData.some((item) => item.value > 0);

  const recentSessions = useMemo(() => {
    return [...data.sessions]
      .sort((a, b) => {
        const aTime = getSessionDate(a)?.getTime() ?? 0;
        const bTime = getSessionDate(b)?.getTime() ?? 0;
        return bTime - aTime;
      })
      .slice(0, 6);
  }, [data.sessions]);

  // Personalised greeting
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  }, []);

  const weakCount = data.weakAreas.length;

  // Quick action handler
  const goToTopic = useCallback(
  (topic: string) => {
    router.push(`/dashboard/study?chapter=hydrocarbon&topic=${topic}`);
  },
  [router],
);

  // Loading state
  if (authLoading || data.loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#050505] font-mono text-[#00A3FF]">
        <div className="animate-pulse text-sm uppercase tracking-[0.28em]">
          LOADING_TERMINAL_DATA...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-gray-200 p-4 md:p-6 space-y-6 font-sans">
      {/* Header with greeting and last refresh */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {greeting}, <span className="text-[#00A3FF]">{currentDisplayName}</span>.
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            {weakCount > 0
              ? `Your AI coach found ${weakCount} weak topic${weakCount > 1 ? "s" : ""} today.`
              : "Your AI coach is analysing your latest sessions."}
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
          Last updated: {lastRefresh.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
        </div>
      </div>

      {/* Top stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <GlassCard label="System_User" value={currentDisplayName} />
        <GlassCard label="MCQ_Attempts" value={data.progress.total_questions} accent="orange" />
        <GlassCard
          label="Accuracy_Index"
          value={`${analytics.accuracy}%`}
          accent={analytics.accuracy >= 75 ? "green" : analytics.accuracy >= 45 ? "orange" : "red"}
        />
        <GlassCard label="Current_Streak" value={`${data.progress.streak} Days`} accent="orange" />
        <GlassCard label="Terminal_Level" value={`LVL ${analytics.level}`} accent="orange" />
        <GlassCard
          label="Backend_Status"
          value={data.error ? "SYNC_WARN" : "LIVE"}
          accent={data.error ? "red" : "green"}
        />
      </div>

      {/* Main content rows */}
      <div className="grid grid-cols-12 gap-4">
        <GlassPanel
          title="PERFORMANCE_HISTORY"
          tag={chartHasSignal ? "LIVE_DATA" : "SPARSE_FEED"}
          className="col-span-12 lg:col-span-8"
          right={
            <div className="flex flex-wrap items-center gap-2">
              {(["xp", "accuracy", "attempts"] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setChartMode(mode)}
                  className={cn(
                    "rounded-md border px-2 py-1 text-[9px] font-bold uppercase tracking-[0.18em] transition-all",
                    chartMode === mode
                      ? "border-orange-400/40 bg-orange-500/10 text-orange-400"
                      : "border-white/10 text-gray-500 hover:border-white/30 hover:text-white",
                  )}
                >
                  {mode}
                </button>
              ))}
              {(["7D", "14D", "30D"] as const).map((range) => (
                <button
                  key={range}
                  onClick={() => setChartRange(range)}
                  className={cn(
                    "rounded-md border px-2 py-1 text-[9px] font-bold uppercase tracking-[0.18em] transition-all",
                    chartRange === range
                      ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-400"
                      : "border-white/10 text-gray-500 hover:border-white/30 hover:text-white",
                  )}
                >
                  {range}
                </button>
              ))}
            </div>
          }
        >
          <div className="h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorSignal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#FFA500" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#FFA500" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1A1A1A" vertical={false} />
                <XAxis dataKey="label" stroke="#555" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis stroke="#555" fontSize={10} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#0A0A0F",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: "8px",
                    fontSize: "10px",
                    backdropFilter: "blur(8px)",
                  }}
                  labelStyle={{ color: "#E5E7EB" }}
                  itemStyle={{ color: "#FFA500" }}
                  cursor={{ stroke: "rgba(255,165,0,0.3)", strokeWidth: 1 }}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  name={chartMode.toUpperCase()}
                  stroke="#FFA500"
                  fill="url(#colorSignal)"
                  strokeWidth={2}
                  animationDuration={900}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </GlassPanel>

        <div className="col-span-12 lg:col-span-4 space-y-4">
          <GlassPanel title="LEVEL_PROGRESSION" tag="XP">
            <div className="space-y-4">
              <div className="flex justify-between items-baseline">
                <span className="text-[10px] uppercase tracking-[0.22em] text-gray-500 font-mono">
                  TOTAL_XP
                </span>
                <span className="text-3xl font-bold text-white">{data.progress.xp}</span>
              </div>
              <div className="h-2 w-full rounded-full bg-white/5 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-orange-500 to-amber-400 transition-all duration-1000"
                  style={{ width: `${clamp(analytics.xpProgress)}%` }}
                />
              </div>
              <div className="flex justify-between text-[9px] uppercase tracking-[0.18em] text-gray-500 font-mono">
                <span>LVL {analytics.level}</span>
                <span>{100 - analytics.xpProgress} XP TO NEXT</span>
                <span>LVL {analytics.level + 1}</span>
              </div>
            </div>
          </GlassPanel>

          <GlassPanel
            title="GLOBAL_RANKINGS"
            tag={currentRank ? `RANK_${currentRank.rank}` : "RANKING"}
            right={
              <button
                onClick={() => {
                  setSearchTerm(currentDisplayName);
                  setSelectedRankId(currentUserId);
                }}
                className="rounded-md border border-orange-400/30 bg-orange-500/10 px-2 py-1 text-[9px] font-bold uppercase tracking-[0.18em] text-orange-400 hover:bg-orange-500/20"
              >
                Find Me
              </button>
            }
          >
            <div className="border-b border-white/10 bg-black/20 p-2">
              <input
                type="text"
                value={searchTerm}
                placeholder="SEARCH NAME / ID..."
                className="w-full border border-white/10 bg-black/30 px-3 py-2 text-[10px] uppercase tracking-[0.16em] text-white outline-none focus:border-orange-400 rounded-md placeholder-gray-600"
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="max-h-[220px] overflow-y-auto">
              <table className="w-full text-left text-[10px]">
                <thead className="sticky top-0 border-b border-white/10 bg-white/[0.02] text-gray-500 font-mono">
                  <tr>
                    <th className="p-2 font-normal">RANK</th>
                    <th className="p-2 font-normal">TERMINAL_ID</th>
                    <th className="p-2 text-right font-normal">XP</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filteredLeaderboard.map((entry) => {
                    const isCurrent = entry.user_id === currentUserId;
                    const isSelected = entry.user_id === selectedRank?.user_id;
                    return (
                      <tr
                        key={entry.user_id}
                        onClick={() => setSelectedRankId(entry.user_id)}
                        className={cn(
                          "cursor-pointer transition-colors hover:bg-white/5",
                          isCurrent && "bg-orange-500/10",
                          isSelected && !isCurrent && "bg-blue-500/10",
                        )}
                      >
                        <td className="p-2 text-gray-400">#{entry.rank}</td>
                        <td className="max-w-[160px] truncate p-2 text-white">
                          {entry.displayLabel}
                          {isCurrent ? <span className="ml-2 text-[8px] text-emerald-400">YOU</span> : null}
                        </td>
                        <td className="p-2 text-right font-bold text-orange-400">{entry.xp}</td>
                      </tr>
                    );
                  })}
                  {!filteredLeaderboard.length && (
                    <tr>
                      <td colSpan={3} className="p-3 text-gray-600 text-center">
                        NO_MATCHING_TERMINAL
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </GlassPanel>

          <GlassPanel title="SELECTED_TERMINAL" tag="VIEW">
            <div className="space-y-3">
              {selectedRank ? (
                <>
                  <div className="flex justify-between border-b border-white/10 pb-2 text-[10px] uppercase tracking-[0.18em]">
                    <span className="text-gray-500">User</span>
                    <span className="truncate text-white">
                      {getLeaderboardDisplayName(selectedRank, currentUserId, currentDisplayName)}
                    </span>
                  </div>
                  <div className="flex justify-between border-b border-white/10 pb-2 text-[10px] uppercase tracking-[0.18em]">
                    <span className="text-gray-500">UID</span>
                    <span className="text-gray-300">{shortId(selectedRank.user_id)}</span>
                  </div>
                  <div className="flex justify-between border-b border-white/10 pb-2 text-[10px] uppercase tracking-[0.18em]">
                    <span className="text-gray-500">XP</span>
                    <span className="font-bold text-orange-400">{selectedRank.xp}</span>
                  </div>
                  <div className="flex justify-between text-[10px] uppercase tracking-[0.18em]">
                    <span className="text-gray-500">Streak</span>
                    <span className="text-emerald-400">{selectedRank.streak ?? 0} Days</span>
                  </div>
                </>
              ) : (
                <div className="text-[10px] uppercase tracking-[0.2em] text-gray-600">
                  SELECT_A_RANKING_ROW
                </div>
              )}
            </div>
          </GlassPanel>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-4">
        {/* Weak topic matrix with quick actions and trend icons */}
        <GlassPanel title="WEAK_TOPIC_MATRIX" tag="AI_SIGNAL" className="col-span-12 lg:col-span-5">
          <div className="space-y-3">
            {data.weakAreas.length ? (
              data.weakAreas.map((topic) => (
                <div
                  key={topic.topic}
                  className="rounded-xl border border-white/10 bg-black/20 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
                >
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-bold text-white uppercase font-mono">
                        {topic.topic}
                      </span>
                      <span className="flex items-center gap-1 text-xs">
                        <TrendIcon trend={topic.trend} />
                        <span className={cn(topic.accuracy >= 60 ? "text-emerald-400" : "text-red-400")}>
                          {Math.round(topic.accuracy)}%
                        </span>
                      </span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-white/5 mt-1">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all",
                          topic.accuracy >= 60 ? "bg-emerald-500" : "bg-red-500",
                        )}
                        style={{ width: `${clamp(topic.accuracy)}%` }}
                      />
                    </div>
                  </div>
                  <button
                    onClick={() => goToTopic(topic.topic)}
                    className="shrink-0 rounded-lg border border-[#00A3FF]/30 bg-[#00A3FF]/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-[#00A3FF] hover:bg-[#00A3FF]/20 transition-all"
                  >
                    Start Revision
                  </button>
                </div>
              ))
            ) : (
              <div className="flex min-h-[140px] items-center justify-center text-[10px] uppercase tracking-[0.24em] text-gray-600">
                NO_WEAK_TOPIC_SIGNAL_YET
              </div>
            )}
          </div>
        </GlassPanel>

        <GlassPanel title="RECENT_SESSION_TAPE" tag="LIVE_LOG" className="col-span-12 lg:col-span-4">
          <div className="max-h-[260px] overflow-y-auto space-y-1">
            {recentSessions.length ? (
              recentSessions.map((session, index) => (
                <div
                  key={`${session.id ?? index}-${session.topic ?? "session"}`}
                  className="grid grid-cols-[1fr_70px_60px] items-center border-b border-white/5 py-2 px-2 text-[10px] uppercase tracking-[0.14em] hover:bg-white/5 rounded"
                >
                  <div className="truncate text-white">
                    {session.topic ?? session.subject ?? "SESSION"}
                    <div className="text-[9px] text-gray-600 mt-0.5">
                      {getSessionDate(session)?.toLocaleString("en-IN") ?? "NO_TIMESTAMP"}
                    </div>
                  </div>
                  <div className="text-right text-gray-400">
                    {getSessionQuestions(session) || 1} Q
                  </div>
                  <div className="text-right font-bold text-orange-400">
                    +{getSessionXp(session)}
                  </div>
                </div>
              ))
            ) : (
              <div className="flex min-h-[160px] items-center justify-center text-[10px] uppercase tracking-[0.24em] text-gray-600">
                SESSION_TAPE_STANDBY
              </div>
            )}
          </div>
        </GlassPanel>

        <GlassPanel title="AI_INSIGHT_FEED" tag="COACH" className="col-span-12 lg:col-span-3">
          <div className="space-y-3">
            {data.insights.length ? (
              data.insights.map((insight, index) => (
                <div
                  key={`${insight.type}-${index}`}
                  className="rounded-lg border border-white/10 bg-black/20 p-3"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="h-2 w-2 rounded-full bg-[#00A3FF] animate-pulse" />
                    <span
                      className={cn(
                        "text-[9px] font-bold uppercase tracking-[0.2em]",
                        insight.severity === "warning" && "text-orange-400",
                        insight.severity === "success" && "text-emerald-400",
                        insight.severity !== "warning" && insight.severity !== "success" && "text-[#00A3FF]",
                      )}
                    >
                      {insight.type ?? "signal"}
                    </span>
                  </div>
                  <p className="text-sm text-gray-300 leading-5">{insight.message}</p>
                </div>
              ))
            ) : (
              <div className="flex min-h-[160px] items-center justify-center text-[10px] uppercase tracking-[0.24em] text-gray-600">
                AI_SIGNAL_PENDING
              </div>
            )}
          </div>
        </GlassPanel>
      </div>
    </div>
  );
}