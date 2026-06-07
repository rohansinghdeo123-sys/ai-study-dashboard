"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { LoadingSkeleton } from "@/components/ui/Polished";
import { apiJson } from "@/lib/apiClient";
import { useRouter } from "next/navigation";

// Types
type Session = {
  id: string;
  subject: string;
  topic: string;
  duration: number;
  questions: number;
  correct: number;
  xp: number;
  focusScore: number;
  date?: string;
  timestamp?: string;
  createdAt?: string;
  startedAt?: string;
  completedAt?: string;
  status?: string | null;
  performance?: number | null;
};

type ProgressSummary = {
  user_id: string;
  total_tests: number;
  total_questions: number;
  total_correct: number;
  xp: number;
  streak: number;
  level: number;
  accuracy: number;
  focus_score: number;
  consistency_index: number;
  learning_efficiency: number;
};

type LeaderboardEntry = {
  rank: number;
  user_id: string;
  name?: string;
  display_name?: string;
  email?: string;
  phone?: string;
  xp: number;
  streak: number;
  total_tests: number;
};

type Tone = "neutral" | "blue" | "green" | "amber" | "red";
type TrendRange = "14d" | "8w";

const emptyProgress: ProgressSummary = {
  user_id: "",
  total_tests: 0,
  total_questions: 0,
  total_correct: 0,
  xp: 0,
  streak: 0,
  level: 1,
  accuracy: 0,
  focus_score: 0,
  consistency_index: 0,
  learning_efficiency: 0,
};

const TOPIC_CHAPTER_MAP: Record<string, string> = {
  alkanes: "hydrocarbon",
  alkenes: "hydrocarbon",
  alkynes: "hydrocarbon",
  aromatics: "hydrocarbon",
  matter_definition: "matter",
  states_of_matter: "matter",
  properties_of_matter: "matter",
};

function getChapterForTopic(topic: string) {
  return TOPIC_CHAPTER_MAP[topic.trim().toLowerCase().replace(/\s+/g, "_")] || "hydrocarbon";
}

