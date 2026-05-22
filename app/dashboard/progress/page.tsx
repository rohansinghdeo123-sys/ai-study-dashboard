"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";

// ─── Types (unchanged) ─────────────────────────────────────────────────────
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

// ─── Utility functions (unchanged) ────────────────────────────────────────
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

// ─── Grouping / chart helpers (unchanged, plus new topic trend) ───────────
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

// ─── Data hook (unchanged) ────────────────────────────────────────────────
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
    const response = await fetch(url, { cache: "no-store", headers });
    if (!response.ok) return null;
    return response.json();
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
        setError("NO AUTHENTICATED USER.");
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
  }, [authLoading, backendURL, getAuthHeaders, user]);

  return {
    userId: user?.uid ?? "",
    currentDisplayName: getUserDisplayName(user),
    sessions,
    progress,
    leaderboard,
    loading: loading || authLoading,
    error,
  };
}

// ─── Glass UI components (same as other pages) ────────────────────────────
function GlassCard({ label, value, tone = "neutral", active = false }: { label: string; value: string; tone?: Tone; active?: boolean }) {
  return (
    <div className={cn("rounded-lg border border-white/10 bg-[#0E1118]/90 p-4 shadow-[0_18px_50px_rgba(0,0,0,0.14)] backdrop-blur-xl transition-all hover:border-white/20 hover:bg-[#111520]/90", active && "border-cyan-300/25 bg-cyan-300/10")}>
      <div className="text-[11px] font-medium text-slate-500">{label}</div>
      <div className={cn("mt-2 text-2xl font-semibold", toneText(tone))}>{value}</div>
    </div>
  );
}

