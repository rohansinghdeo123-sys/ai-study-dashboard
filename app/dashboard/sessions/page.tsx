"use client";

import { useAuth } from "@/context/AuthContext";
import { AlertState, EmptyState as PolishedEmptyState, ErrorState, LoadingState } from "@/components/ui/Polished";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type ReplayQuestion = {
  id?: string;
  text?: string;
  question?: string;
  topic?: string;
  subtopic?: string;
  options?: string[];
  correct_answer?: string;
  correct?: string;
  user_answer?: string;
  answer?: string;
  is_correct?: boolean;
  ai_explanation?: string;
  explanation?: string;
};

type SessionRecord = {
  id?: string | number;
  subject?: string;
  topic?: string;
  duration?: number;
  time_spent_seconds?: number;
  questions?: number;
  total_questions?: number;
  correct?: number;
  score?: number;
  xp?: number;
  xp_earned?: number;
  focusScore?: number;
  focus_score?: number;
  date?: string;
  timestamp?: string;
  createdAt?: string;
  startedAt?: string;
  completedAt?: string;
  status?: string | null;
  performance?: number | null;
  replay_data?: {
    questions?: ReplayQuestion[];
  };
};

type SortKey = "latest" | "accuracy" | "xp";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function toNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeSessions(value: unknown): SessionRecord[] {
  const list = Array.isArray(value)
    ? value
    : isRecord(value) && Array.isArray(value.sessions)
      ? value.sessions
      : [];

  return list.filter(Boolean).map((item, index) => {
    const session = item as SessionRecord;
    return {
      ...session,
      id: session.id ?? `${session.topic || "session"}-${index}`,
      subject: session.subject || "Study",
      topic: session.topic || "Learning session",
    };
  });
}

function getQuestionCount(session: SessionRecord) {
  return Math.max(0, toNumber(session.total_questions ?? session.questions));
}

function getCorrectCount(session: SessionRecord) {
  return Math.max(0, toNumber(session.correct ?? session.score));
}

function getAccuracy(session: SessionRecord) {
  const total = getQuestionCount(session);
  if (!total) return 0;
  return Math.round((getCorrectCount(session) / total) * 100);
}

function getXp(session: SessionRecord) {
  return toNumber(session.xp_earned ?? session.xp);
}

function getDurationMinutes(session: SessionRecord) {
  if (session.time_spent_seconds) return Math.max(1, Math.round(session.time_spent_seconds / 60));
  return Math.max(0, toNumber(session.duration));
}

