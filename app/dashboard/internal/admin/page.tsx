"use client";

import { useAuth } from "@/context/AuthContext";
import { apiFetch, apiJson, invalidateApiCache } from "@/lib/apiClient";
import { LoadingState } from "@/components/ui/Polished";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL || "http://127.0.0.1:8000";
const REFRESH_MS = 12000;

type ConsoleTab = "overview" | "agents" | "traces" | "students" | "content" | "system" | "audit";
type Tone = "teal" | "gold" | "green" | "red" | "blue" | "neutral";

interface ConsoleMetric {
  value: number | string | null;
  source: string;
  unit?: string;
  note?: string;
}

interface AgentStatus {
  agent_id: string;
  display_name: string;
  status: string;
  health: string;
  current_task: string;
  last_activity: string;
  total_requests: number;
  total_errors: number;
  total_success: number;
  avg_latency_ms: number;
  last_quality_score: number;
  success_rate: number;
}

interface AdminTrace {
  id: number;
  created_at: string;
  turn_id: string;
  session_id: string;
  user_id: string;
  trace_type: string;
  name: string;
  provider: string;
  model: string;
  status: string;
  latency_ms: number;
  estimated_input_tokens: number;
  estimated_output_tokens: number;
  estimated_cost_usd: number;
  metadata: Record<string, unknown>;
}

interface AdminEvent {
  id?: number;
  version?: number;
  timestamp: string;
  agent_id: string;
  event_type: string;
  severity: string;
  session_id: string;
  summary?: string;
  latency_ms?: number;
  estimated_cost_usd?: number;
  data?: Record<string, unknown>;
}

interface StudentRow {
  user_id: string;
  xp: number;
  level: number;
  streak: number;
  total_tests: number;
  total_questions: number;
  total_correct: number;
  accuracy: number;
  last_active_date: string | null;
  focus_score: number;
  consistency_index: number;
  learning_efficiency: number;
}

interface ContentJob {
  job_id: string;
  job_type: string;
  status: string;
  source_path: string;
  created_at: string;
  summary: Record<string, unknown>;
}

interface AuditRow {
  id: number;
  created_at: string;
  actor_uid: string;
  actor_email: string;
  action: string;
  target_type: string;
  target_id: string;
  status: string;
  metadata: Record<string, unknown>;
}

interface AdminConsolePayload {
  generated_at: string;
  environment: string;
  header: {
    system_status: string;
    backend_ready: boolean;
    database_status: string;
    auth_status: string;
    llm_status: string;
    rag_status: string;
    last_sync_time: string;
  };
  overview: Record<string, ConsoleMetric>;
  agents: AgentStatus[];
  traces: AdminTrace[];
  events: AdminEvent[];
  students: StudentRow[];
  audit: AuditRow[];
  content: {
    chapters_total: number;
    approved_or_published: number;
    coverage_score_avg: number | null;
    status_counts: Record<string, number>;
    recent_jobs: ContentJob[];
  };
  quality: {
    avg_quality_score: number | null;
    low_quality_answers: number;
    hallucination_risk: number;
    missing_sources: number;
    failed_mcq_generation: number;
    empty_retrieval: number;
    slow_responses: number;
    fallback_used: number;
    badges: Record<string, number>;
  };
  system: {
    event_bus: Record<string, unknown>;
    observability: Record<string, unknown>;
    services: Array<{ name: string; status: string }>;
  };
}

const REQUIRED_AGENTS = [
  { id: "orchestrator", label: "Supervisor Orchestrator", role: "Routes tasks and audits multi-agent flow." },
  { id: "tutor", label: "Subject Tutor", role: "Student-friendly doubt solving and concept teaching." },
  { id: "revision", label: "Revision Specialist", role: "Notes, summaries, recall, and revision outputs." },
  { id: "exam", label: "Exam Generator", role: "MCQs, probable questions, scoring, and review." },
  { id: "planner", label: "Study Planner", role: "Learning paths, weak-topic decisions, next best action." },
  { id: "coach", label: "Personal AI Coach", role: "Memory, motivation, continuity, and student progress." },
];