// Utility functions
function cn(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function sum<T>(items: T[], getValue: (item: T) => number) {
  return items.reduce((total, item) => total + getValue(item), 0);
}

function average<T>(items: T[], getValue: (item: T) => number) {
  if (!items.length) return 0;
  return Math.round(sum(items, getValue) / items.length);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function toNumber(value: unknown, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function shortId(value: string) {
  if (!value) return "UNKNOWN";
  if (value.length <= 12) return value;
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

function getUserDisplayName(user: unknown) {
  if (!isRecord(user)) return "Student";
  return String(user.displayName || user.phoneNumber || user.email || user.uid || "Student");
}

function getLeaderboardDisplayName(entry: LeaderboardEntry, currentUserId: string, currentDisplayName: string) {
  if (entry.user_id === currentUserId) return currentDisplayName;
  return entry.display_name || entry.name || entry.phone || entry.email || `Learner ${shortId(entry.user_id)}`;
}

function getLeaderboardMeta(entry: LeaderboardEntry, currentUserId: string) {
  if (entry.user_id === currentUserId) return "Your profile";
  return entry.email || entry.phone || `ID ${shortId(entry.user_id)}`;
}

function getInitials(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "AI";
}

function getAccuracy(session: Session) {
  return session.questions > 0
    ? Math.round((session.correct / session.questions) * 100)
    : 0;
}

function getSessionDate(session: Session) {
  const raw =
    session.timestamp ??
    session.date ??
    session.createdAt ??
    session.startedAt ??
    session.completedAt;
  if (!raw) return null;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatMinutes(value: number) {
  if (!Number.isFinite(value)) return "0M";
  if (value >= 60) {
    const hours = Math.floor(value / 60);
    const mins = value % 60;
    return mins ? `${hours}H ${mins}M` : `${hours}H`;
  }
  return `${value}M`;
}

function formatHours(value: number) {
  return `${(value / 60).toFixed(1)}H`;
}

function getScoreTone(value: number): Tone {
  if (value >= 85) return "green";
  if (value >= 70) return "blue";
  if (value >= 55) return "amber";
  return "red";
}

function toneText(tone: Tone) {
  if (tone === "green") return "text-emerald-400";
  if (tone === "blue") return "text-[#0E7490]";
  if (tone === "amber") return "text-amber-400";
  if (tone === "red") return "text-red-400";
  return "text-gray-300";
}

function toneBadge(tone: Tone) {
  if (tone === "green") return "border-emerald-500/30 bg-emerald-500/10 text-emerald-400";
  if (tone === "blue") return "border-[#0E7490]/30 bg-[#0E7490]/10 text-[#0E7490]";
  if (tone === "amber") return "border-amber-400/30 bg-amber-400/10 text-amber-400";
  if (tone === "red") return "border-red-500/30 bg-red-500/10 text-red-400";
  return "border-white/10 bg-white/5 text-gray-400";
}

// Grouping and chart helpers
function groupBySubject(sessions: Session[]) {
  const map = new Map<string, { subject: string; sessions: number; duration: number; xp: number; accuracy: number; focus: number }>();
  for (const session of sessions) {
    const current = map.get(session.subject) ?? { subject: session.subject, sessions: 0, duration: 0, xp: 0, accuracy: 0, focus: 0 };
    current.sessions += 1;
    current.duration += session.duration;
    current.xp += session.xp;
    current.accuracy += getAccuracy(session);
    current.focus += session.focusScore;
    map.set(session.subject, current);
  }
  return [...map.values()].map((item) => ({
    ...item,
    accuracy: Math.round(item.accuracy / item.sessions),
    focus: Math.round(item.focus / item.sessions),
  })).sort((a, b) => b.accuracy - a.accuracy);
}

function groupByTopic(sessions: Session[]) {
  const map = new Map<string, { topic: string; subject: string; sessions: number; duration: number; accuracy: number; xp: number }>();
  for (const session of sessions) {
    const key = `${session.subject}::${session.topic}`;
    const current = map.get(key) ?? { topic: session.topic, subject: session.subject, sessions: 0, duration: 0, accuracy: 0, xp: 0 };
    current.sessions += 1;
    current.duration += session.duration;
    current.accuracy += getAccuracy(session);
    current.xp += session.xp;
    map.set(key, current);
  }
  return [...map.values()].map((item) => ({
    ...item,
    accuracy: Math.round(item.accuracy / item.sessions),
  })).sort((a, b) => b.accuracy - a.accuracy);
}

// New: compute 3-session trend per topic (returns +1, 0, -1)
function getTopicTrend(sessions: Session[], topic: string, subject: string) {
  const relevant = sessions
    .filter((s) => s.subject === subject && s.topic === topic)
    .sort((a, b) => (getSessionDate(b)?.getTime() ?? 0) - (getSessionDate(a)?.getTime() ?? 0))
    .slice(0, 3);
  if (relevant.length < 2) return 0; // not enough data
  const avgOld = average(relevant.slice(1), getAccuracy);
  const avgNew = getAccuracy(relevant[0]);
  return avgNew > avgOld ? 1 : avgNew < avgOld ? -1 : 0;
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

function buildDailySeries(sessions: Session[], days = 14) {
  const dated = sessions.map((s) => ({ s, d: getSessionDate(s) })).filter((item): item is { s: Session; d: Date } => !!item.d);
  if (!dated.length) return [];
  const end = startOfLocalDay(new Date());
  const start = addDays(end, -(days - 1));
  const buckets = new Map<string, Session[]>();
  for (const item of dated) {
    const day = startOfLocalDay(item.d);
    if (day < start || day > end) continue;
    const key = getLocalDayKey(day);
    buckets.set(key, [...(buckets.get(key) ?? []), item.s]);
  }
  return Array.from({ length: days }, (_, i) => {
    const date = addDays(start, i);
    const key = getLocalDayKey(date);
    const bucket = buckets.get(key) ?? [];
    const questions = sum(bucket, (x) => x.questions);
    const correct = sum(bucket, (x) => x.correct);
    return {
      label: date.toLocaleDateString("en-IN", { weekday: "short" }).toUpperCase(),
      sessions: bucket.length,
      duration: sum(bucket, (x) => x.duration),
      xp: sum(bucket, (x) => x.xp),
      accuracy: questions > 0 ? Math.round((correct / questions) * 100) : 0,
      focus: bucket.length ? average(bucket, (x) => x.focusScore) : 0,
    };
  });
}

function buildWeeklySeries(sessions: Session[], weeks = 8) {
  const dated = sessions.map((s) => ({ s, d: getSessionDate(s) })).filter((item): item is { s: Session; d: Date } => !!item.d);
  if (!dated.length) return [];
  const today = startOfLocalDay(new Date());
  const start = addDays(today, -(weeks * 7 - 1));
  return Array.from({ length: weeks }, (_, i) => {
    const ws = addDays(start, i * 7);
    const we = addDays(ws, 6);
    const bucket = dated.filter((item) => {
      const day = startOfLocalDay(item.d);
      return day >= ws && day <= we;
    }).map((item) => item.s);
    const questions = sum(bucket, (x) => x.questions);
    const correct = sum(bucket, (x) => x.correct);
    return {
      label: ws.toLocaleDateString("en-IN", { day: "2-digit", month: "short" }).toUpperCase(),
      sessions: bucket.length,
      duration: sum(bucket, (x) => x.duration),
      xp: sum(bucket, (x) => x.xp),
      accuracy: questions > 0 ? Math.round((correct / questions) * 100) : 0,
      focus: bucket.length ? average(bucket, (x) => x.focusScore) : 0,
    };
  });
}

function buildHeatmap(sessions: Session[], days = 35) {
  const dates = sessions.map((s) => getSessionDate(s)).filter((d): d is Date => !!d);
  if (!dates.length) return [];
  const end = startOfLocalDay(new Date());
  const start = addDays(end, -(days - 1));
  const counts = new Map<string, number>();
  for (const d of dates) {
    const day = startOfLocalDay(d);
    if (day < start || day > end) continue;
    const key = getLocalDayKey(day);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return Array.from({ length: days }, (_, i) => {
    const date = addDays(start, i);
    const key = getLocalDayKey(date);
    return {
      key,
      label: date.toLocaleDateString("en-IN", { day: "2-digit", month: "short" }).toUpperCase(),
      value: counts.get(key) ?? 0,
    };
  });
}

// Data hook
function getLeaderboardRows(source: unknown) {
  if (Array.isArray(source)) return source;
  if (!isRecord(source)) return [];
  if (Array.isArray(source.leaderboard)) return source.leaderboard;
  if (Array.isArray(source.rankings)) return source.rankings;
  if (Array.isArray(source.users)) return source.users;
  return [];
}

function normalizeLeaderboardRows(source: unknown): LeaderboardEntry[] {
  return getLeaderboardRows(source)
    .map((item, index): LeaderboardEntry | null => {
      if (!isRecord(item)) return null;
      const userId = String(item.user_id ?? item.uid ?? item.id ?? item.terminal_id ?? "");
      if (!userId) return null;
      return {
        rank: toNumber(item.rank, index + 1),
        user_id: userId,
        name: item.name ? String(item.name) : undefined,
        display_name: item.display_name ? String(item.display_name) : undefined,
        email: item.email ? String(item.email) : undefined,
        phone: item.phone ? String(item.phone) : undefined,
        xp: toNumber(item.xp ?? item.total_xp),
        streak: toNumber(item.streak),
        total_tests: toNumber(item.total_tests),
      };
    })
    .filter((entry): entry is LeaderboardEntry => entry !== null);
}

function buildLeaderboard({
  sources,
  currentUserId,
  currentDisplayName,
  userEmail,
  userPhone,
  progress,
}: {
  sources: unknown[];
  currentUserId: string;
  currentDisplayName: string;
  userEmail?: string | null;
  userPhone?: string | null;
  progress: ProgressSummary;
}) {
  const merged = new Map<string, LeaderboardEntry>();

  for (const source of sources) {
    for (const entry of normalizeLeaderboardRows(source)) {
      const existing = merged.get(entry.user_id);
      merged.set(entry.user_id, {
        rank: entry.rank || existing?.rank || merged.size + 1,
        user_id: entry.user_id,
        name: entry.name ?? existing?.name,
        display_name: entry.display_name ?? existing?.display_name,
        email: entry.email ?? existing?.email,
        phone: entry.phone ?? existing?.phone,
        xp: entry.xp || existing?.xp || 0,
        streak: entry.streak || existing?.streak || 0,
        total_tests: entry.total_tests || existing?.total_tests || 0,
      });
    }
  }

  const current = merged.get(currentUserId);
  merged.set(currentUserId, {
    rank: current?.rank || merged.size + 1,
    user_id: currentUserId,
    name: current?.name,
    display_name: currentDisplayName,
    email: userEmail ?? current?.email,
    phone: userPhone ?? current?.phone,
    xp: current?.xp ?? progress.xp,
    streak: current?.streak ?? progress.streak,
    total_tests: current?.total_tests ?? progress.total_tests,
  });

  return [...merged.values()]
    .sort((a, b) => b.xp - a.xp)
    .map((entry, index) => ({ ...entry, rank: index + 1 }));
}

async function safeReadJson(url: string, headers?: HeadersInit) {
  try {
    return await apiJson<unknown>(url, {
      headers,
      cacheKey: `analytics-read:${url}`,
      cacheTtlMs: 30000,
      retries: 1,
      timeoutMs: 7000,
    });
  } catch {
    return null;
  }
}

function useDashboardData() {
  const { user, loading: authLoading, getAuthHeaders } = useAuth();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [progress, setProgress] = useState<ProgressSummary>(emptyProgress);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const backendURL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://127.0.0.1:8000";

  useEffect(() => {
    let active = true;
    async function load() {
      if (authLoading) return;
      if (!user?.uid) {
        setSessions([]);
        setProgress(emptyProgress);
        setLeaderboard([]);
        setLoading(false);
        setError("No authenticated user.");
        return;
      }
      try {
        setLoading(true);
        setError(null);
        const headers = await getAuthHeaders();
        const [payload, leaderboardPayload] = await Promise.all([
          safeReadJson(`${backendURL}/dashboard/${user.uid}`, headers),
          safeReadJson(`${backendURL}/leaderboard`, headers),
        ]);
        if (!isRecord(payload)) throw new Error("Failed to load dashboard");
        const progressSummary = { ...emptyProgress, ...(isRecord(payload.progress) ? payload.progress : {}) } as ProgressSummary;
        if (!active) return;
        setSessions(Array.isArray(payload.sessions) ? payload.sessions : []);
        setProgress(progressSummary);
        setLeaderboard(buildLeaderboard({
          sources: [payload.leaderboard, leaderboardPayload],
          currentUserId: user.uid,
          currentDisplayName: getUserDisplayName(user),
          userEmail: user.email,
          userPhone: user.phoneNumber,
          progress: progressSummary,
        }));
      } catch {
        if (active) {
          setSessions([]);
          setProgress(emptyProgress);
          setLeaderboard([]);
          setError("UNABLE TO LOAD DASHBOARD DATA.");
        }
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => { active = false; };
  }, [authLoading, backendURL, getAuthHeaders, reloadToken, user]);

  const retry = useCallback(() => {
    setReloadToken((current) => current + 1);
  }, []);

  return {
    userId: user?.uid ?? "",
    currentDisplayName: getUserDisplayName(user),
    sessions,
    progress,
    leaderboard,
    loading: loading || authLoading,
    error,
    retry,
  };
}

// Glass UI components
function GlassCard({ label, value, tone = "neutral", active = false }: { label: string; value: string; tone?: Tone; active?: boolean }) {
  return (
    <div
      className={cn(
        "progress-glass-card group relative overflow-hidden rounded-2xl border border-cyan-100/10 bg-[linear-gradient(135deg,rgba(8,18,31,0.86),rgba(9,15,27,0.80))] p-4 shadow-[0_16px_44px_rgba(0,0,0,0.18)] backdrop-blur-2xl transition-all duration-200 hover:-translate-y-0.5 hover:border-cyan-200/20 hover:bg-white/[0.055]",
        active && "border-[#14B8A6]/36 bg-[linear-gradient(135deg,rgba(8,47,73,0.58),rgba(8,29,43,0.78))]",
      )}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-200/40 to-transparent" />
      <div className="pointer-events-none absolute -right-10 -top-10 h-24 w-24 rounded-full bg-[#14B8A6]/7 blur-2xl transition group-hover:bg-[#14B8A6]/10" />
      <div className="relative">
        <div className="flex items-center justify-between gap-3">
          <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">{label}</div>
          <span className={cn("h-1.5 w-1.5 rounded-full", tone === "green" ? "bg-emerald-400" : tone === "amber" ? "bg-amber-400" : tone === "red" ? "bg-red-400" : "bg-[#14B8A6]")} />
        </div>
        <div className={cn("mt-3 text-3xl font-semibold tracking-tight", toneText(tone))}>{value}</div>
      </div>
    </div>
  );
}

function GlassPanel({ title, tag, right, className, children }: { title: string; tag?: string; right?: React.ReactNode; className?: string; children: React.ReactNode }) {
  return (
    <section className={cn("progress-glass-panel overflow-hidden rounded-2xl border border-cyan-100/10 bg-[linear-gradient(135deg,rgba(8,18,31,0.88),rgba(10,14,24,0.82))] shadow-[0_18px_54px_rgba(0,0,0,0.20)] backdrop-blur-2xl", className)}>
      <div className="progress-panel-header flex items-center justify-between border-b border-cyan-100/10 bg-white/[0.025] px-5 py-4">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-[#14B8A6] shadow-[0_0_18px_rgba(20,184,166,0.8)]" />
          <span className="text-sm font-bold uppercase tracking-[0.12em] text-slate-100">{title.replace(/_/g, " ")}</span>
          {tag && <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-2 py-1 text-[9px] font-bold uppercase tracking-[0.16em] text-amber-300">{tag}</span>}
        </div>
        {right}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

function TonePill({ children, tone = "neutral" }: { children: React.ReactNode; tone?: Tone }) {
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em]", toneBadge(tone))}>
      {children}
    </span>
  );
}

function Rail({ value, tone = "neutral" }: { value: number; tone?: Tone }) {
  const width = Math.max(0, Math.min(100, value));
  const bg = tone === "green" ? "bg-emerald-400" : tone === "blue" ? "bg-[#14B8A6]" : tone === "amber" ? "bg-amber-400" : tone === "red" ? "bg-red-400" : "bg-gray-400";
  return (
    <div className="progress-rail h-2 w-full overflow-hidden rounded-full bg-white/7">
      <div className={cn("h-full rounded-full shadow-[0_0_22px_currentColor] transition-all duration-700", bg)} style={{ width: `${width}%` }} />
    </div>
  );
}

function EmptyState({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="agentify-state-panel progress-empty-state flex min-h-[220px] flex-col items-center justify-center rounded-3xl border border-dashed border-cyan-100/12 bg-white/[0.025] px-6 text-center">
      <div className="text-[10px] font-bold uppercase tracking-[0.34em] text-cyan-200/45">{title}</div>
      <p className="mt-4 max-w-md text-sm leading-6 text-slate-400">{detail}</p>
    </div>
  );
}

function TrendRangeToggle({ range, setRange }: { range: TrendRange; setRange: (v: TrendRange) => void }) {
  return (
    <div className="flex gap-1">
      {(["14d", "8w"] as const).map((item) => (
        <button
          type="button"
          key={item}
          onClick={() => setRange(item)}
          className={cn(
            "agentify-action",
            "rounded-md border px-3 py-1 text-[10px] font-bold uppercase tracking-[0.22em] transition-all font-mono",
            item === range ? "border-amber-400/40 bg-amber-400/10 text-amber-300" : "border-white/10 text-gray-500 hover:border-white/30 hover:text-white"
          )}
        >
          {item}
        </button>
      ))}
    </div>
  );
}

function LineChart({
  labels,
  series,
  valueSuffix = "",
}: {
  labels: string[];
  series: Array<{ label: string; color: string; data: number[] }>;
  valueSuffix?: string;
}) {
  if (!labels.length || !series.some((s) => s.data.some((v) => Number.isFinite(v)))) {
    return <EmptyState title="No trend data" detail="Timestamped sessions are required to render this chart." />;
  }

  const velocitySeries = series[0];
  const width = 120;
  const height = 66;
  const padding = { top: 7, right: 5, bottom: 10, left: 16 };
  const values = velocitySeries.data.filter((v) => Number.isFinite(v));
  const maxValue = Math.max(...values, 0);
  const yMax = Math.max(100, Math.ceil(maxValue / 25) * 25);
  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;
  const x = (index: number) => padding.left + (labels.length === 1 ? 0 : (index / (labels.length - 1)) * innerWidth);
  const y = (value: number) => padding.top + innerHeight - (Math.max(0, value) / yMax) * innerHeight;
  const baseline = padding.top + innerHeight;
  const ticks = [1, 0.75, 0.5, 0.25, 0].map((p) => Math.round(yMax * p));
  const points = velocitySeries.data.map((v, i) => ({ x: x(i), y: y(v) }));
  const path = points.reduce((currentPath, point, index) => {
    if (index === 0) return `M ${point.x} ${point.y}`;
    const previous = points[index - 1];
    const controlX = (previous.x + point.x) / 2;
    return `${currentPath} C ${controlX} ${previous.y}, ${controlX} ${point.y}, ${point.x} ${point.y}`;
  }, "");
  const areaPath = `${path} L ${points[points.length - 1]?.x ?? padding.left} ${baseline} L ${points[0]?.x ?? padding.left} ${baseline} Z`;

  return (
    <div className="progress-chart-frame relative min-h-[430px] overflow-hidden rounded-[1.6rem] border border-[#1A2C3C] bg-[#050A0D] px-5 py-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.035),0_18px_56px_rgba(0,0,0,0.24)]">
      <div className="progress-chart-grid pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(20,184,166,0.04)_1px,transparent_1px),linear-gradient(to_bottom,rgba(20,184,166,0.03)_1px,transparent_1px)] bg-[size:64px_64px] opacity-45" />
      <div className="progress-chart-wash pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_58%_36%,rgba(255,170,10,0.045),transparent_26%),linear-gradient(180deg,rgba(5,10,13,0)_0%,rgba(5,10,13,0.84)_100%)]" />

      <div className="relative mb-7 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 text-[10px] uppercase tracking-[0.28em] text-slate-400">
          <span className="h-px w-8 bg-[#FFAA0A]" />
          <span>XP Velocity</span>
        </div>
        <div className="rounded-full border border-emerald-400/20 bg-emerald-400/7 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.14em] text-emerald-300">
          Live
        </div>
      </div>

      <svg viewBox={`0 0 ${width} ${height}`} className="relative h-[335px] w-full overflow-visible">
        <defs>
          <linearGradient id="analyticsXpArea" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#FFAA0A" stopOpacity="0.46" />
            <stop offset="48%" stopColor="#FFAA0A" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#FFAA0A" stopOpacity="0" />
          </linearGradient>
          <filter id="analyticsLineGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="1.45" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {ticks.map((tick) => {
          const yPos = y(tick);
          return (
            <g key={tick}>
              <line
                x1={padding.left}
                y1={yPos}
                x2={width - padding.right}
                y2={yPos}
                stroke={tick === 0 ? "#1A2C3C" : "#5A3F13"}
                strokeDasharray={tick === 0 ? "0" : "1.5 2.4"}
                strokeOpacity={tick === 0 ? 0.72 : 0.58}
                strokeWidth={tick === 0 ? 0.42 : 0.32}
              />
              <text
                x={padding.left - 6.4}
                y={yPos - 1}
                fill="#8190A6"
                fontSize="2.9"
                fontFamily="inherit"
                fontWeight="600"
                textAnchor="start"
              >
                {Math.round(tick)}
                {valueSuffix}
              </text>
            </g>
          );
        })}

        <path d={areaPath} fill="url(#analyticsXpArea)" />
        <path
          d={path}
          fill="none"
          stroke="#FFAA0A"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="0.92"
          opacity="0.24"
          transform="translate(0, 0.7)"
        />
        <path
          d={path}
          fill="none"
          stroke="#FFAA0A"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="0.95"
          filter="url(#analyticsLineGlow)"
        />

        {labels.map((label, i) => (
          <text
            key={i}
            x={x(i)}
            y={height - 2}
            fill="#718096"
            fontSize="3"
            fontFamily="inherit"
            fontWeight="600"
            textAnchor="middle"
          >
            {label}
          </text>
        ))}
      </svg>
    </div>
  );
}

// CSV export helper
function downloadCSV(sessions: Session[]) {
  const headers = ["id", "subject", "topic", "duration", "questions", "correct", "accuracy", "xp", "focusScore", "date"];
  const rows = sessions.map((s) => [
    s.id,
    s.subject,
    s.topic,
    s.duration,
    s.questions,
    s.correct,
    getAccuracy(s),
    s.xp,
    s.focusScore,
    getSessionDate(s)?.toISOString().split("T")[0] ?? "",
  ]);
  const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "session_data.csv";
  a.click();
  URL.revokeObjectURL(url);
}

// Main Analytics page component
export default function ProgressPage() {
  const { userId, currentDisplayName, sessions, progress, leaderboard, loading, error, retry } = useDashboardData();
  const [range, setRange] = useState<TrendRange>("14d");
  const router = useRouter();

  // Derived stats
  const totalDuration = useMemo(() => sum(sessions, (s) => s.duration), [sessions]);
  const totalQuestions = progress.total_questions || sum(sessions, (s) => s.questions);
  const totalCorrect = progress.total_correct || sum(sessions, (s) => s.correct);
  const avgAccuracy = totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : 0;
  const totalXp = progress.xp || sum(sessions, (s) => s.xp);
  const levelProgress = Math.max(2, Math.min(100, totalXp % 100));
  const xpToNext = Math.max(0, 100 - (totalXp % 100));

  const subjects = useMemo(() => groupBySubject(sessions), [sessions]);
  const topics = useMemo(() => groupByTopic(sessions), [sessions]);
  const bestSubject = subjects[0]?.subject ?? "-";
  const worstTopic = topics.length ? topics[topics.length - 1] : null;

  const daily = useMemo(() => buildDailySeries(sessions, 14), [sessions]);
  const weekly = useMemo(() => buildWeeklySeries(sessions, 8), [sessions]);
  const heatmap = useMemo(() => buildHeatmap(sessions, 35), [sessions]);

  const trendLabels = range === "14d" ? daily.map((d) => d.label) : weekly.map((w) => w.label);
  const trendXp = range === "14d" ? daily.map((d) => d.xp) : weekly.map((w) => w.xp);
  const avgFocus = progress.focus_score || average(sessions, (session) => session.focusScore);
  const readinessScore = Math.round(
    Math.min(100, (avgAccuracy * 0.45) + (avgFocus * 0.25) + (Math.min(progress.streak * 12, 100) * 0.15) + (Math.min(progress.total_tests * 10, 100) * 0.15)),
  );
  const readinessTone = getScoreTone(readinessScore);

  const weeklyLabels = weekly.map((w) => w.label);
  const weeklyDurations = weekly.map((w) => w.duration);

  // Cohort comparison
  const leaderboardAvg = useMemo(() => {
    if (!leaderboard.length) return { xp: 0, streak: 0 };
    return {
      xp: Math.round(average(leaderboard, (e) => e.xp)),
      streak: Math.round(average(leaderboard, (e) => e.streak || 0)),
    };
  }, [leaderboard]);

  // Predictive insights
  const insights = useMemo(() => {
    const list: { type: "positive" | "negative" | "neutral"; message: string }[] = [];
    if (daily.length && daily.some((d) => d.xp > 0)) {
      const avgDailyXp = average(daily, (d) => d.xp);
      if (avgDailyXp > 0) {
        const daysToNextLevel = Math.ceil(xpToNext / avgDailyXp);
        list.push({ type: "neutral", message: `At current pace, you'll reach Level ${(progress.level || 1) + 1} in ~${daysToNextLevel} days.` });
      }
    }
    if (worstTopic && worstTopic.accuracy < 60) {
      list.push({ type: "negative", message: `Accuracy on ${worstTopic.topic} is ${worstTopic.accuracy}% - focused revision recommended.` });
    } else if (worstTopic) {
      list.push({ type: "positive", message: `Your weakest topic (${worstTopic.topic}) is at ${worstTopic.accuracy}% - keep improving.` });
    }
    if (progress.streak >= 5) {
      list.push({ type: "positive", message: `You have a ${progress.streak}-day streak! Keep the momentum.` });
    }
    // New insights based on consistency / efficiency
    if (progress.consistency_index > 0) {
      const consistencyLabel = progress.consistency_index >= 80 ? "very consistent" : progress.consistency_index >= 60 ? "moderately consistent" : "irregular";
      list.push({ type: progress.consistency_index >= 60 ? "positive" : "neutral", message: `Study consistency: ${progress.consistency_index}% (${consistencyLabel}).` });
    }
    if (progress.learning_efficiency > 0) {
      list.push({ type: progress.learning_efficiency >= 70 ? "positive" : "neutral", message: `Learning efficiency: ${progress.learning_efficiency}% - ${progress.learning_efficiency >= 70 ? "excellent" : "room to grow"}.` });
    }
    if (!list.length) {
      list.push({ type: "neutral", message: "Complete more sessions to unlock predictive insights." });
    }
    return list;
  }, [daily, worstTopic, progress, xpToNext]);

  const rankedLeaderboard = useMemo(() => {
    return [...leaderboard]
      .sort((a, b) => b.xp - a.xp)
      .map((entry, index) => ({
        ...entry,
        rank: index + 1,
        displayLabel: getLeaderboardDisplayName(entry, userId, currentDisplayName),
        metaLabel: getLeaderboardMeta(entry, userId),
      }));
  }, [leaderboard, userId, currentDisplayName]);

  const currentRank = useMemo(() => (
    rankedLeaderboard.find((e) => e.user_id === userId) ?? {
      rank: 1,
      user_id: userId,
      display_name: currentDisplayName,
      xp: totalXp,
      streak: progress.streak,
      total_tests: progress.total_tests,
      displayLabel: currentDisplayName,
      metaLabel: "Your profile",
    }
  ), [rankedLeaderboard, userId, currentDisplayName, totalXp, progress.streak, progress.total_tests]);

  const visibleLeaderboard = useMemo(
    () => (rankedLeaderboard.length ? rankedLeaderboard : [currentRank]).slice(0, 6),
    [rankedLeaderboard, currentRank],
  );
  const maxLeaderboardXp = Math.max(1, ...visibleLeaderboard.map((entry) => entry.xp));

  const handleExportCSV = useCallback(() => downloadCSV(sessions), [sessions]);

  // Weak topic spotlight (top 3 weak topics with trends)
  const weakTopics = useMemo(() => {
    return topics
      .filter((t) => t.accuracy < 60)
      .sort((a, b) => a.accuracy - b.accuracy)
      .slice(0, 3)
      .map((t) => ({
        ...t,
        trend: getTopicTrend(sessions, t.topic, t.subject),
      }));
  }, [topics, sessions]);
  const priorityCommand = weakTopics[0]
    ? `Revise ${weakTopics[0].topic} next`
    : sessions.length
    ? "Take one timed exam set"
    : "Start first tracked session";
  const latestSession = useMemo(() => {
    return [...sessions].sort((a, b) => (getSessionDate(b)?.getTime() ?? 0) - (getSessionDate(a)?.getTime() ?? 0))[0] ?? null;
  }, [sessions]);

  const handleReviseTopic = useCallback((topic: string) => {
    const normalizedTopic = topic.trim().toLowerCase().replace(/\s+/g, "_");
    router.push(`/dashboard/study?chapter=${encodeURIComponent(getChapterForTopic(topic))}&topic=${encodeURIComponent(normalizedTopic)}`);
  }, [router]);

  if (loading) {
    return (
      <main className="mx-auto min-h-[calc(100svh-105px)] w-full max-w-[1880px] space-y-5 py-5">
        <LoadingSkeleton className="h-28 rounded-[2rem] border border-white/10 bg-slate-900/70 p-6" />
        <section className="grid gap-5 lg:grid-cols-2">
          <LoadingSkeleton className="h-64 rounded-[2rem] border border-white/10 bg-slate-900/70 p-6" />
          <LoadingSkeleton className="h-64 rounded-[2rem] border border-white/10 bg-slate-900/70 p-6" />
        </section>
        <LoadingSkeleton className="h-72 rounded-[2rem] border border-white/10 bg-slate-900/70 p-6" />
      </main>
    );
  }

  return (
    <div className="progress-analytics-shell relative -mx-1 overflow-hidden rounded-[2.2rem] border border-cyan-100/10 bg-[radial-gradient(circle_at_12%_0%,rgba(20,184,166,0.10),transparent_30%),radial-gradient(circle_at_88%_4%,rgba(242,184,75,0.09),transparent_28%),linear-gradient(135deg,#06111D_0%,#080D16_50%,#0D1420_100%)] p-4 text-slate-200 shadow-[0_26px_80px_rgba(0,0,0,0.28)] sm:p-6">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(148,163,184,0.04)_1px,transparent_1px),linear-gradient(to_bottom,rgba(148,163,184,0.035)_1px,transparent_1px)] bg-[size:64px_64px] opacity-45" />
      <div className="pointer-events-none absolute inset-x-12 top-0 h-px bg-gradient-to-r from-transparent via-cyan-200/40 to-transparent" />

      <div className="relative space-y-6">
        <section className="progress-hero-panel overflow-hidden rounded-[2rem] border border-cyan-100/12 bg-[linear-gradient(135deg,rgba(8,20,34,0.92),rgba(7,12,22,0.82))] shadow-[0_28px_90px_rgba(0,0,0,0.28)] backdrop-blur-2xl">
          <div className="grid gap-0 xl:grid-cols-[minmax(0,1.25fr)_420px]">
            <div className="p-6 sm:p-8">
              <div className="flex flex-wrap items-center gap-2">
                <TonePill tone="blue">Analytics</TonePill>
                <TonePill tone={error ? "amber" : "green"}>{error ? "Degraded" : "Live sync"}</TonePill>
                <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
                  Learner: {currentDisplayName}
                </span>
              </div>
              <h1 className="mt-6 max-w-4xl text-4xl font-semibold tracking-tight text-white sm:text-5xl">
                Learning intelligence
              </h1>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-400 sm:text-base">
                Track mastery, rank, weak topics, consistency, and the next best study action from one calm view.
              </p>
              {error ? (
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-300">{error}</p>
                  <button
                    type="button"
                    onClick={retry}
                    className="agentify-action rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-amber-300 transition hover:bg-amber-400/16"
                  >
                    Retry sync
                  </button>
                </div>
              ) : null}

              <div className="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <div className="progress-mini-card rounded-2xl border border-white/10 bg-white/[0.035] p-4">
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Priority action</p>
                  <p className="mt-2 text-sm font-semibold text-white">{priorityCommand}</p>
                </div>
                <div className="progress-mini-card rounded-2xl border border-white/10 bg-white/[0.035] p-4">
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Tracked sessions</p>
                  <p className="mt-2 text-2xl font-semibold text-[#14B8A6]">{sessions.length}</p>
                </div>
                <div className="progress-mini-card rounded-2xl border border-white/10 bg-white/[0.035] p-4">
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Latest topic</p>
                  <p className="mt-2 truncate text-sm font-semibold text-white">{latestSession?.topic || "No session yet"}</p>
                </div>
                <button
                  type="button"
                  onClick={handleExportCSV}
                  disabled={!sessions.length}
                  aria-disabled={!sessions.length}
                  title={sessions.length ? "Download session data as CSV" : "Complete one tracked session to export data"}
                  className="agentify-action rounded-2xl border border-[#14B8A6]/30 bg-[#14B8A6]/10 p-4 text-left transition hover:-translate-y-0.5 hover:bg-[#14B8A6]/16 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
                >
                  <span className="block text-[10px] font-bold uppercase tracking-[0.16em] text-[#67E8F9]">Export</span>
                  <span className="mt-2 block text-sm font-semibold text-white">Download CSV</span>
                </button>
              </div>
            </div>

            <div className="progress-readiness-pane border-t border-cyan-100/10 bg-white/[0.025] p-6 xl:border-l xl:border-t-0">
              <div className="progress-readiness-card rounded-[2rem] border border-cyan-100/12 bg-black/20 p-5">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Readiness score</p>
                  <TonePill tone={readinessTone}>{readinessScore >= 70 ? "Stable" : "Needs work"}</TonePill>
                </div>
                <div className="mt-6 flex items-end gap-3">
                  <span className={cn("text-7xl font-semibold tracking-tight", toneText(readinessTone))}>{readinessScore}</span>
                  <span className="pb-3 text-sm font-semibold text-slate-500">/ 100</span>
                </div>
                <div className="mt-5">
                  <Rail value={readinessScore} tone={readinessTone} />
                </div>
                <div className="mt-6 grid grid-cols-2 gap-3 text-xs">
                  <div className="progress-mini-card rounded-2xl border border-white/10 bg-white/[0.035] p-3">
                    <span className="block text-slate-500">Accuracy</span>
                    <span className="mt-1 block text-lg font-semibold text-white">{avgAccuracy}%</span>
                  </div>
                  <div className="progress-mini-card rounded-2xl border border-white/10 bg-white/[0.035] p-3">
                    <span className="block text-slate-500">Focus</span>
                    <span className="mt-1 block text-lg font-semibold text-white">{avgFocus}</span>
                  </div>
                  <div className="progress-mini-card rounded-2xl border border-white/10 bg-white/[0.035] p-3">
                    <span className="block text-slate-500">Rank</span>
                    <span className="mt-1 block text-lg font-semibold text-white">#{currentRank.rank}</span>
                  </div>
                  <div className="progress-mini-card rounded-2xl border border-white/10 bg-white/[0.035] p-3">
                    <span className="block text-slate-500">Next XP</span>
                    <span className="mt-1 block text-lg font-semibold text-white">{xpToNext}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

      {/* Top stat cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <GlassCard label="Accuracy" value={`${avgAccuracy}%`} tone={getScoreTone(avgAccuracy)} />
        <GlassCard label="Study Time" value={formatHours(totalDuration)} tone="blue" />
        <GlassCard label="XP Bank" value={`${totalXp}`} tone="amber" />
        <GlassCard label="Streak" value={`${progress.streak} DAYS`} tone="amber" />
        <GlassCard label="Level" value={`LVL ${progress.level || 1}`} tone="blue" active />
        <GlassCard label="Prime Subject" value={bestSubject} tone="green" />
      </div>

      {/* Row 1: Chart + side widgets (predictive, cohort, export + consistency/efficiency)*/}
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.8fr)_540px]">
        <GlassPanel
          title="PERFORMANCE_HISTORY // XP_VELOCITY"
          right={
            <div className="flex items-center gap-4">
              <span className="text-[10px] uppercase tracking-[0.24em] text-emerald-400 font-mono">LIVE</span>
              <TrendRangeToggle range={range} setRange={setRange} />
            </div>
          }
        >
          <LineChart
            labels={trendLabels}
            series={[
              { label: "xp_velocity", color: "#FFAA0A", data: trendXp },
            ]}
            valueSuffix=""
          />
        </GlassPanel>

        <div className="space-y-6">
          {/* Predictive Insights */}
          <GlassPanel title="PREDICTIVE_SIGNALS" tag="AI">
            <div className="space-y-3 max-h-[400px] overflow-y-auto">
              {insights.map((insight, i) => (
                <div key={i} className={cn(
                  "rounded-lg border p-3",
                  insight.type === "positive" ? "border-emerald-500/30 bg-emerald-500/5" :
                  insight.type === "negative" ? "border-red-500/30 bg-red-500/5" :
                  "border-white/10 bg-white/5"
                )}>
                  <p className={cn("text-xs", insight.type === "positive" ? "text-emerald-400" : insight.type === "negative" ? "text-red-400" : "text-gray-300")}>
                    {insight.message}
                  </p>
                </div>
              ))}
            </div>
          </GlassPanel>

          {/* Cohort Comparison */}
          <GlassPanel title="COHORT_VS_AVERAGE">
            <div className="space-y-3">
              <div className="flex justify-between text-xs">
                <span className="text-gray-400">Your XP</span>
                <span className="text-amber-400 font-bold">{totalXp}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-400">Avg XP (all users)</span>
                <span className="text-gray-200">{leaderboardAvg.xp}</span>
              </div>
              <Rail value={leaderboardAvg.xp > 0 ? Math.round((totalXp / leaderboardAvg.xp) * 100) : 0} tone="blue" />
              <div className="text-[10px] text-gray-500 uppercase tracking-wider">Rank #{currentRank.rank} of {Math.max(1, rankedLeaderboard.length)}</div>
            </div>
          </GlassPanel>

          {/* Consistency & Efficiency (new) */}
          { (progress.consistency_index > 0 || progress.learning_efficiency > 0) && (
            <GlassPanel title="STUDY_METRICS" tag="DEEP">
              <div className="grid grid-cols-2 gap-4">
                {progress.consistency_index > 0 && (
                  <div>
                    <div className="text-[10px] uppercase text-gray-500 mb-1">Consistency</div>
                    <div className="text-2xl font-bold text-white">{progress.consistency_index}%</div>
                    <Rail value={progress.consistency_index} tone="blue" />
                  </div>
                )}
                {progress.learning_efficiency > 0 && (
                  <div>
                    <div className="text-[10px] uppercase text-gray-500 mb-1">Efficiency</div>
                    <div className="text-2xl font-bold text-white">{progress.learning_efficiency}%</div>
                    <Rail value={progress.learning_efficiency} tone="green" />
                  </div>
                )}
              </div>
            </GlassPanel>
          )}

        </div>
      </div>

      {/* Row 2: Level progression + Global rankings */}
      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <GlassPanel title="LEVEL_PROGRESSION">
          <div className="space-y-4">
            <div className="flex justify-between text-xs">
              <span className="text-gray-400">Total XP</span>
              <span className="text-2xl font-bold text-white">{totalXp}</span>
            </div>
            <div className="h-2 bg-white/5 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-amber-400 to-orange-500" style={{ width: `${levelProgress}%` }} />
            </div>
            <div className="flex justify-between text-[10px] uppercase text-gray-500">
              <span>LVL {progress.level || 1}</span>
              <span>{xpToNext} XP to next</span>
              <span>LVL {(progress.level || 1) + 1}</span>
            </div>
          </div>
        </GlassPanel>

        <GlassPanel
          title="GLOBAL_RANKINGS"
          right={<TonePill tone="amber">TOP {Math.min(6, Math.max(visibleLeaderboard.length, rankedLeaderboard.length))}</TonePill>}
        >
          <div className="space-y-3">
            {visibleLeaderboard.map((entry) => {
              const isCurrent = entry.user_id === userId;
              return (
                <div
                  key={entry.user_id}
                  className={cn(
                    "rounded-lg border px-3 py-3 text-xs transition-colors",
                    isCurrent
                      ? "border-cyan-300/25 bg-cyan-300/10"
                      : "border-white/5 bg-white/[0.025] hover:border-white/10 hover:bg-white/[0.045]",
                  )}
                >
                  <div className="flex items-center gap-3">
                    <span className="w-9 shrink-0 font-mono text-[11px] text-gray-500">#{entry.rank}</span>
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-white/10 bg-white/5 text-[11px] font-semibold text-cyan-200">
                      {getInitials(entry.displayLabel)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="truncate font-semibold text-white">{entry.displayLabel}</span>
                        {isCurrent && <span className="rounded border border-emerald-400/30 bg-emerald-400/10 px-1.5 py-0.5 text-[9px] font-bold text-emerald-300">YOU</span>}
                      </div>
                      <div className="mt-0.5 truncate text-[10px] text-gray-500">{entry.metaLabel}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-amber-400">{entry.xp}</div>
                      <div className="mt-0.5 text-[10px] text-gray-500">XP</div>
                    </div>
                  </div>
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/5">
                    <div
                      className={cn("h-full rounded-full", isCurrent ? "bg-cyan-300" : "bg-amber-400")}
                      style={{ width: `${Math.max(3, Math.round((entry.xp / maxLeaderboardXp) * 100))}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </GlassPanel>
      </div>

      {/* Row 3: Weak Topic Spotlight (new, actionable) */}
      {weakTopics.length > 0 && (
        <GlassPanel title="WEAK_TOPIC_SPOTLIGHT" tag="PRIORITY" className="border-red-500/20">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {weakTopics.map((topic) => (
              <div key={`${topic.subject}-${topic.topic}`} className="bg-red-500/5 border border-red-500/20 rounded-lg p-4 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-bold text-red-400 uppercase">{topic.topic}</h4>
                    <span className="text-[10px] text-gray-500">{topic.subject}</span>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-xl font-bold text-red-400">{topic.accuracy}%</span>
                    <span className="text-xs text-gray-400">{topic.sessions} sessions</span>
                    {topic.trend !== 0 && (
                      <span className={cn("text-xs", topic.trend > 0 ? "text-emerald-400" : "text-red-400")}>
                        {topic.trend > 0 ? "up improving" : "down declining"}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleReviseTopic(topic.topic)}
                  className="agentify-action mt-3 w-full rounded-md border border-[#0E7490]/30 bg-[#0E7490]/10 py-2 text-xs font-bold text-[#0E7490] hover:bg-[#0E7490]/20 transition-all"
                >
                  REVISE NOW
                </button>
              </div>
            ))}
          </div>
        </GlassPanel>
      )}

      {/* Row 4: Weekly Time + Subject Breakdown */}
      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <GlassPanel title="Weekly study time" tag="TIME">
          {weeklyLabels.length ? (
            <div className="space-y-4">
              {weeklyLabels.map((label, i) => {
                const maxDuration = Math.max(...weeklyDurations);
                const percent = maxDuration > 0 ? Math.round((weeklyDurations[i] / maxDuration) * 100) : 0;
                return (
                  <div key={label} className="grid grid-cols-[90px_1fr_80px] items-center gap-4">
                    <span className="text-xs text-gray-400 text-right">{label}</span>
                    <Rail value={percent} tone="amber" />
                    <span className="text-xs text-white font-mono">{formatMinutes(weeklyDurations[i])}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState title="No weekly data" detail="Complete timestamped sessions to see weekly study time." />
          )}
        </GlassPanel>

        <GlassPanel title="Subject breakdown" tag="SUBJ">
          {subjects.length ? (
            <div className="space-y-4">
              {subjects.map((subj) => (
                <div key={subj.subject} className="flex items-center justify-between border-b border-white/5 pb-3 last:border-0">
                  <div>
                    <div className="text-sm font-bold text-white uppercase">{subj.subject}</div>
                    <div className="text-[10px] text-gray-400">{subj.sessions} sessions / {formatMinutes(subj.duration)}</div>
                  </div>
                  <div className="text-right">
                    <div className={cn("text-lg font-bold", toneText(getScoreTone(subj.accuracy)))}>{subj.accuracy}%</div>
                    <div className="text-[10px] text-gray-500">focus {subj.focus}</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState title="No subject data" detail="Complete sessions to populate subject breakdown." />
          )}
        </GlassPanel>
      </div>

      {/* Row 5: Heatmap + Topic Matrix */}
      <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
        <GlassPanel title="Activity heatmap" tag="35D" right={<TonePill tone="amber">{heatmap.reduce((a, b) => a + b.value, 0)} sessions</TonePill>}>
          {heatmap.length ? (
            <div className="space-y-2">
              {Array.from({ length: Math.ceil(heatmap.length / 7) }, (_, i) => heatmap.slice(i * 7, i * 7 + 7)).map((week, wi) => (
                <div key={wi} className="grid grid-cols-7 gap-2">
                  {week.map((item) => {
                    const intensity = item.value === 0 ? 0.08 : 0.24 + (item.value / Math.max(...heatmap.map((h) => h.value)) / 1.15);
                    return (
                      <div
                        key={item.key}
                        title={`${item.label}: ${item.value} sessions`}
                        className="aspect-square rounded-sm border border-white/10"
                        style={{ backgroundColor: `rgba(255, 170, 10, ${intensity})` }}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          ) : (
            <EmptyState title="No activity grid" detail="Timestamped sessions unlock the 35-day activity view." />
          )}
        </GlassPanel>

        <GlassPanel title="Topic matrix" tag="LOG">
          {topics.length ? (
            <div className="overflow-auto">
              <div className="min-w-[700px]">
                <div className="grid grid-cols-[1.6fr_0.9fr_0.8fr_0.8fr_0.8fr_0.5fr] border-b border-white/10 bg-white/[0.02] px-4 py-3 text-[10px] uppercase tracking-[0.24em] text-gray-500 font-mono">
                  <div>Topic</div>
                  <div>Subject</div>
                  <div className="text-right">Acc</div>
                  <div className="text-right">Sessions</div>
                  <div className="text-right">Time</div>
                  <div className="text-right">Trend</div>
                </div>
                {topics.map((topic) => {
                  const trend = getTopicTrend(sessions, topic.topic, topic.subject);
                  return (
                    <div key={`${topic.subject}-${topic.topic}`} className="grid grid-cols-[1.6fr_0.9fr_0.8fr_0.8fr_0.8fr_0.5fr] border-b border-white/5 px-4 py-3 text-xs hover:bg-white/[0.02]">
                      <div className="truncate pr-4 text-white font-mono uppercase">{topic.topic}</div>
                      <div className="text-gray-400">{topic.subject}</div>
                      <div className={cn("text-right font-bold", toneText(getScoreTone(topic.accuracy)))}>{topic.accuracy}%</div>
                      <div className="text-right text-gray-300">{topic.sessions}</div>
                      <div className="text-right text-gray-300">{formatMinutes(topic.duration)}</div>
                      <div className="text-right text-gray-400">
                        {trend === 1 ? "up" : trend === -1 ? "down" : "flat"}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <EmptyState title="No topic data" detail="Complete sessions to populate topic breakdown." />
          )}
        </GlassPanel>
      </div>
    </div>
    </div>
  );
}