function GlassPanel({ title, tag, right, className, children }: { title: string; tag?: string; right?: React.ReactNode; className?: string; children: React.ReactNode }) {
  return (
    <section className={cn("overflow-hidden rounded-lg border border-white/10 bg-[#0E1118]/90 shadow-[0_18px_50px_rgba(0,0,0,0.18)] backdrop-blur-xl", className)}>
      <div className="flex items-center justify-between border-b border-white/10 bg-white/[0.025] px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-slate-200">{title.replace(/_/g, " ")}</span>
          {tag && <span className="rounded-md border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 text-[9px] font-bold text-amber-400 uppercase font-mono">{tag}</span>}
        </div>
        {right}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

function TonePill({ children, tone = "neutral" }: { children: React.ReactNode; tone?: Tone }) {
  return (
    <span className={cn("inline-flex items-center rounded-md border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.24em] font-mono", toneBadge(tone))}>
      {children}
    </span>
  );
}

function Rail({ value, tone = "neutral" }: { value: number; tone?: Tone }) {
  const width = Math.max(0, Math.min(100, value));
  const bg = tone === "green" ? "bg-emerald-500" : tone === "blue" ? "bg-[#0E7490]" : tone === "amber" ? "bg-amber-400" : tone === "red" ? "bg-red-500" : "bg-gray-400";
  return (
    <div className="h-1.5 w-full rounded-full bg-white/5">
      <div className={cn("h-full rounded-full transition-all duration-500", bg)} style={{ width: `${width}%` }} />
    </div>
  );
}

function EmptyState({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="flex min-h-[200px] flex-col items-center justify-center px-6 text-center">
      <div className="text-[10px] uppercase tracking-[0.34em] text-gray-500 font-mono">{title}</div>
      <p className="mt-4 max-w-md text-sm text-gray-400">{detail}</p>
    </div>
  );
}

function TrendRangeToggle({ range, setRange }: { range: TrendRange; setRange: (v: TrendRange) => void }) {
  return (
    <div className="flex gap-1">
      {(["14d", "8w"] as const).map((item) => (
        <button
          key={item}
          onClick={() => setRange(item)}
          className={cn(
            "rounded-md border px-3 py-1 text-[10px] font-bold uppercase tracking-[0.22em] transition-all font-mono",
            item === range ? "border-amber-400/40 bg-amber-400/10 text-amber-400" : "border-white/10 text-gray-500 hover:border-white/30 hover:text-white"
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
    return <EmptyState title="NO TREND DATA" detail="Timestamped sessions are required to render this chart." />;
  }

  const width = 100;
  const height = 56;
  const padding = { top: 8, right: 4, bottom: 10, left: 6 };
  const values = series.flatMap((s) => s.data).filter((v) => Number.isFinite(v));
  const min = Math.min(...values);
  const max = Math.max(...values);
  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;
  const x = (index: number) => padding.left + (labels.length === 1 ? 0 : (index / (labels.length - 1)) * innerWidth);
  const y = (value: number) => padding.top + innerHeight - ((value - min) / (max - min || 1)) * innerHeight;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((p) => min + (max - min) * p);

  return (
    <div className="h-[400px]">
      <div className="mb-3 flex items-center justify-between text-[10px] uppercase tracking-[0.24em] text-gray-500">
        <div className="flex items-center gap-4">
          {series.map((s) => (
            <span key={s.label} className="flex items-center gap-2"><span className="h-px w-6" style={{ backgroundColor: s.color }} />{s.label}</span>
          ))}
        </div>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-[350px] w-full">
        {ticks.map((tick) => (
          <g key={tick}>
            <line x1={padding.left} y1={y(tick)} x2={width - padding.right} y2={y(tick)} stroke="#1D1D1D" strokeDasharray="1.2 1.4" strokeWidth="0.35" />
            <text x={padding.left + 0.2} y={y(tick) - 1} fill="#6E7B90" fontSize="2.7" fontFamily="inherit">{Math.round(tick)}{valueSuffix}</text>
          </g>
        ))}
        {series.map((s, idx) => {
          const path = s.data.map((v, i) => `${i === 0 ? "M" : "L"} ${x(i)} ${y(v)}`).join(" ");
          const areaPath = `${path} L ${x(s.data.length - 1)} ${height - padding.bottom} L ${x(0)} ${height - padding.bottom} Z`;
          return (
            <g key={s.label}>
              {idx === 0 && <path d={areaPath} fill={s.color} opacity="0.18" />}
              <path d={path} fill="none" stroke={s.color} strokeWidth="0.9" />
              {s.data.map((v, i) => <circle key={i} cx={x(i)} cy={y(v)} r="0.65" fill={s.color} />)}
            </g>
          );
        })}
        {labels.map((label, i) => (
          <text key={i} x={x(i)} y={height - 1} fill="#68778E" fontSize="2.5" textAnchor="middle" fontFamily="inherit">{label}</text>
        ))}
      </svg>
    </div>
  );
}

// ─── CSV Export helper ─────────────────────────────────────────────────────
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

// ─── Main Analytics Page Component ─────────────────────────────────────────
export default function ProgressPage() {
  const { userId, currentDisplayName, sessions, progress, leaderboard, loading, error } = useDashboardData();
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
  const bestSubject = subjects[0]?.subject ?? "—";
  const worstTopic = topics.length ? topics[topics.length - 1] : null;

  const daily = useMemo(() => buildDailySeries(sessions, 14), [sessions]);
  const weekly = useMemo(() => buildWeeklySeries(sessions, 8), [sessions]);
  const heatmap = useMemo(() => buildHeatmap(sessions, 35), [sessions]);

  const trendLabels = range === "14d" ? daily.map((d) => d.label) : weekly.map((w) => w.label);
  const trendXp = range === "14d" ? daily.map((d) => d.xp) : weekly.map((w) => w.xp);
  const trendFocus = range === "14d" ? daily.map((d) => d.focus) : weekly.map((w) => w.focus);
  const trendAccuracy = range === "14d" ? daily.map((d) => d.accuracy) : weekly.map((w) => w.accuracy);

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
      list.push({ type: "negative", message: `Accuracy on ${worstTopic.topic} is ${worstTopic.accuracy}% – focused revision recommended.` });
    } else if (worstTopic) {
      list.push({ type: "positive", message: `Your weakest topic (${worstTopic.topic}) is at ${worstTopic.accuracy}% – keep improving.` });
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
      list.push({ type: progress.learning_efficiency >= 70 ? "positive" : "neutral", message: `Learning efficiency: ${progress.learning_efficiency}% – ${progress.learning_efficiency >= 70 ? "excellent" : "room to grow"}.` });
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

  const handleReviseTopic = useCallback((topic: string) => {
    router.push(`/dashboard/study?chapter=hydrocarbon&topic=${topic}`);
  }, [router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] font-mono text-[#0E7490] animate-pulse">
        LOADING ANALYTICS TERMINAL...
      </div>
    );
  }

  return (
    <div className="space-y-6 text-slate-200">
      <div className="rounded-lg border border-white/10 bg-[#0E1118]/90 px-5 py-4 shadow-[0_18px_50px_rgba(0,0,0,0.18)] backdrop-blur-xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-200/80">Analytics Intelligence</div>
            <h1 className="mt-2 text-2xl font-semibold text-white">Mastery, momentum, and weak topics</h1>
            <p className="mt-1 text-sm text-slate-500">
              A student-friendly performance view with actionable AI signals.
            </p>
            {error && (
              <p className="mt-2 text-xs font-medium text-amber-300">
                {error}
              </p>
            )}
          </div>
          <button
            onClick={handleExportCSV}
            className="rounded-md border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-medium text-slate-300 transition hover:border-cyan-300/30 hover:bg-cyan-300/10 hover:text-cyan-100"
          >
            Export CSV
          </button>
        </div>
      </div>

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
          title="PERFORMANCE HISTORY"
          right={
            <div className="flex items-center gap-4">
              <span className="text-[10px] uppercase tracking-[0.24em] text-emerald-400 font-mono">● LIVE</span>
              <TrendRangeToggle range={range} setRange={setRange} />
            </div>
          }
        >
          <LineChart
            labels={trendLabels}
            series={[
              { label: "xp", color: "#FFAA0A", data: trendXp },
              { label: "focus", color: "#73A8FF", data: trendFocus },
              { label: "accuracy", color: "#7CFF8A", data: trendAccuracy },
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
                        {topic.trend > 0 ? "↑ improving" : "↓ declining"}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => handleReviseTopic(topic.topic)}
                  className="mt-3 w-full rounded-md border border-[#0E7490]/30 bg-[#0E7490]/10 py-2 text-xs font-bold text-[#0E7490] hover:bg-[#0E7490]/20 transition-all"
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
        <GlassPanel title="WEEKLY_STUDY_TIME" tag="TIME">
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
            <EmptyState title="NO WEEKLY DATA" detail="Complete timestamped sessions to see weekly study time." />
          )}
        </GlassPanel>

        <GlassPanel title="SUBJECT_BREAKDOWN" tag="SUBJ">
          {subjects.length ? (
            <div className="space-y-4">
              {subjects.map((subj) => (
                <div key={subj.subject} className="flex items-center justify-between border-b border-white/5 pb-3 last:border-0">
                  <div>
                    <div className="text-sm font-bold text-white uppercase">{subj.subject}</div>
                    <div className="text-[10px] text-gray-400">{subj.sessions} sessions · {formatMinutes(subj.duration)}</div>
                  </div>
                  <div className="text-right">
                    <div className={cn("text-lg font-bold", toneText(getScoreTone(subj.accuracy)))}>{subj.accuracy}%</div>
                    <div className="text-[10px] text-gray-500">focus {subj.focus}</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState title="NO SUBJECT DATA" detail="Complete sessions to populate subject breakdown." />
          )}
        </GlassPanel>
      </div>

      {/* Row 5: Heatmap + Topic Matrix */}
      <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
        <GlassPanel title="ACTIVITY_HEATMAP" tag="35D" right={<TonePill tone="amber">{heatmap.reduce((a, b) => a + b.value, 0)} sessions</TonePill>}>
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
            <EmptyState title="NO ACTIVITY GRID" detail="Timestamped sessions unlock the 35-day activity view." />
          )}
        </GlassPanel>

        <GlassPanel title="TOPIC_MATRIX" tag="LOG">
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
                        {trend === 1 ? "↑" : trend === -1 ? "↓" : "→"}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <EmptyState title="NO TOPIC DATA" detail="Complete sessions to populate topic breakdown." />
          )}
        </GlassPanel>
      </div>
    </div>
  );
}