const TABS: Array<{ id: ConsoleTab; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "agents", label: "Agents" },
  { id: "traces", label: "Traces" },
  { id: "students", label: "Students" },
  { id: "content", label: "Content" },
  { id: "system", label: "System" },
  { id: "audit", label: "Audit" },
];

const OVERVIEW_CARDS: Array<{ key: string; label: string; tone: Tone }> = [
  { key: "total_users", label: "Total users", tone: "teal" },
  { key: "active_students_today", label: "Active students today", tone: "green" },
  { key: "active_sessions", label: "Active sessions", tone: "blue" },
  { key: "questions_asked", label: "Questions asked", tone: "teal" },
  { key: "revision_generations", label: "Revision generations", tone: "gold" },
  { key: "exam_generations", label: "Exam generations", tone: "gold" },
  { key: "mcqs_attempted", label: "MCQs attempted", tone: "blue" },
  { key: "average_accuracy", label: "Average accuracy", tone: "green" },
  { key: "api_llm_usage", label: "API/LLM usage", tone: "teal" },
  { key: "errors_failures", label: "Errors/failures", tone: "red" },
  { key: "avg_latency", label: "Avg latency", tone: "blue" },
  { key: "grounded_answer_rate", label: "Grounded answer rate", tone: "green" },
];

