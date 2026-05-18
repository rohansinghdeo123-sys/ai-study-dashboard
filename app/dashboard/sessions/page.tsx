"use client";

import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";

// ------------------------------------------------------------------------------
// Types (unchanged except for optional replay_data)
// ------------------------------------------------------------------------------
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
  // new field for replay
  replay_data?: {
    questions: {
      id?: string;
      text: string;
      topic?: string;
      subtopic?: string;
      options: string[];
      correct_answer: string;
      user_answer: string;
      is_correct: boolean;
      ai_explanation?: string;
    }[];
  };
};

type SortKey = "latest" | "duration" | "performance";
type Tone = "neutral" | "blue" | "green" | "amber" | "red";

// ------------------------------------------------------------------------------
// Utility functions (unchanged)
// ------------------------------------------------------------------------------
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

function getAccuracy(session: Session) {
  return session.questions > 0
    ? Math.round((session.correct / session.questions) * 100)
    : 0;
}

function getPerformance(session: Session) {
  return typeof session.performance === "number"
    ? Math.round(session.performance)
    : getAccuracy(session);
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

function formatDateTime(value: Date | null) {
  if (!value) return "UNAVAILABLE";
  return value
    .toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
    .toUpperCase();
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

function getStatusTone(status?: string | null): Tone {
  const normalized = status?.toLowerCase() ?? "";
  if (normalized.includes("complete") || normalized.includes("done")) return "green";
  if (normalized.includes("progress") || normalized.includes("active")) return "blue";
  if (normalized.includes("review") || normalized.includes("pending")) return "amber";
  if (normalized.includes("miss") || normalized.includes("failed")) return "red";
  return "neutral";
}

function getScoreTone(value: number): Tone {
  if (value >= 85) return "green";
  if (value >= 70) return "blue";
  if (value >= 55) return "amber";
  return "red";
}

function toneText(tone: Tone) {
  switch (tone) {
    case "green": return "text-emerald-400";
    case "blue": return "text-[#00A3FF]";
    case "amber": return "text-amber-400";
    case "red": return "text-red-400";
    default: return "text-gray-300";
  }
}

function toneBadge(tone: Tone) {
  switch (tone) {
    case "green": return "border-emerald-500/30 bg-emerald-500/10 text-emerald-400";
    case "blue": return "border-[#00A3FF]/30 bg-[#00A3FF]/10 text-[#00A3FF]";
    case "amber": return "border-amber-400/30 bg-amber-400/10 text-amber-400";
    case "red": return "border-red-500/30 bg-red-500/10 text-red-400";
    default: return "border-white/10 bg-white/5 text-gray-400";
  }
}

// ------------------------------------------------------------------------------
// Chemistry rendering (copied from study page for replay)
// ------------------------------------------------------------------------------
function renderChemistryText(value: string) {
  const tokenRegex =
    /(sp\d+|[A-Z][a-z]?(?:\d+)?(?:[A-Z][a-z]?(?:\d+)?)*(?:\^[+-]?\d+|\^[+-])?)/g;
  const pieces = value.split(tokenRegex);
  return pieces.map((piece, pieceIndex) => {
    if (!piece) return null;
    const spMatch = piece.match(/^sp(\d+)$/);
    if (spMatch) {
      return (
        <span key={pieceIndex}>
          sp<sup>{spMatch[1]}</sup>
        </span>
      );
    }
    const chargeMatch = piece.match(/^(.+)\^([+-]?\d+|[+-])$/);
    const formula = chargeMatch ? chargeMatch[1] : piece;
    const charge = chargeMatch ? chargeMatch[2] : null;
    const atomMatches = [...formula.matchAll(/([A-Z][a-z]?)(\d*)/g)];
    const matchedFormula = atomMatches.map((match) => match[0]).join("");
    if (!atomMatches.length || matchedFormula !== formula) {
      return <span key={pieceIndex}>{piece}</span>;
    }
    return (
      <span key={pieceIndex}>
        {atomMatches.map((match, atomIndex) => (
          <span key={`${pieceIndex}-${atomIndex}`}>
            {match[1]}
            {match[2] ? <sub>{match[2]}</sub> : null}
          </span>
        ))}
        {charge ? <sup>{charge}</sup> : null}
      </span>
    );
  });
}

function ChemistryBlock({ value, className = "" }: { value: string; className?: string }) {
  return (
    <div className={className}>
      {value.split("\n").map((line, index, lines) => (
        <span key={index}>
          {renderChemistryText(line)}
          {index < lines.length - 1 ? <br /> : null}
        </span>
      ))}
    </div>
  );
}

// ------------------------------------------------------------------------------
// Custom hooks (unchanged except added filter states)
// ------------------------------------------------------------------------------
function useClock() {
  const [clock, setClock] = useState("");
  useEffect(() => {
    const update = () => {
      setClock(
        new Date()
          .toLocaleString("en-IN", {
            day: "2-digit",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          })
          .toUpperCase(),
      );
    };
    update();
    const id = window.setInterval(update, 1000);
    return () => window.clearInterval(id);
  }, []);
  return clock;
}

function useSessions() {
  const { user, loading: authLoading, getAuthHeaders } = useAuth();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const backendURL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://127.0.0.1:8000";

  useEffect(() => {
    let active = true;
    async function load() {
      if (authLoading) return;
      if (!user?.uid) {
        setSessions([]);
        setLoading(false);
        setError("NO AUTHENTICATED USER.");
        return;
      }
      try {
        setLoading(true);
        setError(null);
        const response = await fetch(`${backendURL}/sessions/${user.uid}`, {
          cache: "no-store",
          headers: await getAuthHeaders(),
        });
        if (!response.ok) {
          throw new Error(`Failed to load sessions: ${response.status}`);
        }
        const payload = await response.json();
        const nextSessions = Array.isArray(payload)
          ? payload
          : Array.isArray(payload.sessions)
            ? payload.sessions
            : [];
        if (active) setSessions(nextSessions as Session[]);
      } catch {
        if (active) {
          setSessions([]);
          setError("UNABLE TO LOAD SESSION DATA.");
        }
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, [authLoading, backendURL, getAuthHeaders, user?.uid]);

  return { sessions, loading: loading || authLoading, error };
}

function groupBySubject(sessions: Session[]) {
  const map = new Map<string, { subject: string; sessions: number; duration: number; xp: number; accuracy: number; focus: number }>();
  for (const session of sessions) {
    const current = map.get(session.subject) ?? {
      subject: session.subject,
      sessions: 0,
      duration: 0,
      xp: 0,
      accuracy: 0,
      focus: 0,
    };
    current.sessions += 1;
    current.duration += session.duration;
    current.xp += session.xp;
    current.accuracy += getAccuracy(session);
    current.focus += session.focusScore;
    map.set(session.subject, current);
  }
  return [...map.values()]
    .map((item) => ({
      ...item,
      accuracy: Math.round(item.accuracy / item.sessions),
      focus: Math.round(item.focus / item.sessions),
    }))
    .sort((a, b) => b.accuracy - a.accuracy);
}

function sortSessions(sessions: Session[], sortKey: SortKey) {
  const list = [...sessions];
  return list.sort((a, b) => {
    if (sortKey === "latest") {
      const aTime = getSessionDate(a)?.getTime() ?? 0;
      const bTime = getSessionDate(b)?.getTime() ?? 0;
      return bTime - aTime;
    }
    if (sortKey === "duration") return b.duration - a.duration;
    return getPerformance(b) - getPerformance(a);
  });
}

// ------------------------------------------------------------------------------
// Sub-components (updated to glass design)
// ------------------------------------------------------------------------------
function GlassPanel({
  title,
  tag,
  right,
  className,
  children,
}: {
  title: string;
  tag?: string;
  right?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
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
          {tag && (
            <span className="rounded-md border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 text-[9px] font-bold text-amber-400 uppercase font-mono">
              {tag}
            </span>
          )}
        </div>
        {right}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

function GlassCard({
  label,
  value,
  tone = "neutral",
  active = false,
}: {
  label: string;
  value: string;
  tone?: Tone;
  active?: boolean;
}) {
  return (
    <div
      className={cn(
        "border border-white/10 bg-white/[0.03] backdrop-blur-sm p-4 transition-all hover:border-white/20",
        active && "border-l-[#00A3FF] bg-[#0F1A24]",
      )}
    >
      <div className="text-[9px] uppercase tracking-[0.22em] text-gray-500 font-mono">{label}</div>
      <div className={cn("mt-2 text-2xl font-bold", toneText(tone))}>
        {value}
      </div>
    </div>
  );
}

function Rail({ value, tone = "neutral" }: { value: number; tone?: Tone }) {
  const width = Math.max(0, Math.min(100, value));
  const bgColor =
    tone === "green"
      ? "bg-emerald-500"
      : tone === "blue"
        ? "bg-[#00A3FF]"
        : tone === "amber"
          ? "bg-amber-400"
          : tone === "red"
            ? "bg-red-500"
            : "bg-gray-400";
  return (
    <div className="h-1.5 w-full rounded-full bg-white/5">
      <div
        className={cn("h-full rounded-full transition-all duration-500", bgColor)}
        style={{ width: `${width}%` }}
      />
    </div>
  );
}

function TonePill({ children, tone = "neutral" }: { children: React.ReactNode; tone?: Tone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.24em] font-mono",
        toneBadge(tone),
      )}
    >
      {children}
    </span>
  );
}

function EmptyState({ title, detail }: { title: string; detail: string }) {
  const router = useRouter();
  return (
    <div className="flex min-h-[260px] flex-col items-center justify-center px-6 text-center">
      <div className="text-[10px] uppercase tracking-[0.34em] text-gray-500 font-mono">{title}</div>
      <p className="mt-4 max-w-md text-sm text-gray-400">{detail}</p>
      <button
        onClick={() => router.push("/dashboard/study")}
        className="mt-6 rounded-lg border border-[#00A3FF]/30 bg-[#00A3FF]/10 px-4 py-2 text-xs font-bold text-[#00A3FF] hover:bg-[#00A3FF]/20 transition-all"
      >
        GO TO STUDY LAB
      </button>
    </div>
  );
}

function LoadingState({ label }: { label: string }) {
  return (
    <div className="flex min-h-[560px] items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] backdrop-blur-sm text-sm uppercase tracking-[0.24em] text-gray-500 font-mono">
      {label}
    </div>
  );
}

// ------------------------------------------------------------------------------
// New filtering components
// ------------------------------------------------------------------------------
function SessionFilters({
  search,
  setSearch,
  minAccuracy,
  setMinAccuracy,
  startDate,
  setStartDate,
  endDate,
  setEndDate,
  clearFilters,
}: {
  search: string;
  setSearch: (v: string) => void;
  minAccuracy: number;
  setMinAccuracy: (v: number) => void;
  startDate: string;
  setStartDate: (v: string) => void;
  endDate: string;
  setEndDate: (v: string) => void;
  clearFilters: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 p-3 border-b border-white/10">
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="SEARCH TOPIC/SUBJECT"
        className="w-48 rounded-md border border-white/10 bg-black/30 px-3 py-1.5 text-xs uppercase tracking-[0.18em] text-white placeholder-gray-600 outline-none focus:border-[#00A3FF] font-mono"
        id="session-search"
      />
      <div className="flex items-center gap-1 text-xs text-gray-400">
        <span>ACC ≥</span>
        <input
          type="number"
          min={0}
          max={100}
          value={minAccuracy}
          onChange={(e) => setMinAccuracy(Number(e.target.value))}
          className="w-14 rounded-md border border-white/10 bg-black/30 px-2 py-1.5 text-xs text-white outline-none focus:border-[#00A3FF] font-mono"
        />
        <span>%</span>
      </div>
      <div className="flex items-center gap-1 text-xs text-gray-400">
        <span>FROM</span>
        <input
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          className="w-36 rounded-md border border-white/10 bg-black/30 px-2 py-1.5 text-xs text-white outline-none focus:border-[#00A3FF] font-mono"
        />
      </div>
      <div className="flex items-center gap-1 text-xs text-gray-400">
        <span>TO</span>
        <input
          type="date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          className="w-36 rounded-md border border-white/10 bg-black/30 px-2 py-1.5 text-xs text-white outline-none focus:border-[#00A3FF] font-mono"
        />
      </div>
      <button
        onClick={clearFilters}
        className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-red-400 hover:bg-red-500/20"
      >
        CLEAR
      </button>
    </div>
  );
}

// ------------------------------------------------------------------------------
// Session table with row highlighting
// ------------------------------------------------------------------------------
function SessionsTable({
  sessions,
  selectedId,
  onSelect,
}: {
  sessions: Session[];
  selectedId: string | null;
  onSelect: (session: Session) => void;
}) {
  if (!sessions.length) {
    return (
      <EmptyState
        title="NO SESSION RECORDS"
        detail="No live sessions were returned from the backend. Complete an exam in Study Lab to populate the ledger."
      />
    );
  }

  return (
    <div className="overflow-auto">
      <div className="min-w-[1080px]">
        <div className="grid grid-cols-[1fr_1.35fr_1.15fr_0.7fr_0.7fr_0.7fr_0.65fr_0.9fr] border-b border-white/10 bg-white/[0.02] px-4 py-3 text-[10px] uppercase tracking-[0.24em] text-gray-500 font-mono">
          <div>Subject</div>
          <div>Topic</div>
          <div>Timestamp</div>
          <div className="text-right">Duration</div>
          <div className="text-right">Acc</div>
          <div className="text-right">Focus</div>
          <div className="text-right">XP</div>
          <div>Status</div>
        </div>

        {sessions.map((session) => {
          const accuracy = getAccuracy(session);
          const focusTone = getScoreTone(session.focusScore);
          const status = session.status?.trim() || "—";
          const isSelected = selectedId === session.id;

          return (
            <button
              key={session.id}
              type="button"
              onClick={() => onSelect(session)}
              className={cn(
                "grid w-full grid-cols-[1fr_1.35fr_1.15fr_0.7fr_0.7fr_0.7fr_0.65fr_0.9fr] items-center border-b border-white/5 px-4 py-3 text-left transition-colors",
                isSelected ? "bg-[#0F1A24] border-l-2 border-l-[#00A3FF]" : "hover:bg-white/[0.02]",
              )}
            >
              <div className="truncate pr-3 text-xs font-semibold uppercase tracking-[0.08em] text-white font-mono">
                {session.subject}
              </div>
              <div className="truncate pr-3 text-xs uppercase tracking-[0.06em] text-gray-300 font-mono">
                {session.topic}
              </div>
              <div className="truncate pr-3 text-[11px] uppercase text-gray-500 font-mono">
                {formatDateTime(getSessionDate(session))}
              </div>
              <div className="text-right text-xs text-gray-300 font-mono">
                {formatMinutes(session.duration)}
              </div>
              <div className={cn("text-right text-xs font-bold font-mono", toneText(getScoreTone(accuracy)))}>
                {accuracy}%
              </div>
              <div className={cn("text-right text-xs font-bold font-mono", toneText(focusTone))}>
                {session.focusScore}
              </div>
              <div className="text-right text-xs font-bold text-amber-400 font-mono">
                {session.xp}
              </div>
              <div>
                {status === "—" ? (
                  <span className="text-gray-500">—</span>
                ) : (
                  <TonePill tone={getStatusTone(status)}>{status}</TonePill>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------------------
// Enhanced Session Inspector with replay and quick action
// ------------------------------------------------------------------------------
function SessionInspector({ session }: { session: Session | null }) {
  const router = useRouter();
  const selectedTopic = session?.topic ?? "";
  const handleReviseTopic = useCallback(() => {
    if (!selectedTopic) return;
    router.push(`/dashboard/study?chapter=hydrocarbon&topic=${selectedTopic}`);
  }, [router, selectedTopic]);

  if (!session) {
    return (
      <GlassPanel title="SESSION_INSPECTOR" tag="VIEW" className="h-full">
        <EmptyState
          title="SELECT A SESSION"
          detail="Pick a row from the ledger to inspect session-level accuracy, pace, and execution quality."
        />
      </GlassPanel>
    );
  }

  const accuracy = getAccuracy(session);
  const performance = getPerformance(session);
  const misses = Math.max(0, session.questions - session.correct);
  const missRate = session.questions ? Math.round((misses / session.questions) * 100) : 0;
  const pace = session.duration > 0 ? (session.xp / (session.duration / 60)).toFixed(1) : "0.0";
  const isWeak = accuracy < 60;

  return (
    <GlassPanel title="SESSION_INSPECTOR" tag="VIEW" className="h-full">
      <div className="space-y-4">
        {/* Top summary */}
        <div className="rounded-lg border border-white/10 bg-white/[0.02] p-4">
          <div className="text-[10px] uppercase tracking-[0.24em] text-gray-500 font-mono">Selected Topic</div>
          <div className="mt-1 text-lg font-bold text-white font-mono uppercase">
            {session.topic}
          </div>
          <div className="text-xs text-amber-400 font-mono">{session.subject}</div>
        </div>

        {/* Quick metrics */}
        <div className="grid grid-cols-2 gap-3">
          <GlassCard label="Accuracy" value={`${accuracy}%`} tone={getScoreTone(accuracy)} />
          <GlassCard label="Focus" value={`${session.focusScore}`} tone={getScoreTone(session.focusScore)} />
          <GlassCard label="Correct" value={`${session.correct}/${session.questions}`} />
          <GlassCard label="XP Pace" value={`${pace}/m`} tone="amber" />
        </div>

        {/* Performance bars */}
        <div className="rounded-lg border border-white/10 bg-white/[0.02] p-4">
          <div className="mb-3 flex items-center justify-between text-[10px] uppercase tracking-[0.24em] text-gray-500 font-mono">
            <span>Performance Mix</span>
            <span>{formatDateTime(getSessionDate(session))}</span>
          </div>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span>Accuracy</span>
                <span>{accuracy}%</span>
              </div>
              <Rail value={accuracy} tone={getScoreTone(accuracy)} />
            </div>
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span>Focus</span>
                <span>{session.focusScore}</span>
              </div>
              <Rail value={session.focusScore} tone={getScoreTone(session.focusScore)} />
            </div>
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span>Miss Rate</span>
                <span>{missRate}%</span>
              </div>
              <Rail value={missRate} tone={missRate > 0 ? "amber" : "green"} />
            </div>
          </div>
        </div>

        {/* Weak topic action */}
        {isWeak && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-red-400 uppercase">Weak Topic Detected</p>
              <p className="text-[11px] text-gray-400">Accuracy below 60%. Target this for revision.</p>
            </div>
            <button
              onClick={handleReviseTopic}
              className="rounded-lg border border-[#00A3FF]/30 bg-[#00A3FF]/10 px-4 py-2 text-xs font-bold text-[#00A3FF] hover:bg-[#00A3FF]/20 transition-all"
            >
              REVISE NOW
            </button>
          </div>
        )}

        {/* Session meta */}
        <div className="rounded-lg border border-white/10 bg-white/[0.02] p-4">
          <div className="mb-3 text-[10px] uppercase tracking-[0.24em] text-gray-500 font-mono">Session Meta</div>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between border-b border-white/5 pb-2">
              <span className="text-gray-400">Duration</span>
              <span className="text-white">{formatMinutes(session.duration)}</span>
            </div>
            <div className="flex justify-between border-b border-white/5 pb-2">
              <span className="text-gray-400">XP Earned</span>
              <span className="text-amber-400">{session.xp}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Timestamp</span>
              <span className="text-right text-white">{formatDateTime(getSessionDate(session))}</span>
            </div>
          </div>
        </div>

        {/* Replay data (if available) */}
        {session.replay_data?.questions?.length && (
          <div className="rounded-lg border border-white/10 bg-white/[0.02] p-4">
            <div className="mb-3 text-[10px] uppercase tracking-[0.24em] text-gray-500 font-mono">
              Session Replay ({session.replay_data.questions.length} Q)
            </div>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {session.replay_data.questions.map((q, idx) => (
                <div key={q.id ?? idx} className="border border-white/10 rounded-lg p-3 bg-black/20">
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-xs font-bold text-white font-mono">
                      Q{idx + 1}. <ChemistryBlock value={q.text} className="inline" />
                    </span>
                    <TonePill tone={q.is_correct ? "green" : "red"}>
                      {q.is_correct ? "CORRECT" : "WRONG"}
                    </TonePill>
                  </div>
                  <div className="text-xs text-gray-400">
                    Your answer: <span className={q.is_correct ? "text-emerald-400" : "text-red-400"}>{q.user_answer}</span>
                  </div>
                  {!q.is_correct && (
                    <div className="text-xs text-amber-400 mt-1">
                      Correct: {q.correct_answer}
                    </div>
                  )}
                  {q.ai_explanation && (
                    <div className="mt-2 text-[11px] text-gray-500 border-t border-white/5 pt-2">
                      <ChemistryBlock value={q.ai_explanation} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </GlassPanel>
  );
}

// ------------------------------------------------------------------------------
// Main SessionsPage with filters and keyboard shortcuts
// ------------------------------------------------------------------------------
export default function SessionsPage() {
  const { sessions, loading, error } = useSessions();
  const [sortKey, setSortKey] = useState<SortKey>("latest");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [minAccuracy, setMinAccuracy] = useState(0);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const router = useRouter();
  const selectedRef = useRef<HTMLDivElement | null>(null);

  // Filter sessions
  const filteredSessions = useMemo(() => {
    let result = [...sessions];

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter(
        (s) =>
          s.topic.toLowerCase().includes(q) ||
          s.subject.toLowerCase().includes(q),
      );
    }

    if (minAccuracy > 0) {
      result = result.filter((s) => getAccuracy(s) >= minAccuracy);
    }

    if (startDate) {
      const start = new Date(startDate);
      result = result.filter((s) => {
        const d = getSessionDate(s);
        return d && d >= start;
      });
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      result = result.filter((s) => {
        const d = getSessionDate(s);
        return d && d <= end;
      });
    }

    return result;
  }, [sessions, search, minAccuracy, startDate, endDate]);

  const sortedSessions = useMemo(
    () => sortSessions(filteredSessions, sortKey),
    [filteredSessions, sortKey],
  );

  const selectedSession = useMemo(
    () => sortedSessions.find((item) => item.id === selectedId) ?? sortedSessions[0] ?? null,
    [selectedId, sortedSessions],
  );

  const summary = useMemo(
    () => ({
      totalDuration: sum(sessions, (item) => item.duration),
      avgFocus: average(sessions, (item) => item.focusScore),
      totalXp: sum(sessions, (item) => item.xp),
      count: sessions.length,
    }),
    [sessions],
  );

  const globalAccuracy =
    sessions.length
      ? Math.round((sum(sessions, (s) => s.correct) / sum(sessions, (s) => s.questions)) * 100)
      : 0;

  const clearFilters = useCallback(() => {
    setSearch("");
    setMinAccuracy(0);
    setStartDate("");
    setEndDate("");
  }, []);

  // Keyboard shortcuts
  const handleKeyDown = useCallback(
    (e: globalThis.KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement)
        return;

      if (e.key === "f" || e.key === "F") {
        e.preventDefault();
        document.getElementById("session-search")?.focus();
      } else if (e.key === "Escape") {
        clearFilters();
      } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const currentIndex = sortedSessions.findIndex((s) => s.id === selectedSession?.id);
        let nextIndex = currentIndex;
        if (e.key === "ArrowDown") {
          nextIndex = currentIndex + 1 >= sortedSessions.length ? 0 : currentIndex + 1;
        } else {
          nextIndex = currentIndex - 1 < 0 ? sortedSessions.length - 1 : currentIndex - 1;
        }
        const next = sortedSessions[nextIndex];
        if (next) {
          setSelectedId(next.id);
          // Scroll the row into view if needed
          const rowEl = document.querySelector(`[data-session-id="${next.id}"]`);
          rowEl?.scrollIntoView({ block: "nearest", behavior: "smooth" });
        }
      } else if (e.key === "Enter") {
        if (selectedSession) {
          // Already selected, no extra action needed as inspector updates automatically
        }
      }
    },
    [sortedSessions, selectedSession, clearFilters],
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  const clock = useClock();

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-gray-200 font-sans">
      <style jsx global>{`
        [data-session-id] { scroll-margin-top: 80px; }
      `}</style>
      {/* Top bar */}
      <div className="border-b border-white/10 bg-white/[0.02] backdrop-blur-sm px-6 py-3 flex flex-wrap items-center justify-between gap-3 text-xs uppercase tracking-wider text-gray-500 font-mono">
        <div className="flex items-center gap-6">
          <span>SESSION_CONSOLE</span>
          <span className="text-amber-400">{filteredSessions.length} RECORDS</span>
          <span className="text-emerald-400">ACC {globalAccuracy}%</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-emerald-400">● LIVE</span>
          <span>{clock}</span>
        </div>
      </div>

      {/* Loading state */}
      {loading ? (
        <LoadingState label="LOADING SESSION CONSOLE..." />
      ) : error ? (
        <div className="flex min-h-[560px] items-center justify-center text-red-400 text-sm uppercase tracking-wider font-mono">
          {error}
        </div>
      ) : (
        <div className="p-4 md:p-6 space-y-6">
          {/* Top stats cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
            <GlassCard label="Total Sessions" value={`${summary.count}`} />
            <GlassCard label="Study Time" value={formatHours(summary.totalDuration)} tone="amber" />
            <GlassCard label="Avg Accuracy" value={`${globalAccuracy}%`} tone={getScoreTone(globalAccuracy)} />
            <GlassCard label="Avg Focus" value={`${summary.avgFocus}`} tone={getScoreTone(summary.avgFocus)} />
            <GlassCard label="Total XP" value={`${summary.totalXp}`} tone="amber" />
            <GlassCard label="Prime Subject" value={groupBySubject(sessions)[0]?.subject ?? "—"} tone="green" active />
          </div>

          {/* Main grid */}
          <div className="grid gap-6 xl:grid-cols-[280px_minmax(0,1fr)_420px]">
            {/* Left: KPI & Subject Matrix */}
            <div className="space-y-6">
              <GlassPanel title="KPI_SNAPSHOT" tag="SYS">
                <div className="space-y-2">
                  <GlassCard label="Sessions" value={`${summary.count}`} />
                  <GlassCard label="Study Time" value={formatHours(summary.totalDuration)} tone="amber" />
                  <GlassCard label="Avg Accuracy" value={`${globalAccuracy}%`} tone={getScoreTone(globalAccuracy)} />
                  <GlassCard label="Avg Focus" value={`${summary.avgFocus}`} tone={getScoreTone(summary.avgFocus)} />
                </div>
              </GlassPanel>

              <GlassPanel title="SUBJECT_MATRIX" tag="SYS">
                {groupBySubject(sessions).length === 0 ? (
                  <div className="p-4 text-xs text-gray-500 uppercase tracking-wider">No data</div>
                ) : (
                  <div className="p-2 space-y-3">
                    {groupBySubject(sessions).slice(0, 5).map((sub) => (
                      <div key={sub.subject} className="px-2">
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-xs font-bold text-white uppercase">{sub.subject}</span>
                          <span className={cn("text-xs font-bold", toneText(getScoreTone(sub.accuracy)))}>
                            {sub.accuracy}%
                          </span>
                        </div>
                        <Rail value={sub.accuracy} tone={getScoreTone(sub.accuracy)} />
                        <div className="text-[10px] text-gray-500 mt-1">{sub.sessions} sessions · {formatHours(sub.duration)}</div>
                      </div>
                    ))}
                  </div>
                )}
              </GlassPanel>
            </div>

            {/* Middle: Session Ledger */}
            <GlassPanel title="SESSION_LEDGER" tag="LOG" className="flex flex-col min-h-0">
              <SessionFilters
                search={search}
                setSearch={setSearch}
                minAccuracy={minAccuracy}
                setMinAccuracy={setMinAccuracy}
                startDate={startDate}
                setStartDate={setStartDate}
                endDate={endDate}
                setEndDate={setEndDate}
                clearFilters={clearFilters}
              />
              <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-white/[0.02]">
                <span className="text-xs uppercase tracking-[0.24em] text-gray-500 font-mono">
                  Sort by
                </span>
                <div className="flex gap-2">
                  {(["latest", "duration", "performance"] as const).map((key) => (
                    <button
                      key={key}
                      onClick={() => setSortKey(key)}
                      className={cn(
                        "rounded-md border px-3 py-1 text-xs font-bold uppercase tracking-wider font-mono transition-all",
                        sortKey === key
                          ? "border-amber-400/40 bg-amber-400/10 text-amber-400"
                          : "border-white/10 text-gray-500 hover:border-white/30 hover:text-white",
                      )}
                    >
                      {key}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex-1 overflow-auto">
                <SessionsTable
                  sessions={sortedSessions}
                  selectedId={selectedSession?.id ?? null}
                  onSelect={(s) => setSelectedId(s.id)}
                />
              </div>
            </GlassPanel>

            {/* Right: Inspector */}
            <SessionInspector session={selectedSession} />
          </div>
        </div>
      )}
    </div>
  );
}