function getSessionDate(session: SessionRecord) {
  const raw = session.timestamp || session.date || session.createdAt || session.startedAt || session.completedAt;
  if (!raw) return null;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatDate(value: Date | null) {
  if (!value) return "No timestamp";
  return value.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatTopic(value?: string) {
  return (value || "Learning session").replace(/_/g, " ");
}

function sortSessions(sessions: SessionRecord[], sortKey: SortKey) {
  const list = [...sessions];
  return list.sort((a, b) => {
    if (sortKey === "accuracy") return getAccuracy(b) - getAccuracy(a);
    if (sortKey === "xp") return getXp(b) - getXp(a);
    return (getSessionDate(b)?.getTime() ?? 0) - (getSessionDate(a)?.getTime() ?? 0);
  });
}

function StatCard({ label, value, helper }: { label: string; value: string | number; helper: string }) {
  return (
    <div className="rounded-[1.5rem] border border-white/70 bg-white/78 p-5 shadow-[0_18px_60px_rgba(15,23,42,0.08)] backdrop-blur-2xl">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{label}</p>
      <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">{value}</p>
      <p className="mt-2 text-sm text-slate-500">{helper}</p>
    </div>
  );
}

function AccuracyRail({ value }: { value: number }) {
  return (
    <div className="h-2 rounded-full bg-slate-100">
      <div
        className="h-full rounded-full bg-[linear-gradient(90deg,#0E7490,#14B8A6,#F2B84B)] transition-all"
        style={{ width: `${Math.max(4, Math.min(100, value))}%` }}
      />
    </div>
  );
}

function EmptyState() {
  return (
    <PolishedEmptyState
      icon="history"
      title="No sessions yet"
      detail="Complete one Study Lab conversation or Autonomous Mission. Your replay, score, XP, and weak signals will appear here."
      action={
        <>
        <Link href="/dashboard/study" className="agentify-action agentify-action-primary rounded-2xl bg-[#0E7490] px-5 py-3 text-sm font-semibold text-white shadow-[0_16px_42px_rgba(14,116,144,0.20)]">
          Ask tutor
        </Link>
        <Link href="/dashboard/mission" className="agentify-action agentify-action-secondary rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700">
          Start mission
        </Link>
        </>
      }
    />
  );
}

export default function SessionsPage() {
  const { user, loading, claimsLoading, getAuthHeaders } = useAuth();
  const backendURL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://127.0.0.1:8000";

  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string | number | null>(null);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("latest");
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (loading || claimsLoading) return;
    if (!user?.uid) {
      setSessions([]);
      setLoadingData(false);
      return;
    }

    const uid = user.uid;
    let active = true;
    async function loadSessions() {
      setLoadingData(true);
      setError("");
      try {
        const response = await fetch(`${backendURL}/sessions/${uid}`, {
          cache: "no-store",
          headers: await getAuthHeaders(),
        });
        if (!response.ok) throw new Error(`Failed to load sessions: ${response.status}`);
        const data = normalizeSessions(await response.json());
        if (!active) return;
        setSessions(data);
        setSelectedId((current) => current ?? data[0]?.id ?? null);
      } catch {
        if (!active) return;
        setError("Sessions could not load right now.");
        setSessions([]);
      } finally {
        if (active) setLoadingData(false);
      }
    }

    void loadSessions();
    return () => {
      active = false;
    };
  }, [backendURL, claimsLoading, getAuthHeaders, loading, user?.uid]);

  const filteredSessions = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    const filtered = normalizedSearch
      ? sessions.filter((session) => {
          const haystack = `${session.subject || ""} ${session.topic || ""} ${session.status || ""}`.toLowerCase();
          return haystack.includes(normalizedSearch);
        })
      : sessions;
    return sortSessions(filtered, sortKey);
  }, [search, sessions, sortKey]);

  const selectedSession = filteredSessions.find((session) => session.id === selectedId) || filteredSessions[0] || null;
  const totalQuestions = sessions.reduce((total, session) => total + getQuestionCount(session), 0);
  const totalCorrect = sessions.reduce((total, session) => total + getCorrectCount(session), 0);
  const averageAccuracy = totalQuestions ? Math.round((totalCorrect / totalQuestions) * 100) : 0;
  const totalXp = sessions.reduce((total, session) => total + getXp(session), 0);
  const totalMinutes = sessions.reduce((total, session) => total + getDurationMinutes(session), 0);
  const replayQuestions = selectedSession?.replay_data?.questions || [];

  if (loading || claimsLoading) {
    return (
      <LoadingState title="Loading sessions..." detail="Collecting your replays, scores, XP, and saved practice history." />
    );
  }

  return (
    <div className="flex min-h-[calc(100svh-105px)] w-full flex-col gap-5">
      <section className="rounded-[2rem] border border-white/70 bg-white/74 p-5 shadow-[0_24px_90px_rgba(15,23,42,0.10)] backdrop-blur-2xl">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#0E7490]">Session Library</p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-950">Replay what you learned</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500">
              A clean record of practice, tutor sessions, and autonomous missions so students can see progress without hunting through chats.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search topic..."
              className="agentify-field w-full rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#0E7490] sm:w-56"
            />
            {(["latest", "accuracy", "xp"] as SortKey[]).map((key) => (
              <button
                type="button"
                key={key}
                onClick={() => setSortKey(key)}
                className={`agentify-action rounded-2xl border px-4 py-3 text-xs font-semibold capitalize transition ${
                  sortKey === key ? "border-[#0E7490]/25 bg-[#0E7490]/10 text-[#0E7490]" : "border-slate-200 bg-white/75 text-slate-500 hover:text-slate-900"
                }`}
              >
                {key}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        <StatCard label="Sessions" value={sessions.length} helper={loadingData ? "Updating..." : "Stored attempts"} />
        <StatCard label="Accuracy" value={`${averageAccuracy}%`} helper={`${totalCorrect}/${totalQuestions || 0} correct`} />
        <StatCard label="XP" value={totalXp} helper="Earned from practice" />
        <StatCard label="Study time" value={`${totalMinutes}m`} helper="Recorded duration" />
      </section>

      {error && sessions.length ? (
        <AlertState message={error} />
      ) : null}

      {error && !sessions.length ? (
        <ErrorState
          title="Sessions could not load"
          detail="The page is ready, but the backend did not return your saved sessions. You can retry or continue studying while the service recovers."
          action={
            <>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="agentify-action agentify-action-primary rounded-2xl px-5 py-3 text-sm font-semibold"
              >
                Try again
              </button>
              <Link href="/dashboard/study" className="agentify-action agentify-action-secondary rounded-2xl px-5 py-3 text-sm font-semibold">
                Open Study Lab
              </Link>
            </>
          }
        />
      ) : !filteredSessions.length ? (
        <EmptyState />
      ) : (
        <section className="grid min-h-[560px] flex-1 gap-5 lg:grid-cols-[420px_minmax(0,1fr)]">
          <div className="overflow-hidden rounded-[2rem] border border-white/70 bg-white/74 shadow-[0_22px_80px_rgba(15,23,42,0.08)] backdrop-blur-2xl">
            <div className="border-b border-slate-200/70 px-5 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Timeline</p>
            </div>
            <div className="max-h-[640px] space-y-3 overflow-y-auto p-4">
              {filteredSessions.map((session) => {
                const accuracy = getAccuracy(session);
                const active = selectedSession?.id === session.id;
                return (
                  <button
                    type="button"
                    key={session.id}
                    onClick={() => setSelectedId(session.id ?? null)}
                    className={`w-full rounded-[1.4rem] border p-4 text-left transition ${
                      active
                        ? "border-[#0E7490]/25 bg-[#0E7490]/10 shadow-[0_18px_50px_rgba(14,116,144,0.12)]"
                        : "border-slate-200 bg-white/62 hover:border-[#0E7490]/20 hover:bg-white"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-base font-semibold capitalize text-slate-950">{formatTopic(session.topic)}</p>
                        <p className="mt-1 text-sm text-slate-500">{session.subject || "Study"} - {formatDate(getSessionDate(session))}</p>
                      </div>
                      <span className="rounded-full bg-white/80 px-3 py-1 text-sm font-bold text-[#0E7490]">{accuracy}%</span>
                    </div>
                    <div className="mt-4">
                      <AccuracyRail value={accuracy} />
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2 text-xs font-medium text-slate-500">
                      <span className="rounded-full bg-slate-100 px-3 py-1">{getQuestionCount(session)} questions</span>
                      <span className="rounded-full bg-slate-100 px-3 py-1">{getXp(session)} XP</span>
                      <span className="rounded-full bg-slate-100 px-3 py-1">{getDurationMinutes(session)}m</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="overflow-hidden rounded-[2rem] border border-white/70 bg-white/78 shadow-[0_22px_80px_rgba(15,23,42,0.08)] backdrop-blur-2xl">
            {selectedSession ? (
              <div className="flex h-full flex-col">
                <div className="border-b border-slate-200/70 p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#0E7490]">Selected session</p>
                  <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h2 className="text-3xl font-semibold capitalize tracking-tight text-slate-950">{formatTopic(selectedSession.topic)}</h2>
                      <p className="mt-2 text-sm text-slate-500">{selectedSession.subject || "Study"} - {formatDate(getSessionDate(selectedSession))}</p>
                    </div>
                    <Link
                      href={`/dashboard/study?topic=${encodeURIComponent(String(selectedSession.topic || ""))}`}
                      className="agentify-action agentify-action-primary rounded-2xl bg-[#0E7490] px-4 py-3 text-center text-sm font-semibold text-white shadow-[0_16px_42px_rgba(14,116,144,0.20)]"
                    >
                      Revise topic
                    </Link>
                  </div>
                </div>

                <div className="grid gap-3 border-b border-slate-200/70 p-5 sm:grid-cols-3">
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <p className="text-xs text-slate-400">Accuracy</p>
                    <p className="mt-2 text-2xl font-semibold text-slate-950">{getAccuracy(selectedSession)}%</p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <p className="text-xs text-slate-400">Correct</p>
                    <p className="mt-2 text-2xl font-semibold text-slate-950">{getCorrectCount(selectedSession)}/{getQuestionCount(selectedSession)}</p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <p className="text-xs text-slate-400">XP</p>
                    <p className="mt-2 text-2xl font-semibold text-slate-950">{getXp(selectedSession)}</p>
                  </div>
                </div>

                <div className="flex-1 space-y-4 overflow-y-auto p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Replay</p>
                  {replayQuestions.length ? (
                    replayQuestions.map((question, index) => {
                      const text = question.text || question.question || `Question ${index + 1}`;
                      const correct = question.correct_answer || question.correct || "";
                      const userAnswer = question.user_answer || question.answer || "";
                      return (
                        <div key={question.id || text} className="rounded-[1.4rem] border border-slate-200 bg-white/70 p-4">
                          <div className="flex items-start gap-3">
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl bg-[#0E7490]/10 text-sm font-bold text-[#0E7490]">
                              {index + 1}
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-semibold leading-6 text-slate-950">{text}</p>
                              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                                <div className="rounded-2xl bg-slate-50 p-3 text-sm text-slate-600">
                                  Your answer: <span className="font-semibold text-slate-950">{userAnswer || "Not captured"}</span>
                                </div>
                                <div className="rounded-2xl bg-emerald-50 p-3 text-sm text-emerald-700">
                                  Correct: <span className="font-semibold">{correct || "Not captured"}</span>
                                </div>
                              </div>
                              {(question.ai_explanation || question.explanation) ? (
                                <p className="mt-3 rounded-2xl bg-[#0E7490]/10 p-3 text-sm leading-6 text-slate-600">
                                  {question.ai_explanation || question.explanation}
                                </p>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <p className="rounded-[1.4rem] border border-slate-200 bg-slate-50 p-5 text-sm leading-6 text-slate-500">
                      Replay details were not saved for this session. Future missions and quiz attempts will store question-level review data here.
                    </p>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        </section>
      )}
    </div>
  );
}