function cn(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function parseEnvList(value?: string) {
  return (value || "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

function founderEmails() {
  return parseEnvList(process.env.NEXT_PUBLIC_FOUNDER_ADMIN_EMAILS || process.env.NEXT_PUBLIC_ADMIN_EMAILS);
}

function formatMetric(metric?: ConsoleMetric) {
  if (!metric || metric.value === null || metric.value === undefined || metric.value === "") return "Not tracked";
  if (typeof metric.value === "number") {
    if (metric.unit?.includes("usd")) return `$${metric.value.toFixed(4)}`;
    if (metric.unit?.includes("%")) return `${metric.value}%`;
    if (metric.unit?.includes("ms")) return metric.value >= 1000 ? `${(metric.value / 1000).toFixed(1)}s` : `${Math.round(metric.value)}ms`;
    if (metric.value >= 1_000_000) return `${(metric.value / 1_000_000).toFixed(1)}M`;
    if (metric.value >= 1_000) return `${(metric.value / 1_000).toFixed(1)}K`;
  }
  return String(metric.value);
}

function formatTime(value?: string) {
  if (!value) return "Unknown";
  const time = new Date(value);
  if (!Number.isFinite(time.getTime())) return "Unknown";
  return time.toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function exportJson(filename: string, payload: unknown) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function toneClasses(tone: Tone) {
  const map = {
    teal: "border-cyan-300/18 bg-cyan-300/[0.08] text-cyan-100",
    gold: "border-amber-300/20 bg-amber-300/10 text-amber-100",
    green: "border-emerald-300/18 bg-emerald-300/[0.08] text-emerald-100",
    red: "border-rose-300/18 bg-rose-300/[0.09] text-rose-100",
    blue: "border-sky-300/18 bg-sky-300/[0.08] text-sky-100",
    neutral: "border-white/10 bg-white/[0.045] text-slate-200",
  };
  return map[tone];
}

function statusTone(status: string): Tone {
  const normalized = status.toLowerCase();
  if (["ready", "online", "healthy", "success", "configured", "running"].some((item) => normalized.includes(item))) return "green";
  if (["degraded", "waiting", "warning", "needs"].some((item) => normalized.includes(item))) return "gold";
  if (["error", "failed", "critical", "missing", "not_configured"].some((item) => normalized.includes(item))) return "red";
  return "neutral";
}

function StatusPill({ value, tone }: { value: string; tone?: Tone }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em]", toneClasses(tone || statusTone(value)))}>
      <span className="h-1.5 w-1.5 rounded-full bg-current shadow-[0_0_12px_currentColor]" />
      {value.replace(/_/g, " ")}
    </span>
  );
}

function ConsolePanel({ title, eyebrow, children, action }: { title: string; eyebrow?: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="rounded-[1.35rem] border border-white/10 bg-[#0B111C]/78 shadow-[0_24px_80px_rgba(0,0,0,0.24)] backdrop-blur-2xl">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
        <div>
          {eyebrow ? <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-cyan-200/70">{eyebrow}</p> : null}
          <h2 className="mt-1 text-base font-semibold text-white">{title}</h2>
        </div>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

function MetricCard({ label, metric, tone }: { label: string; metric?: ConsoleMetric; tone: Tone }) {
  const notTracked = !metric || metric.value === null || metric.value === undefined;
  return (
    <article className={cn("min-h-[118px] rounded-[1.15rem] border p-4", toneClasses(notTracked ? "neutral" : tone))}>
      <div className="flex items-start justify-between gap-3">
        <p className="max-w-[10rem] text-xs font-semibold text-slate-400">{label}</p>
        <span className="rounded-full border border-white/10 bg-black/20 px-2 py-0.5 text-[9px] uppercase tracking-[0.12em] text-slate-500">
          {metric?.source || "db"}
        </span>
      </div>
      <p className={cn("mt-4 text-2xl font-semibold tracking-tight", notTracked ? "text-slate-500" : "text-white")}>{formatMetric(metric)}</p>
      <p className="mt-2 line-clamp-2 text-[11px] leading-4 text-slate-500">{metric?.note || metric?.unit || "Live backend metric"}</p>
    </article>
  );
}

function UnauthorizedState({ email }: { email: string }) {
  return (
    <div className="flex min-h-[calc(100svh-8rem)] items-center justify-center">
      <div className="max-w-xl rounded-[2rem] border border-rose-300/20 bg-[#0B111C]/88 p-8 text-center shadow-[0_30px_100px_rgba(0,0,0,0.30)]">
        <StatusPill value="Founder access only" tone="red" />
        <h1 className="mt-5 text-3xl font-semibold text-white">Admin Console is restricted.</h1>
        <p className="mt-3 text-sm leading-6 text-slate-400">
          Signed in as {email || "unknown account"}. This console only opens for approved founder emails configured in environment.
        </p>
        <Link href="/dashboard" className="mt-6 inline-flex rounded-full border border-white/10 bg-white/[0.06] px-5 py-3 text-sm font-semibold text-slate-200 transition hover:bg-white/[0.10]">
          Return to dashboard
        </Link>
      </div>
    </div>
  );
}

export default function FounderAdminConsolePage() {
  const { user, profile, isAdmin, loading, claimsLoading, getAuthHeaders } = useAuth();
  const [data, setData] = useState<AdminConsolePayload | null>(null);
  const [activeTab, setActiveTab] = useState<ConsoleTab>("overview");
  const [selectedAgent, setSelectedAgent] = useState("orchestrator");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const openedRef = useRef(false);

  const allowedEmails = useMemo(() => founderEmails(), []);
  const email = (profile?.email || user?.email || "").toLowerCase();
  const founderAllowed = Boolean(isAdmin && email && allowedEmails.includes(email));

  const adminFetch = useCallback(async (path: string, init?: RequestInit) => {
    const headers = await getAuthHeaders();
    return apiJson<AdminConsolePayload>(`${API_BASE}${path}`, {
      ...init,
      headers: { ...headers, ...(init?.headers || {}) },
      forceFresh: true,
      retries: 1,
      timeoutMs: 10000,
    });
  }, [getAuthHeaders]);

  const audit = useCallback(async (action: string, metadata: Record<string, unknown> = {}, targetType = "console", targetId = "") => {
    if (!founderAllowed) return;
    try {
      const headers = await getAuthHeaders();
      await apiFetch(`${API_BASE}/admin/audit`, {
        method: "POST",
        headers,
        timeoutMs: 6000,
        body: JSON.stringify({
          action,
          target_type: targetType,
          target_id: targetId,
          metadata: { route: "/dashboard/internal/admin", ...metadata },
        }),
      });
    } catch {
      // Audit failure should not block read-only visibility.
    }
  }, [founderAllowed, getAuthHeaders]);

  const loadConsole = useCallback(async () => {
    if (!founderAllowed) return;
    setRefreshing(true);
    try {
      const payload = await adminFetch("/admin/console");
      setData(payload);
      setError("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Admin console could not load.");
    } finally {
      setRefreshing(false);
    }
  }, [adminFetch, founderAllowed]);

  useEffect(() => {
    if (!founderAllowed) return;
    void loadConsole();
    const interval = window.setInterval(loadConsole, REFRESH_MS);
    return () => window.clearInterval(interval);
  }, [founderAllowed, loadConsole]);

  useEffect(() => {
    if (!founderAllowed || openedRef.current) return;
    openedRef.current = true;
    void audit("open_founder_admin_console", { email });
  }, [audit, email, founderAllowed]);

  const setTab = (tab: ConsoleTab) => {
    setActiveTab(tab);
    void audit("switch_admin_console_tab", { tab }, "tab", tab);
  };

  const agentsById = useMemo(() => new Map((data?.agents || []).map((agent) => [agent.agent_id, agent])), [data?.agents]);
  const selectedAgentRecord = agentsById.get(selectedAgent);
  const selectedAgentEvents = (data?.events || []).filter((event) => event.agent_id === selectedAgent).slice(0, 20);
  const selectedAgentTraces = (data?.traces || []).filter((trace) => trace.name.includes(selectedAgent) || trace.metadata?.gateway_agent === selectedAgent).slice(0, 16);

  const filteredTraces = useMemo(() => {
    const normalized = query.toLowerCase().trim();
    return (data?.traces || []).filter((trace) => {
      const haystack = `${trace.user_id} ${trace.session_id} ${trace.turn_id} ${trace.name} ${trace.status} ${trace.model}`.toLowerCase();
      if (normalized && !haystack.includes(normalized)) return false;
      if (statusFilter === "error" && trace.status === "success") return false;
      if (statusFilter === "slow" && trace.latency_ms < 7000) return false;
      if (statusFilter !== "all" && statusFilter !== "error" && statusFilter !== "slow" && trace.status !== statusFilter) return false;
      return true;
    });
  }, [data?.traces, query, statusFilter]);

  const exportCurrentReport = () => {
    if (!data) return;
    exportJson(`agentify-admin-console-${Date.now()}.json`, data);
    void audit("export_admin_console_report", { tab: activeTab }, "report", "console");
  };

  const exportTraces = () => {
    exportJson(`agentify-traces-${Date.now()}.json`, filteredTraces);
    void audit("export_traces", { count: filteredTraces.length }, "trace", "filtered");
  };

  const reindexContent = async () => {
    if (!window.confirm("Re-index NCERT material from backend/data/raw/ncert? This can take time and should only be run after PDFs are ready.")) return;
    await audit("confirm_reindex_material", {}, "content", "raw_ncert");
    try {
      const headers = await getAuthHeaders();
      await apiFetch(`${API_BASE}/admin/content/ingest-folder`, {
        method: "POST",
        headers,
        timeoutMs: 30000,
        body: JSON.stringify({ replace_existing_extraction: true }),
      });
      await audit("reindex_material_started", {}, "content", "raw_ncert");
      void loadConsole();
    } catch {
      await audit("reindex_material_failed", {}, "content", "raw_ncert");
    }
  };

  if (loading || claimsLoading) {
    return <LoadingState title="Verifying founder session..." detail="Checking admin claims and founder email allow-list." />;
  }

  if (!founderAllowed) {
    return <UnauthorizedState email={email} />;
  }

  const header = data?.header;
  const quality = data?.quality;

  return (
    <div className="min-h-[calc(100svh-5rem)] text-slate-100">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[#05080D]" />
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(circle_at_18%_0%,rgba(20,184,166,0.18),transparent_34%),radial-gradient(circle_at_88%_8%,rgba(242,184,75,0.14),transparent_28%),linear-gradient(180deg,#05080D_0%,#09111D_48%,#05080D_100%)]" />
      <div className="mx-auto flex w-full max-w-[1540px] flex-col gap-5 px-2 pb-8 sm:px-4">
        <header className="sticky top-[4.6rem] z-20 rounded-[1.45rem] border border-white/10 bg-[#07111C]/92 p-4 shadow-[0_24px_90px_rgba(0,0,0,0.32)] backdrop-blur-2xl">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <StatusPill value="Founder only" tone="gold" />
                <StatusPill value={header?.system_status || "syncing"} />
                <span className="text-xs text-slate-500">Last sync {formatTime(header?.last_sync_time || data?.generated_at)}</span>
              </div>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">AgentifyAI Admin Console</h1>
              <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-400">
                Founder-grade command center for Study Lab, Revision, Exam, Sessions, Analytics, backend health, agent traces, quality risks, and content readiness.
              </p>
            </div>
            <div className="grid gap-2 sm:grid-cols-3 xl:w-[520px]">
              {[
                ["Backend", header?.backend_ready ? "ready" : "degraded"],
                ["Database", header?.database_status || "unknown"],
                ["Auth", header?.auth_status || "unknown"],
                ["LLM", header?.llm_status || "unknown"],
                ["RAG", header?.rag_status || "unknown"],
                ["Env", data?.environment || "development"],
              ].map(([label, value]) => (
                <div key={label} className="rounded-2xl border border-white/10 bg-white/[0.045] px-3 py-2">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">{label}</p>
                  <p className="mt-1 truncate text-xs font-semibold text-slate-100">{value}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-3">
            <nav className="flex max-w-full gap-1 overflow-x-auto rounded-full border border-white/10 bg-black/20 p-1">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setTab(tab.id)}
                  className={cn(
                    "rounded-full px-3.5 py-2 text-xs font-semibold transition",
                    activeTab === tab.id ? "bg-cyan-300/[0.14] text-cyan-100 shadow-[0_0_24px_rgba(20,184,166,0.12)]" : "text-slate-500 hover:bg-white/[0.06] hover:text-slate-200",
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </nav>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => { void audit("manual_console_refresh"); void loadConsole(); }} className="rounded-full border border-white/10 bg-white/[0.055] px-4 py-2 text-xs font-semibold text-slate-200 transition hover:bg-white/[0.09]">
                {refreshing ? "Refreshing..." : "Refresh"}
              </button>
              <button type="button" onClick={exportCurrentReport} className="rounded-full border border-amber-300/25 bg-amber-300/10 px-4 py-2 text-xs font-semibold text-amber-100 transition hover:bg-amber-300/15">
                Export report
              </button>
            </div>
          </div>
        </header>

        {error ? (
          <div className="rounded-2xl border border-rose-300/20 bg-rose-300/10 px-4 py-3 text-sm text-rose-100">{error}</div>
        ) : null}

        {!data ? (
          <LoadingState title="Loading command center..." detail="Collecting agents, traces, quality signals, content status, and audit logs." />
        ) : null}

        {data && activeTab === "overview" ? (
          <div className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {OVERVIEW_CARDS.map((card) => (
                <MetricCard key={card.key} label={card.label} metric={data.overview[card.key]} tone={card.tone} />
              ))}
            </div>
            <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
              <ConsolePanel title="Quality Control" eyebrow="Risk surface">
                <div className="grid gap-3 sm:grid-cols-2">
                  {[
                    ["Hallucination risk", quality?.hallucination_risk ?? 0, "red"],
                    ["Missing sources", quality?.missing_sources ?? 0, "gold"],
                    ["Failed MCQ generation", quality?.failed_mcq_generation ?? 0, "red"],
                    ["Empty retrieval", quality?.empty_retrieval ?? 0, "gold"],
                    ["Slow responses", quality?.slow_responses ?? 0, "blue"],
                    ["Fallback used", quality?.fallback_used ?? 0, "neutral"],
                  ].map(([label, value, tone]) => (
                    <div key={label} className={cn("rounded-2xl border p-4", toneClasses(tone as Tone))}>
                      <p className="text-xs text-slate-400">{label}</p>
                      <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {Object.entries(quality?.badges || {}).map(([label, value]) => (
                    <StatusPill key={label} value={`${label}: ${value}`} tone={label.includes("failed") ? "red" : label.includes("needs") ? "gold" : "green"} />
                  ))}
                </div>
              </ConsolePanel>
              <ConsolePanel title="Current System Pulse" eyebrow="Vercel-style health">
                <div className="space-y-2">
                  {data.system.services.map((service) => (
                    <div key={service.name} className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.035] px-4 py-3">
                      <span className="text-sm text-slate-300">{service.name}</span>
                      <StatusPill value={service.status} />
                    </div>
                  ))}
                </div>
              </ConsolePanel>
            </div>
          </div>
        ) : null}

        {data && activeTab === "agents" ? (
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_430px]">
            <ConsolePanel title="AgentOps Fleet" eyebrow="LangSmith + AgentOps style">
              <div className="grid gap-3 lg:grid-cols-2">
                {REQUIRED_AGENTS.map((definition) => {
                  const agent = agentsById.get(definition.id);
                  const active = selectedAgent === definition.id;
                  return (
                    <button
                      key={definition.id}
                      type="button"
                      onClick={() => { setSelectedAgent(definition.id); void audit("open_agent_detail", { agent_id: definition.id }, "agent", definition.id); }}
                      className={cn(
                        "rounded-[1.2rem] border p-4 text-left transition hover:-translate-y-0.5",
                        active ? "border-cyan-300/35 bg-cyan-300/10" : "border-white/10 bg-white/[0.035] hover:bg-white/[0.06]",
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-white">{definition.label}</p>
                          <p className="mt-1 text-xs leading-5 text-slate-500">{definition.role}</p>
                        </div>
                        <StatusPill value={agent?.status || "not reporting"} tone={agent ? statusTone(agent.health || agent.status) : "neutral"} />
                      </div>
                      <div className="mt-4 grid grid-cols-4 gap-2 text-center">
                        <div><p className="text-[10px] text-slate-500">Requests</p><p className="text-sm font-semibold text-white">{agent?.total_requests ?? 0}</p></div>
                        <div><p className="text-[10px] text-slate-500">Latency</p><p className="text-sm font-semibold text-white">{agent?.avg_latency_ms ? `${Math.round(agent.avg_latency_ms)}ms` : "--"}</p></div>
                        <div><p className="text-[10px] text-slate-500">Success</p><p className="text-sm font-semibold text-emerald-200">{agent?.success_rate ?? 0}%</p></div>
                        <div><p className="text-[10px] text-slate-500">Errors</p><p className="text-sm font-semibold text-rose-200">{agent?.total_errors ?? 0}</p></div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </ConsolePanel>

            <ConsolePanel title={selectedAgentRecord?.display_name || REQUIRED_AGENTS.find((item) => item.id === selectedAgent)?.label || "Agent detail"} eyebrow="Detail panel">
              <div className="space-y-4">
                <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Current task</p>
                  <p className="mt-2 text-sm leading-6 text-slate-200">{selectedAgentRecord?.current_task || "No current task reported."}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <StatusPill value={selectedAgentRecord?.health || "unknown"} />
                    <StatusPill value={`quality ${selectedAgentRecord?.last_quality_score ?? 0}`} tone="gold" />
                  </div>
                </div>
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Recent traces</p>
                  <div className="space-y-2">
                    {selectedAgentTraces.length ? selectedAgentTraces.map((trace) => (
                      <div key={trace.id} className="rounded-xl border border-white/10 bg-black/20 p-3">
                        <div className="flex items-center justify-between gap-3">
                          <span className="truncate text-xs font-semibold text-slate-200">{trace.name}</span>
                          <span className="text-[11px] text-slate-500">{trace.latency_ms}ms</span>
                        </div>
                        <p className="mt-1 truncate text-[11px] text-slate-500">{trace.model || trace.provider || trace.trace_type}</p>
                      </div>
                    )) : <p className="text-sm text-slate-500">No trace rows mapped to this agent yet.</p>}
                  </div>
                </div>
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Recent events</p>
                  <div className="space-y-2">
                    {selectedAgentEvents.length ? selectedAgentEvents.map((event) => (
                      <div key={`${event.version}-${event.timestamp}`} className="rounded-xl border border-white/10 bg-black/20 p-3">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-xs font-semibold text-slate-200">{event.event_type}</span>
                          <StatusPill value={event.severity} />
                        </div>
                        <p className="mt-1 line-clamp-2 text-[11px] text-slate-500">{event.summary || JSON.stringify(event.data || {})}</p>
                      </div>
                    )) : <p className="text-sm text-slate-500">No recent events for this agent.</p>}
                  </div>
                </div>
              </div>
            </ConsolePanel>
          </div>
        ) : null}

        {data && activeTab === "traces" ? (
          <ConsolePanel
            title="Trace Timeline and Logs"
            eyebrow="Langfuse / Phoenix style"
            action={<button type="button" onClick={exportTraces} className="rounded-full border border-white/10 bg-white/[0.055] px-4 py-2 text-xs font-semibold text-slate-200">Export traces</button>}
          >
            <div className="mb-4 grid gap-2 md:grid-cols-[1fr_180px]">
              <label className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                <span className="sr-only">Search traces</span>
                <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search user, session, model, status..." className="w-full bg-transparent text-sm text-white outline-none placeholder:text-slate-600" />
              </label>
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="rounded-2xl border border-white/10 bg-[#0B111C] px-4 py-3 text-sm text-slate-200 outline-none">
                <option value="all">All statuses</option>
                <option value="success">Success</option>
                <option value="needs_review">Needs review</option>
                <option value="error">Error only</option>
                <option value="slow">Latency high</option>
              </select>
            </div>
            <div className="space-y-3">
              {filteredTraces.length ? filteredTraces.slice(0, 80).map((trace) => (
                <article key={trace.id} className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-white">{trace.name} <span className="text-slate-500">/ {trace.trace_type}</span></p>
                      <p className="mt-1 truncate text-xs text-slate-500">{trace.turn_id || trace.session_id || "No turn id"} - {trace.model || trace.provider || "local tool"}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <StatusPill value={trace.status || "unknown"} />
                      <StatusPill value={`${trace.latency_ms}ms`} tone={trace.latency_ms >= 7000 ? "red" : "blue"} />
                    </div>
                  </div>
                  <div className="mt-4 grid gap-2 text-[11px] text-slate-400 md:grid-cols-7">
                    {["user query", "intent", "retrieval", "source check", "model call", "validation", "final answer"].map((step, index) => (
                      <div key={step} className={cn("rounded-xl border px-2 py-2", index <= 4 ? "border-cyan-300/15 bg-cyan-300/[0.08]" : "border-white/10 bg-black/20")}>{step}</div>
                    ))}
                  </div>
                </article>
              )) : <p className="rounded-2xl border border-white/10 bg-white/[0.035] p-5 text-sm text-slate-500">No traces match the current filters.</p>}
            </div>
          </ConsolePanel>
        ) : null}

        {data && activeTab === "students" ? (
          <ConsolePanel title="Student and Session Management" eyebrow="Safe founder actions">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead className="text-xs uppercase tracking-[0.14em] text-slate-500">
                  <tr>
                    <th className="px-3 py-3">Student</th>
                    <th className="px-3 py-3">XP</th>
                    <th className="px-3 py-3">Accuracy</th>
                    <th className="px-3 py-3">Questions</th>
                    <th className="px-3 py-3">Focus</th>
                    <th className="px-3 py-3">Last active</th>
                    <th className="px-3 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {data.students.map((student) => (
                    <tr key={student.user_id} className="border-t border-white/10">
                      <td className="px-3 py-4 font-semibold text-white">{student.user_id.slice(0, 18)}...</td>
                      <td className="px-3 py-4 text-slate-300">{student.xp} - L{student.level}</td>
                      <td className="px-3 py-4 text-emerald-200">{student.accuracy}%</td>
                      <td className="px-3 py-4 text-slate-300">{student.total_questions}</td>
                      <td className="px-3 py-4 text-slate-300">{student.focus_score}</td>
                      <td className="px-3 py-4 text-slate-500">{student.last_active_date || "unknown"}</td>
                      <td className="px-3 py-4">
                        <div className="flex flex-wrap gap-2">
                          <button type="button" onClick={() => { exportJson(`student-${student.user_id}.json`, student); void audit("export_student_report", { user_id: student.user_id }, "user", student.user_id); }} className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-slate-200">Export</button>
                          <button type="button" onClick={() => { invalidateApiCache(student.user_id); void audit("clear_temporary_cache", { user_id: student.user_id }, "user", student.user_id); }} className="rounded-full border border-cyan-300/20 px-3 py-1.5 text-xs text-cyan-100">Clear cache</button>
                          <button type="button" disabled title="Backend disable-user endpoint not implemented yet" className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-slate-600">Disable user</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </ConsolePanel>
        ) : null}

        {data && activeTab === "content" ? (
          <ConsolePanel title="Content and RAG Index" eyebrow="Study material brain" action={<button type="button" onClick={reindexContent} className="rounded-full border border-amber-300/25 bg-amber-300/10 px-4 py-2 text-xs font-semibold text-amber-100">Re-index material</button>}>
            <div className="grid gap-3 md:grid-cols-3">
              <MetricCard label="Total chapters" metric={{ value: data.content.chapters_total, source: "content_chapters" }} tone="teal" />
              <MetricCard label="Approved/published" metric={{ value: data.content.approved_or_published, source: "content_chapters" }} tone="green" />
              <MetricCard label="Average coverage" metric={{ value: data.content.coverage_score_avg === null ? null : Math.round(data.content.coverage_score_avg * 100), source: "content_chapters", unit: "%" }} tone="gold" />
            </div>
            <div className="mt-5 grid gap-5 lg:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
                <p className="text-sm font-semibold text-white">Chapter status</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {Object.entries(data.content.status_counts).length ? Object.entries(data.content.status_counts).map(([statusName, count]) => (
                    <StatusPill key={statusName} value={`${statusName}: ${count}`} />
                  )) : <p className="text-sm text-slate-500">No content indexed yet.</p>}
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
                <p className="text-sm font-semibold text-white">Recent ingestion jobs</p>
                <div className="mt-3 space-y-2">
                  {data.content.recent_jobs.length ? data.content.recent_jobs.map((job) => (
                    <div key={job.job_id} className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/20 px-3 py-2">
                      <span className="truncate text-xs text-slate-300">{job.job_type}</span>
                      <StatusPill value={job.status} />
                    </div>
                  )) : <p className="text-sm text-slate-500">No ingestion jobs yet.</p>}
                </div>
              </div>
            </div>
          </ConsolePanel>
        ) : null}

        {data && activeTab === "system" ? (
          <ConsolePanel title="System Health" eyebrow="Backend, auth, RAG, cost">
            <div className="grid gap-3 lg:grid-cols-2">
              {data.system.services.map((service) => (
                <div key={service.name} className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold text-white">{service.name}</p>
                    <StatusPill value={service.status} />
                  </div>
                </div>
              ))}
            </div>
            <pre className="mt-5 max-h-[360px] overflow-auto rounded-2xl border border-white/10 bg-black/30 p-4 text-xs leading-5 text-slate-400">
              {JSON.stringify({ event_bus: data.system.event_bus, observability: data.system.observability }, null, 2)}
            </pre>
          </ConsolePanel>
        ) : null}

        {data && activeTab === "audit" ? (
          <ConsolePanel title="Admin Audit Trail" eyebrow="Founder actions">
            <div className="space-y-2">
              {data.audit.length ? data.audit.map((row) => (
                <div key={row.id} className="grid gap-3 rounded-2xl border border-white/10 bg-white/[0.035] p-4 md:grid-cols-[180px_1fr_140px] md:items-center">
                  <div className="text-xs text-slate-500">{formatTime(row.created_at)}</div>
                  <div>
                    <p className="text-sm font-semibold text-white">{row.action}</p>
                    <p className="mt-1 text-xs text-slate-500">{row.actor_email || row.actor_uid} - {row.target_type} {row.target_id}</p>
                  </div>
                  <StatusPill value={row.status || "recorded"} />
                </div>
              )) : <p className="rounded-2xl border border-white/10 bg-white/[0.035] p-5 text-sm text-slate-500">No audit events recorded yet.</p>}
            </div>
          </ConsolePanel>
        ) : null}
      </div>
    </div>
  );
}
