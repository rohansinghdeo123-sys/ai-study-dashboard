"use client";

import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import AgentifiedNotification from "@/components/AgentifiedNotification";
import CoachWidget from "@/components/CoachWidget";
import Button from "@/components/ui/Button";

// ─── Types ─────────────────────────────────────────────────────────────────
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
  trend?: number;
}

interface Insight {
  type?: string;
  message: string;
  severity?: string;
}

type ChartMode = "xp" | "accuracy" | "attempts";
type ChartRange = "7D" | "14D" | "30D";

type DashboardData = {
  progress: Progress;
  leaderboard: LeaderboardUser[];
  sessions: SessionRecord[];
  trends: TrendPoint[];
  weakAreas: WeakArea[];
  insights: Insight[];
  error: string | null;
};

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

const EMPTY_DASHBOARD_DATA: DashboardData = {
  progress: EMPTY_PROGRESS,
  leaderboard: [],
  sessions: [],
  trends: [],
  weakAreas: [],
  insights: [],
  error: null,
};

const DASHBOARD_CACHE_VERSION = 1;
const DASHBOARD_CACHE_TTL_MS = 10 * 60 * 1000;

type DashboardCacheRecord = {
  version: number;
  userId: string;
  savedAt: number;
  data: DashboardData;
};

// ─── Utility functions (unchanged) ─────────────────────────────────────────
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

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null;
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

function getUserDisplayName(user: unknown) {
  if (!isRecord(user)) return "UNKNOWN_USER";
  return String(user.displayName || user.phoneNumber || user.email || user.uid || "UNKNOWN_USER");
}

// ── IMPROVED: uses shortId for missing names ──────────────────────────────
function getLeaderboardDisplayName(entry: LeaderboardUser, currentUserId: string, currentDisplayName: string) {
  if (entry.user_id === currentUserId) return currentDisplayName;
  return entry.display_name || entry.name || entry.phone || entry.email || shortId(entry.user_id);
}

async function readJson(url: string, headers?: HeadersInit) {
  const response = await fetch(url, { cache: "no-store", headers });
  if (!response.ok) return null;
  return response.json();
}

async function safeReadJson(url: string, headers?: HeadersInit) {
  try {
    return await readJson(url, headers);
  } catch {
    return null;
  }
}

function getDashboardCacheKey(userId: string) {
  return `agentify-dashboard-cache:${DASHBOARD_CACHE_VERSION}:${userId}`;
}

function readDashboardCache(userId: string) {
  if (typeof window === "undefined") return null;

  try {
    const raw = localStorage.getItem(getDashboardCacheKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DashboardCacheRecord;
    if (parsed.version !== DASHBOARD_CACHE_VERSION || parsed.userId !== userId) return null;
    if (Date.now() - parsed.savedAt > DASHBOARD_CACHE_TTL_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeDashboardCache(userId: string, data: DashboardData) {
  if (typeof window === "undefined") return;

  try {
    const record: DashboardCacheRecord = {
      version: DASHBOARD_CACHE_VERSION,
      userId,
      savedAt: Date.now(),
      data,
    };
    localStorage.setItem(getDashboardCacheKey(userId), JSON.stringify(record));
  } catch {}
}

// ─── Data normalizers (unchanged) ──────────────────────────────────────────
function normalizeProgress(source: unknown, userId: string): Progress {
  if (!isRecord(source)) {
    return { ...EMPTY_PROGRESS, user_id: userId };
  }
  const summary = isRecord(source.summary) ? source.summary : source;
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
    .filter((user) => user !== null) as LeaderboardUser[];
}

function normalizeSessions(source: unknown): SessionRecord[] {
  if (Array.isArray(source)) return source.filter(Boolean) as SessionRecord[];
  if (isRecord(source) && Array.isArray(source.sessions)) {
    return source.sessions.filter(Boolean) as SessionRecord[];
  }
  return [];
}

function normalizeTrends(source: unknown): TrendPoint[] {
  if (!Array.isArray(source)) return [];
  return source.filter(Boolean) as TrendPoint[];
}

function normalizeWeakAreas(analytics: unknown): WeakArea[] {
  const analyticsRecord = isRecord(analytics) ? analytics : {};
  const weakAreas = Array.isArray(analyticsRecord.weak_areas) ? analyticsRecord.weak_areas : [];
  const heatmap = Array.isArray(analyticsRecord.topic_heatmap) ? analyticsRecord.topic_heatmap : [];

  const directWeak = weakAreas.map((item) => {
    const row = isRecord(item) ? item : {};
    return {
      topic: String(row.topic ?? "UNKNOWN_TOPIC"),
      accuracy: toNumber(row.accuracy ?? row.value),
      attempts: row.attempts !== undefined ? toNumber(row.attempts) : undefined,
      avg_time: row.avg_time !== undefined ? toNumber(row.avg_time) : undefined,
      trend: row.trend !== undefined ? toNumber(row.trend) : undefined,
    };
  });

  if (directWeak.length) return directWeak.slice(0, 5);

  return heatmap
    .map((item) => {
      const row = isRecord(item) ? item : {};
      return {
        topic: String(row.topic ?? "UNKNOWN_TOPIC"),
        accuracy: toNumber(row.accuracy ?? row.value),
        attempts: row.attempts !== undefined ? toNumber(row.attempts) : undefined,
        trend: row.trend !== undefined ? toNumber(row.trend) : undefined,
      };
    })
    .filter((item: WeakArea) => item.accuracy < 60)
    .slice(0, 5);
}

function normalizeInsights(analytics: unknown): Insight[] {
  const analyticsRecord = isRecord(analytics) ? analytics : {};
  const insights = Array.isArray(analyticsRecord.insights) ? analyticsRecord.insights : [];
  return insights
    .map((item) => {
      const row = isRecord(item) ? item : {};
      return {
        type: row.type ? String(row.type) : "signal",
        message: String(row.message ?? ""),
        severity: row.severity ? String(row.severity) : "info",
      };
    })
    .filter((item: Insight) => item.message)
    .slice(0, 3);
}

function buildDashboardData({
  currentUserId,
  currentDisplayName,
  userEmail,
  userPhone,
  dashboardPayload,
  progressPayload,
  leaderboardPayload,
  sessionsPayload,
  analyticsPayload,
}: {
  currentUserId: string;
  currentDisplayName: string;
  userEmail?: string | null;
  userPhone?: string | null;
  dashboardPayload?: unknown;
  progressPayload?: unknown;
  leaderboardPayload?: unknown;
  sessionsPayload?: unknown;
  analyticsPayload?: unknown;
}): DashboardData {
  const dashboard = dashboardPayload && typeof dashboardPayload === "object" ? dashboardPayload : {};
  const dashboardRecord = dashboard as Record<string, unknown>;
  const analyticsSource =
    dashboardRecord.analytics ??
    dashboardRecord.advanced_analytics ??
    analyticsPayload ??
    {};
  const analyticsRecord =
    analyticsSource && typeof analyticsSource === "object"
      ? (analyticsSource as Record<string, unknown>)
      : {};

  const progress = normalizeProgress(
    dashboardRecord.progress ??
      dashboardRecord.user_progress ??
      dashboardRecord.summary ??
      progressPayload ??
      analyticsRecord.summary,
    currentUserId,
  );

  const rawLeaderboard = dashboardRecord.leaderboard ?? dashboardRecord.rankings ?? leaderboardPayload ?? [];
  const leaderboard = normalizeLeaderboard(rawLeaderboard).map((entry) =>
    entry.user_id === currentUserId
      ? {
          ...entry,
          display_name: currentDisplayName,
          email: userEmail ?? entry.email,
          phone: userPhone ?? entry.phone,
        }
      : entry,
  );

  if (!leaderboard.some((entry) => entry.user_id === currentUserId)) {
    leaderboard.push({
      rank: leaderboard.length + 1,
      user_id: currentUserId,
      display_name: currentDisplayName,
      email: userEmail ?? undefined,
      phone: userPhone ?? undefined,
      xp: progress.xp,
      streak: progress.streak,
      total_tests: progress.total_tests,
    });
  }

  return {
    progress,
    leaderboard,
    sessions: normalizeSessions(
      dashboardRecord.sessions ??
        dashboardRecord.session_history ??
        dashboardRecord.recent_sessions ??
        sessionsPayload,
    ),
    trends: normalizeTrends(
      dashboardRecord.performance_trends ??
        dashboardRecord.trends ??
        analyticsRecord.performance_trends,
    ),
    weakAreas: normalizeWeakAreas(analyticsSource),
    insights: normalizeInsights(analyticsSource),
    error: null,
  };
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

// ─── Skeleton components ───────────────────────────────────────────────────
function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-white/[0.08] ${className || ""}`} />;
}

// ─── Glass components (theme‑aware placeholders) ───────────────────────────
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
        "inline-flex border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.22em] font-mono",
        tone === "orange" && "border-orange-500/30 bg-orange-500/10 text-orange-500",
        tone === "green" && "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
        tone === "blue" && "border-[#0E7490]/30 bg-[#0E7490]/10 text-[#0E7490]",
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
  loading,
}: {
  label: string;
  value: string | number;
  accent?: "neutral" | "orange" | "green" | "red" | "blue";
  loading?: boolean;
}) {
  return (
    <div
      data-accent={accent}
      className="dashboard-stat-card relative overflow-hidden rounded-lg border border-white/10 bg-[#0E1118]/90 p-5 shadow-[0_18px_50px_rgba(0,0,0,0.18)] backdrop-blur-xl transition-all hover:border-white/20 hover:bg-[#111520]/90"
    >
      <div className="text-[11px] font-medium text-slate-500">{label.replace(/_/g, " ")}</div>
      <div
        className={cn(
          "mt-2 text-2xl font-semibold tracking-tight",
          accent === "orange" && "text-orange-400",
          accent === "green" && "text-emerald-400",
          accent === "red" && "text-red-400",
          accent === "blue" && "text-[#0E7490]",
          accent === "neutral" && "text-white",
        )}
      >
        {loading ? <Skeleton className="h-8 w-16" /> : value}
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
        "dashboard-panel overflow-hidden rounded-lg border border-white/10 bg-[#0E1118]/90 shadow-[0_18px_50px_rgba(0,0,0,0.18)] backdrop-blur-xl",
        className,
      )}
    >
      <div className="flex items-center justify-between border-b border-white/10 bg-white/[0.025] px-5 py-3.5">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-slate-200">
            {title.replace(/_/g, " ")}
          </span>
          {tag ? <TerminalBadge tone="orange">{tag}</TerminalBadge> : null}
        </div>
        {right}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

function MissionCard({
  label,
  title,
  detail,
  action,
  tone = "blue",
}: {
  label: string;
  title: string;
  detail: string;
  action: React.ReactNode;
  tone?: "blue" | "green" | "orange";
}) {
  return (
    <div data-tone={tone} className="dashboard-mission-card rounded-lg border border-white/10 bg-white/[0.035] p-4">
      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</div>
      <h3 className="mt-2 text-base font-semibold text-white">{title}</h3>
      <p className="mt-2 min-h-[42px] text-sm leading-6 text-slate-400">{detail}</p>
      <div className="mt-4">{action}</div>
    </div>
  );
}

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
  const { user, loading: authLoading, getAuthHeaders } = useAuth();

  const currentUserId = user?.uid ?? "";
  const currentDisplayName = getUserDisplayName(user);

  const [chartMode, setChartMode] = useState<ChartMode>("xp");
  const [chartRange, setChartRange] = useState<ChartRange>("7D");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRankId, setSelectedRankId] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [showAgentNotification, setShowAgentNotification] = useState(false);
  const hydratedCacheUserRef = useRef("");

  const [dataLoading, setDataLoading] = useState(true);

  const [data, setData] = useState<DashboardData>(EMPTY_DASHBOARD_DATA);

  useEffect(() => {
    if (!authLoading && user && !localStorage.getItem("agentify_notification_seen")) {
      setShowAgentNotification(true);
    }
  }, [authLoading, user]);

  const fetchAllData = useCallback(async () => {
    if (!currentUserId) return;
    try {
      if (hydratedCacheUserRef.current !== currentUserId) {
        hydratedCacheUserRef.current = currentUserId;
        const cached = readDashboardCache(currentUserId);

        if (cached) {
          setData(cached.data);
          setLastRefresh(new Date(cached.savedAt));
          setDataLoading(false);
        } else {
          setData((prev) => ({ ...prev, progress: { ...prev.progress, user_id: currentUserId } }));
          setDataLoading(true);
        }
      }

      const headers = await getAuthHeaders();

      const dashboardPromise = safeReadJson(`${backendURL}/dashboard/${currentUserId}`, headers);
      const progressPromise = safeReadJson(`${backendURL}/get-progress/${currentUserId}`, headers);
      const leaderboardPromise = safeReadJson(`${backendURL}/leaderboard`, headers);
      const sessionsPromise = safeReadJson(`${backendURL}/sessions/${currentUserId}`, headers);
      const analyticsPromise = safeReadJson(`${backendURL}/analytics/${currentUserId}`, headers);

      const progressPayload = await progressPromise;

      if (progressPayload) {
        setData((prev) => {
          const nextData = {
            ...prev,
            progress: normalizeProgress(progressPayload, currentUserId),
            error: null,
          };
          writeDashboardCache(currentUserId, nextData);
          return nextData;
        });
        setDataLoading(false);
      }

      const [dashboardPayload, leaderboardPayload, sessionsPayload, analyticsPayload] =
        await Promise.all([dashboardPromise, leaderboardPromise, sessionsPromise, analyticsPromise]);

      const nextData = buildDashboardData({
        currentUserId,
        currentDisplayName,
        userEmail: user?.email,
        userPhone: user?.phoneNumber,
        dashboardPayload,
        progressPayload,
        leaderboardPayload,
        sessionsPayload,
        analyticsPayload,
      });

      setData(nextData);
      writeDashboardCache(currentUserId, nextData);
      setLastRefresh(new Date());
    } catch (error) {
      console.error("TERMINAL_FETCH_ERROR:", error);
      setData((prev) => ({
        ...prev,
        progress: { ...EMPTY_PROGRESS, user_id: currentUserId },
        error: "BACKEND_SYNC_ERROR",
      }));
    } finally {
      setDataLoading(false);
    }
  }, [backendURL, currentUserId, currentDisplayName, getAuthHeaders, user?.email, user?.phoneNumber]);

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

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  }, []);

  const weakCount = data.weakAreas.length;
  const primaryWeakTopic = data.weakAreas[0]?.topic;
  const latestSession = recentSessions[0];
  const missionTopic = primaryWeakTopic ?? latestSession?.topic ?? latestSession?.subject ?? "alkanes";
  const missionTitle = primaryWeakTopic
    ? `Repair ${primaryWeakTopic}`
    : data.progress.total_questions > 0
      ? "Keep your learning streak warm"
      : "Start your first focused sprint";
  const missionDetail = primaryWeakTopic
    ? `Your AI coach detected ${primaryWeakTopic} as the most useful topic to revise next.`
    : data.progress.total_questions > 0
      ? "Continue with a short explanation, then test yourself with a few focused MCQs."
      : "Begin with one clear concept explanation and let your coach build your learning profile.";
  const readinessLabel =
    analytics.accuracy >= 75
      ? "Exam ready"
      : analytics.accuracy >= 45
        ? "Building confidence"
        : "Needs guided practice";

  const goToTopic = useCallback(
    (topic: string) => {
      router.push(`/dashboard/study?chapter=hydrocarbon&topic=${topic}`);
    },
    [router],
  );

  if (authLoading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-terminal-950 font-mono text-terminal-blue">
        <div className="animate-pulse text-sm uppercase tracking-[0.28em]">
          {authLoading ? "VERIFYING_SESSION..." : "REDIRECTING..."}
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-command-center w-full space-y-6 text-slate-100">
      <div className="dashboard-hero-card rounded-lg border border-white/10 bg-[#0E1118]/90 p-5 shadow-[0_18px_50px_rgba(0,0,0,0.20)] backdrop-blur-xl md:p-6">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-stretch">
          <div className="min-w-0">
            <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-200/80">
              Student Command Center
            </div>
            <h1 className="text-3xl font-semibold tracking-tight text-white md:text-4xl">
              {greeting}, <span className="text-cyan-200">{currentDisplayName}</span>
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">
              {dataLoading ? (
                <Skeleton className="h-5 w-64" />
              ) : (
                missionDetail
              )}
            </p>

            <div className="mt-6 grid gap-3 md:grid-cols-3">
              <MissionCard
                label="Daily mission"
                title={missionTitle}
                detail={weakCount > 0 ? `${weakCount} topic${weakCount > 1 ? "s" : ""} need attention today.` : "Build momentum with one complete learning loop."}
                tone="blue"
                action={
                  <Button size="sm" onClick={() => goToTopic(missionTopic)}>
                    Start in Study Lab
                  </Button>
                }
              />
              <MissionCard
                label="Practice target"
                title={`${Math.max(5, 10 - Math.min(5, data.progress.total_questions))} smart questions`}
                detail="A short MCQ sprint is enough to give your AI coach a stronger signal."
                tone="green"
                action={
                  <Button variant="secondary" size="sm" onClick={() => router.push("/dashboard/study")}>
                    Generate Practice
                  </Button>
                }
              />
              <MissionCard
                label="Coach insight"
                title={readinessLabel}
                detail={analytics.accuracy > 0 ? `Your current accuracy signal is ${analytics.accuracy}%.` : "Your accuracy signal will unlock after practice."}
                tone="orange"
                action={
                  <Button variant="secondary" size="sm" onClick={() => router.push("/dashboard/progress")}>
                    View Analytics
                  </Button>
                }
              />
            </div>
          </div>

          <div className="dashboard-readiness-card rounded-lg border border-white/10 bg-white/[0.035] p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Learning readiness</p>
                <p className="mt-2 text-3xl font-semibold text-white">{analytics.accuracy}%</p>
              </div>
              <span className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-emerald-300">
                {data.error ? "Sync warning" : "Live"}
              </span>
            </div>
            <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-gradient-to-r from-cyan-300 via-emerald-300 to-amber-300 transition-all duration-1000"
                style={{ width: `${clamp(analytics.accuracy)}%` }}
              />
            </div>
            <div className="mt-5 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-md border border-white/10 bg-white/[0.035] p-3">
                <p className="text-[10px] uppercase text-slate-500">Level</p>
                <p className="mt-1 text-lg font-semibold text-white">{analytics.level}</p>
              </div>
              <div className="rounded-md border border-white/10 bg-white/[0.035] p-3">
                <p className="text-[10px] uppercase text-slate-500">Streak</p>
                <p className="mt-1 text-lg font-semibold text-white">{data.progress.streak}d</p>
              </div>
              <div className="rounded-md border border-white/10 bg-white/[0.035] p-3">
                <p className="text-[10px] uppercase text-slate-500">Rank</p>
                <p className="mt-1 text-lg font-semibold text-white">#{currentRank?.rank ?? "-"}</p>
              </div>
            </div>
            <div className="mt-5 rounded-md border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-slate-400">
              <span className="mr-2 inline-flex h-2 w-2 rounded-full bg-emerald-300" />
              Updated {lastRefresh.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <GlassCard label="Student" value={currentDisplayName} loading={dataLoading} />
        <GlassCard label="Questions" value={data.progress.total_questions} accent="orange" loading={dataLoading} />
        <GlassCard
          label="Accuracy"
          value={`${analytics.accuracy}%`}
          accent={analytics.accuracy >= 75 ? "green" : analytics.accuracy >= 45 ? "orange" : "red"}
          loading={dataLoading}
        />
        <GlassCard label="Streak" value={`${data.progress.streak} Days`} accent="orange" loading={dataLoading} />
        <GlassCard label="Level" value={`LVL ${analytics.level}`} accent="blue" loading={dataLoading} />
        <GlassCard
          label="Coach Status"
          value={data.error ? "SYNC_WARN" : "LIVE"}
          accent={data.error ? "red" : "green"}
          loading={dataLoading}
        />
      </div>

      {/* Main content rows */}
      <div className="grid grid-cols-12 gap-5">
        <GlassPanel
          title="PERFORMANCE_HISTORY"
          tag={chartHasSignal ? "LIVE_DATA" : "SPARSE_FEED"}
          className="col-span-12 lg:col-span-8"
          right={
            <div className="flex flex-wrap items-center gap-2">
              {(["xp", "accuracy", "attempts"] as const).map((mode) => (
                <Button
                  key={mode}
                  variant="ghost"
                  size="sm"
                  className={cn(
                    "!font-mono",
                    chartMode === mode ? "!text-orange-400 !bg-orange-500/10" : "!text-gray-500",
                  )}
                  onClick={() => setChartMode(mode)}
                >
                  {mode}
                </Button>
              ))}
              {(["7D", "14D", "30D"] as const).map((range) => (
                <Button
                  key={range}
                  variant="ghost"
                  size="sm"
                  className={cn(
                    "!font-mono",
                    chartRange === range ? "!text-emerald-400 !bg-emerald-500/10" : "!text-gray-500",
                  )}
                  onClick={() => setChartRange(range)}
                >
                  {range}
                </Button>
              ))}
            </div>
          }
        >
          {dataLoading ? (
            <div className="h-[350px] flex items-center justify-center">
              <Skeleton className="h-64 w-full" />
            </div>
          ) : (
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
          )}
        </GlassPanel>

        <div className="col-span-12 lg:col-span-4 space-y-5">
          <GlassPanel title="LEVEL_PROGRESSION" tag="XP">
            {dataLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-8 w-24" />
                <Skeleton className="h-2 w-full" />
                <div className="flex justify-between">
                  <Skeleton className="h-4 w-12" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-12" />
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex justify-between items-baseline">
                  <span className="text-[10px] uppercase tracking-[0.22em] text-gray-500 font-mono">
                    TOTAL_XP
                  </span>
                  <span className="text-4xl font-bold">{data.progress.xp}</span>
                </div>
                <div className="h-2 w-full rounded-full bg-white/5 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-orange-500 to-amber-400 transition-all duration-1000"
                    style={{ width: `${clamp(analytics.xpProgress)}%` }}
                  />
                </div>
                <div className="flex justify-between text-[10px] uppercase tracking-[0.18em] text-gray-500 font-mono">
                  <span>LVL {analytics.level}</span>
                  <span>{100 - analytics.xpProgress} XP TO NEXT</span>
                  <span>LVL {analytics.level + 1}</span>
                </div>
              </div>
            )}
          </GlassPanel>

          {/* GLOBAL RANKINGS panel (simplified skeleton) */}
          <GlassPanel title="GLOBAL_RANKINGS" tag={currentRank ? `RANK_${currentRank.rank}` : "RANKING"}
            right={
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setSearchTerm(currentDisplayName);
                  setSelectedRankId(currentUserId);
                }}
              >
                Find Me
              </Button>
            }
          >
            {dataLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-6 w-full" />
                <Skeleton className="h-6 w-full" />
              </div>
            ) : (
              <>
                <div className="border-b border-white/10 bg-black/20 p-3">
                  <input
                    type="text"
                    value={searchTerm}
                    placeholder="SEARCH NAME / ID..."
                    className="w-full border border-white/10 bg-black/30 px-4 py-2.5 text-xs uppercase tracking-[0.16em] text-white outline-none focus:border-orange-400 rounded-md placeholder-gray-600"
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <div className="max-h-[220px] overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="sticky top-0 border-b border-white/10 bg-black/20 text-gray-500 font-mono">
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
                            <td className="max-w-[160px] truncate p-2">
                              {entry.displayLabel}
                              {isCurrent ? <span className="ml-2 text-[9px] text-emerald-400">YOU</span> : null}
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
              </>
            )}
          </GlassPanel>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-5">
        <GlassPanel title="WEAK_TOPIC_MATRIX" tag="AI_SIGNAL" className="col-span-12 lg:col-span-5">
          {dataLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : data.weakAreas.length ? (
            data.weakAreas.map((topic) => (
              <div
                key={topic.topic}
                className="rounded-xl border border-white/10 bg-black/20 p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
              >
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-base font-bold uppercase font-mono">
                      {topic.topic}
                    </span>
                    <span className="flex items-center gap-1 text-sm">
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
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => goToTopic(topic.topic)}
                >
                  Start Revision
                </Button>
              </div>
            ))
          ) : (
            <div className="flex min-h-[140px] items-center justify-center text-xs uppercase tracking-[0.24em] text-gray-600">
              NO_WEAK_TOPIC_SIGNAL_YET
            </div>
          )}
        </GlassPanel>

        <GlassPanel title="RECENT_SESSION_TAPE" tag="LIVE_LOG" className="col-span-12 lg:col-span-4">
          {dataLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : recentSessions.length ? (
            recentSessions.map((session, index) => (
              <div
                key={`${session.id ?? index}-${session.topic ?? "session"}`}
                className="grid grid-cols-[1fr_80px_70px] items-center border-b border-white/5 py-3 px-3 text-[11px] uppercase tracking-[0.14em] hover:bg-white/5 rounded"
              >
                <div className="truncate">
                  {session.topic ?? session.subject ?? "SESSION"}
                  <div className="text-[10px] text-gray-600 mt-0.5">
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
            <div className="flex min-h-[160px] items-center justify-center text-xs uppercase tracking-[0.24em] text-gray-600">
              SESSION_TAPE_STANDBY
            </div>
          )}
        </GlassPanel>

        <GlassPanel title="AI_INSIGHT_FEED" tag="COACH" className="col-span-12 lg:col-span-3">
          {dataLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : data.progress.total_tests === 0 ? (
            /* No tests taken – show placeholder regardless of any stale insights */
            <div className="flex min-h-[160px] items-center justify-center text-xs uppercase tracking-[0.24em] text-gray-600">
              AI_SIGNAL_PENDING
            </div>
          ) : data.insights.length ? (
            data.insights.map((insight, index) => (
              <div
                key={`${insight.type}-${index}`}
                className="rounded-lg border border-white/10 bg-black/20 p-4"
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className="h-2 w-2 rounded-full bg-[#0E7490] animate-pulse" />
                  <span
                    className={cn(
                      "text-[10px] font-bold uppercase tracking-[0.2em]",
                      insight.severity === "warning" && "text-orange-400",
                      insight.severity === "success" && "text-emerald-400",
                      insight.severity !== "warning" && insight.severity !== "success" && "text-[#0E7490]",
                    )}
                  >
                    {insight.type ?? "signal"}
                  </span>
                </div>
                <p className="text-sm leading-relaxed">{insight.message}</p>
              </div>
            ))
          ) : (
            <div className="flex min-h-[160px] items-center justify-center text-xs uppercase tracking-[0.24em] text-gray-600">
              AI_SIGNAL_PENDING
            </div>
          )}
        </GlassPanel>
      </div>

      <CoachWidget />
      {showAgentNotification && (
        <AgentifiedNotification onDismiss={() => setShowAgentNotification(false)} />
      )}
    </div>
  );
}
