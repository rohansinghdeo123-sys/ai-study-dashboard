"use client";

import { useAuth } from "@/context/AuthContext";
import { apiFetch, apiJson } from "@/lib/apiClient";
import { cn } from "@/lib/utils";
import { AppIcon, ErrorState } from "@/components/ui/Polished";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { AdminSection } from "@/components/admin/AdminSection";
import { AdminStatusCard } from "@/components/admin/AdminStatusCard";
import { ActivityTimeline } from "@/components/admin/ActivityTimeline";
import { DataIngestionReport } from "@/components/admin/DataIngestionReport";
import { HealthBadge, HealthDot } from "@/components/admin/HealthBadge";
import { MetricCard } from "@/components/admin/MetricCard";
import { PipelineReadinessCard } from "@/components/admin/PipelineReadinessCard";
import {
  BRAND_GRADIENT,
  MUTED,
  PANEL,
  SOFT_PANEL,
  TEXT,
  classifyHealth,
  formatCompact,
  formatPercent,
  formatTime,
  humanize,
  relativeTime,
} from "@/components/admin/format";
import type { AdminConsolePayload, ConsoleTab, ContentReport, HealthState } from "@/components/admin/types";

const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL || "http://127.0.0.1:8000";
const REFRESH_MS = 15000;

const TABS: Array<{ id: ConsoleTab; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "operations", label: "Operations" },
  { id: "activity", label: "Activity" },
];

const USAGE_METRICS: Array<{ key: string; label: string }> = [
  { key: "total_users", label: "Total users" },
  { key: "active_students_today", label: "Active today" },
  { key: "active_sessions", label: "Active sessions" },
  { key: "questions_asked", label: "Questions asked" },
  { key: "mcqs_attempted", label: "MCQs attempted" },
  { key: "exam_generations", label: "Exam generations" },
  { key: "average_accuracy", label: "Average accuracy" },
  { key: "api_llm_usage", label: "API / LLM usage" },
];

const QUALITY_SIGNALS: Array<{ key: keyof AdminConsolePayload["quality"]; label: string }> = [
  { key: "hallucination_risk", label: "Hallucination risk" },
  { key: "missing_sources", label: "Missing sources" },
  { key: "failed_mcq_generation", label: "Failed MCQ generation" },
  { key: "empty_retrieval", label: "Empty retrieval" },
  { key: "slow_responses", label: "Slow responses" },
  { key: "fallback_used", label: "Fallback used" },
];

function parseEnvList(value?: string) {
  return (value || "").split(",").map((item) => item.trim().toLowerCase()).filter(Boolean);
}

function founderEmails() {
  return parseEnvList(process.env.NEXT_PUBLIC_FOUNDER_ADMIN_EMAILS || process.env.NEXT_PUBLIC_ADMIN_EMAILS);
}

function worstState(states: HealthState[]): HealthState {
  if (states.includes("error")) return "error";
  if (states.includes("warning")) return "warning";
  if (states.every((state) => state === "unknown")) return "unknown";
  return "healthy";
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

function ActionButton({ children, onClick, tone = "ghost" }: { children: React.ReactNode; onClick?: () => void; tone?: "ghost" | "gold" }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-semibold transition hover:-translate-y-0.5",
        tone === "gold"
          ? "border-[#F2B84B]/35 bg-[#F2B84B]/12 text-[#B7791F]"
          : "border-[color:var(--agentify-border)] bg-[color:var(--agentify-hover-bg)] text-[color:var(--agentify-primary-text)]",
      )}
    >
      {children}
    </button>
  );
}

function SkeletonBlock({ className }: { className?: string }) {
  return <div className={cn(PANEL, "animate-pulse", className)} />;
}

function AdminSkeleton() {
  return (
    <div className="space-y-6" aria-hidden="true">
      <SkeletonBlock className="h-32" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, index) => <SkeletonBlock key={index} className="h-28" />)}
      </div>
      <div className="grid gap-3 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => <SkeletonBlock key={index} className="h-44" />)}
      </div>
    </div>
  );
}

function UnauthorizedState({ email }: { email: string }) {
  return (
    <div className="flex min-h-[calc(100svh-8rem)] items-center justify-center p-4">
      <div className={cn(PANEL, "max-w-xl p-8 text-center")}>
        <HealthBadge state="error" label="Founder access only" />
        <h1 className={cn("mt-5 text-3xl font-semibold", TEXT)}>Admin Console is restricted</h1>
        <p className={cn("mt-3 text-sm leading-6", MUTED)}>
          Signed in as {email || "an unknown account"}. This console only opens for approved founder emails configured in environment.
        </p>
        <Link
          href="/dashboard"
          className="mt-6 inline-flex rounded-full border border-[color:var(--agentify-border)] bg-[color:var(--agentify-hover-bg)] px-5 py-3 text-sm font-semibold text-[color:var(--agentify-primary-text)] transition hover:-translate-y-0.5"
        >
          Return to dashboard
        </Link>
      </div>
    </div>
  );
}

function VerifyingState() {
  return (
    <div className="flex min-h-[60svh] items-center justify-center p-4">
      <div className={cn(PANEL, "flex items-center gap-3 px-6 py-5")}>
        <HealthDot state="warning" pulse />
        <div>
          <p className={cn("text-sm font-semibold", TEXT)}>Verifying founder session…</p>
          <p className={cn("text-xs", MUTED)}>Checking admin claims and the founder email allow-list.</p>
        </div>
      </div>
    </div>
  );
}

export default function FounderAdminConsolePage() {
  const { user, profile, isAdmin, loading, claimsLoading, getAuthHeaders } = useAuth();
  const [data, setData] = useState<AdminConsolePayload | null>(null);
  const [report, setReport] = useState<ContentReport | null>(null);
  const [activeTab, setActiveTab] = useState<ConsoleTab>("overview");
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const openedRef = useRef(false);

  const allowedEmails = useMemo(() => founderEmails(), []);
  const email = (profile?.email || user?.email || "").toLowerCase();
  const founderAllowed = Boolean(isAdmin && email && allowedEmails.includes(email));

  const adminGet = useCallback(async <T,>(path: string): Promise<T> => {
    const headers = await getAuthHeaders();
    return apiJson<T>(`${API_BASE}${path}`, { headers, forceFresh: true, retries: 1, timeoutMs: 12000 });
  }, [getAuthHeaders]);

  const audit = useCallback(async (action: string, metadata: Record<string, unknown> = {}, targetType = "console", targetId = "") => {
    if (!founderAllowed) return;
    try {
      const headers = await getAuthHeaders();
      await apiFetch(`${API_BASE}/admin/audit`, {
        method: "POST",
        headers,
        timeoutMs: 6000,
        body: JSON.stringify({ action, target_type: targetType, target_id: targetId, metadata: { route: "/dashboard/internal/admin", ...metadata } }),
      });
    } catch {
      // Audit failures must not block read-only visibility.
    }
  }, [founderAllowed, getAuthHeaders]);

  const loadConsole = useCallback(async () => {
    if (!founderAllowed) return;
    setRefreshing(true);
    try {
      const [payload, reportResult] = await Promise.allSettled([
        adminGet<AdminConsolePayload>("/admin/console"),
        adminGet<ContentReport>("/admin/content/ingestion-report"),
      ]);
      if (payload.status === "fulfilled") {
        setData(payload.value);
        setError("");
      } else {
        setError(payload.reason instanceof Error ? payload.reason.message : "Admin console could not load.");
      }
      // The detailed ingestion report is best-effort; it degrades gracefully.
      setReport(reportResult.status === "fulfilled" ? reportResult.value : null);
    } finally {
      setRefreshing(false);
    }
  }, [adminGet, founderAllowed]);

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

  const healthCards = useMemo(() => {
    const header = data?.header;
    const content = data?.content;
    const contentState: HealthState = !content
      ? "unknown"
      : Number(content.status_counts?.failed || 0) > 0
        ? "warning"
        : content.approved_or_published > 0
          ? "healthy"
          : content.chapters_total > 0
            ? "warning"
            : "unknown";
    return [
      { icon: "dashboard" as const, label: "Backend", state: classifyHealth(header?.backend_ready), valueLabel: header?.backend_ready ? "ready" : "degraded", detail: "API server & request handling" },
      { icon: "panelLeft" as const, label: "Database", state: classifyHealth(header?.database_status), valueLabel: header?.database_status, detail: "Primary datastore connection" },
      { icon: "check" as const, label: "Auth", state: classifyHealth(header?.auth_status), valueLabel: header?.auth_status, detail: "Firebase token verification" },
      { icon: "spark" as const, label: "LLM / Model", state: classifyHealth(header?.llm_status), valueLabel: header?.llm_status, detail: "Provider routing & generation" },
      { icon: "book" as const, label: "RAG / Knowledge", state: classifyHealth(header?.rag_status), valueLabel: header?.rag_status, detail: "Retrieval & grounding index" },
      { icon: "study" as const, label: "Content pipeline", state: contentState, valueLabel: contentState === "healthy" ? "live" : contentState, detail: "Ingestion, approval & publishing" },
    ];
  }, [data]);

  const overallState = useMemo(() => worstState(healthCards.map((card) => card.state)), [healthCards]);

  const alerts = useMemo(() => {
    if (!data) return [];
    const out: Array<{ label: string; detail: string; state: HealthState }> = [];
    const qualityRisk = QUALITY_SIGNALS.reduce((total, signal) => total + Number(data.quality[signal.key] || 0), 0);
    const failedMcq = Number(data.quality.failed_mcq_generation || 0);
    const failedJobs = Number(data.content.status_counts?.failed || 0);
    const unhealthyAgents = data.agents.filter((agent) => classifyHealth(`${agent.status} ${agent.health}`) === "error").length;
    const slowTraces = data.traces.filter((trace) => trace.latency_ms >= 7000).length;

    if (failedJobs > 0) out.push({ label: `${failedJobs} failed ingestion job${failedJobs === 1 ? "" : "s"}`, detail: "Review the content pipeline.", state: "error" });
    if (failedMcq > 0) out.push({ label: `${failedMcq} failed MCQ generation${failedMcq === 1 ? "" : "s"}`, detail: "Check grounding and retrieval.", state: "warning" });
    if (unhealthyAgents > 0) out.push({ label: `${unhealthyAgents} agent${unhealthyAgents === 1 ? "" : "s"} need attention`, detail: "Inspect the agent fleet.", state: "warning" });
    if (slowTraces > 0) out.push({ label: `${slowTraces} slow trace${slowTraces === 1 ? "" : "s"}`, detail: "Latency above 7s threshold.", state: "warning" });
    if (qualityRisk > 0 && !out.length) out.push({ label: `${qualityRisk} quality signal${qualityRisk === 1 ? "" : "s"} raised`, detail: "Review the quality surface.", state: "warning" });
    return out;
  }, [data]);

  const exportCurrentReport = () => {
    if (!data) return;
    exportJson(`agentify-admin-console-${Date.now()}.json`, { console: data, content_report: report });
    void audit("export_admin_console_report", {}, "report", "console");
  };

  const reindexContent = async () => {
    if (!window.confirm("Re-index study material from backend/data/raw/ncert? Run this only after PDFs are placed.")) return;
    await audit("confirm_reindex_material", {}, "content", "raw_ncert");
    try {
      const headers = await getAuthHeaders();
      await apiFetch(`${API_BASE}/admin/content/ingest-folder`, {
        method: "POST",
        headers,
        timeoutMs: 30000,
        body: JSON.stringify({ replace_existing_extraction: true }),
      });
      void loadConsole();
    } catch {
      await audit("reindex_material_failed", {}, "content", "raw_ncert");
    }
  };

  if (loading || claimsLoading) return <VerifyingState />;
  if (!founderAllowed) return <UnauthorizedState email={email} />;

  const header = data?.header;

  return (
    <div className="relative min-h-[100svh]">
      <div className="pointer-events-none fixed inset-0 -z-20 bg-[var(--agentify-page-bg)]" />
      <div
        className="pointer-events-none fixed inset-0 -z-10"
        style={{ background: "radial-gradient(circle at 10% -4%, rgba(20,184,166,0.12), transparent 34%), radial-gradient(circle at 92% 2%, rgba(242,184,75,0.12), transparent 30%)" }}
      />

      <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-6 px-3 pb-12 pt-4 sm:px-5 lg:px-6">
        {/* 1 · Command header */}
        <header className={cn(PANEL, "sticky top-3 z-20 p-5")}>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <HealthBadge state="warning" label="Founder only" />
                <span className={cn("text-xs", MUTED)}>Last synced {formatTime(header?.last_sync_time || data?.generated_at)}</span>
                {refreshing ? <span className={cn("text-xs", MUTED)}>· syncing…</span> : null}
              </div>
              <h1 className={cn("mt-3 text-2xl font-semibold tracking-tight sm:text-3xl", TEXT)}>AgentifyAI Admin Console</h1>
              <p className={cn("mt-1 max-w-3xl text-sm leading-6", MUTED)}>
                Founder command center for system health, content readiness, agent operations, quality signals, and audit history.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex h-9 items-center gap-2 rounded-full px-3.5 text-xs font-bold text-white shadow-sm" style={{ background: BRAND_GRADIENT }}>
                <HealthDot state={overallState} pulse={overallState === "healthy"} />
                {data ? humanize(header?.system_status || overallState) : "Syncing"}
              </span>
              <ActionButton onClick={() => { void audit("manual_console_refresh"); void loadConsole(); }}>
                <AppIcon name="history" /> {refreshing ? "Refreshing…" : "Refresh"}
              </ActionButton>
              <ActionButton tone="gold" onClick={exportCurrentReport}>
                <AppIcon name="download" /> Export
              </ActionButton>
            </div>
          </div>
        </header>

        {error ? <ErrorState title="Admin console error" detail={error} action={<ActionButton onClick={() => void loadConsole()}>Retry</ActionButton>} /> : null}

        {!data && !error ? <AdminSkeleton /> : null}

        {data ? (
          <>
            {/* 3 · Readiness hero */}
            <section className={cn(PANEL, "overflow-hidden p-5 sm:p-6")}>
              <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr] lg:items-center">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[color:var(--agentify-accent)]">System readiness</p>
                  <div className="mt-2 flex items-center gap-3">
                    <HealthDot state={overallState} pulse={overallState === "healthy"} />
                    <h2 className={cn("text-2xl font-semibold tracking-tight sm:text-3xl", TEXT)}>
                      {overallState === "healthy" ? "All systems operational" : overallState === "warning" ? "Operational with warnings" : overallState === "error" ? "Action required" : "Awaiting signals"}
                    </h2>
                  </div>
                  <p className={cn("mt-2 max-w-xl text-sm leading-6", MUTED)}>
                    {alerts.length
                      ? `${alerts.length} signal${alerts.length === 1 ? "" : "s"} need a founder's eyes. Critical items are highlighted on the right.`
                      : "No critical alerts. Backend, data pipeline, and agents are reporting cleanly."}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-3 text-xs">
                    <span className={cn(SOFT_PANEL, "px-3 py-1.5", MUTED)}>Env · {data.environment || "development"}</span>
                    <span className={cn(SOFT_PANEL, "px-3 py-1.5", MUTED)}>Last sync · {relativeTime(header?.last_sync_time || data.generated_at)}</span>
                    <span className={cn(SOFT_PANEL, "px-3 py-1.5", MUTED)}>Chapters live · {data.content.approved_or_published}</span>
                  </div>
                </div>
                <div className="space-y-2">
                  {alerts.length ? (
                    alerts.slice(0, 4).map((alert) => (
                      <div key={alert.label} className={cn(SOFT_PANEL, "flex items-start gap-3 p-3")}>
                        <span className="mt-0.5"><HealthDot state={alert.state} /></span>
                        <div className="min-w-0">
                          <p className={cn("text-sm font-semibold", TEXT)}>{alert.label}</p>
                          <p className={cn("text-xs", MUTED)}>{alert.detail}</p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className={cn(SOFT_PANEL, "flex items-center gap-3 p-4")}>
                      <HealthDot state="healthy" pulse />
                      <p className={cn("text-sm font-semibold", TEXT)}>No critical action needed.</p>
                    </div>
                  )}
                </div>
              </div>
            </section>

            {/* 2 · System health */}
            <AdminSection eyebrow="Live status" title="System health" description="Core services and their current state.">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
                {healthCards.map((card) => (
                  <AdminStatusCard key={card.label} icon={card.icon} label={card.label} state={card.state} valueLabel={card.valueLabel || undefined} detail={card.detail} />
                ))}
              </div>
            </AdminSection>

            {/* Tab switcher */}
            <nav className={cn("flex w-full max-w-md gap-1 rounded-full border border-[color:var(--agentify-border)] bg-[color:var(--agentify-hover-bg)] p-1")}>
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setTab(tab.id)}
                  className={cn(
                    "flex-1 rounded-full px-4 py-2 text-sm font-semibold transition",
                    activeTab === tab.id ? "text-white shadow-sm" : cn(MUTED, "hover:text-[color:var(--agentify-primary-text)]"),
                  )}
                  style={activeTab === tab.id ? { background: BRAND_GRADIENT } : undefined}
                >
                  {tab.label}
                </button>
              ))}
            </nav>

            {/* OVERVIEW */}
            {activeTab === "overview" ? (
              <div className="space-y-8">
                <AdminSection eyebrow="Usage" title="Students & usage snapshot" description="Live platform usage. Metrics the backend has not instrumented are shown honestly as not tracked.">
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {USAGE_METRICS.map((item) => (
                      <MetricCard key={item.key} label={item.label} metric={data.overview[item.key]} />
                    ))}
                  </div>
                </AdminSection>

                <AdminSection eyebrow="Quality & safety" title="Quality signals" description="Grounding, retrieval, and generation risk counters from live traces.">
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {QUALITY_SIGNALS.map((signal) => {
                      const value = Number(data.quality[signal.key] || 0);
                      const state: HealthState = value === 0 ? "healthy" : signal.key === "slow_responses" || signal.key === "fallback_used" ? "warning" : "error";
                      return (
                        <div key={signal.key} className={cn(PANEL, "flex items-center justify-between gap-3 p-4")}>
                          <div className="min-w-0">
                            <p className={cn("text-xs font-semibold", MUTED)}>{signal.label}</p>
                            <p className={cn("mt-1 text-2xl font-semibold", TEXT)}>{value}</p>
                          </div>
                          <HealthDot state={state} />
                        </div>
                      );
                    })}
                  </div>
                  {data.quality.avg_quality_score !== null ? (
                    <p className={cn("mt-1 text-xs", MUTED)}>Average answer quality score · {formatPercent(data.quality.avg_quality_score)}</p>
                  ) : null}
                </AdminSection>

                <AdminSection eyebrow="Cohort" title="Recently active students" description="Top active students by accuracy. Read-only snapshot.">
                  {data.students.length ? (
                    <div className="grid gap-2 lg:grid-cols-2">
                      {data.students.slice(0, 8).map((student) => (
                        <div key={student.user_id} className={cn(SOFT_PANEL, "flex items-center justify-between gap-3 p-3")}>
                          <div className="min-w-0">
                            <p className={cn("truncate text-sm font-semibold", TEXT)}>{student.display_name || "Student"}</p>
                            <p className={cn("truncate text-[11px]", MUTED)}>{student.class_level || "No class"} · L{student.level} · {formatCompact(student.xp)} XP</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-semibold text-[#0F8F82]">{student.accuracy}%</p>
                            <p className={cn("text-[11px]", MUTED)}>{student.last_active_date || "—"}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className={cn(PANEL, "p-5 text-sm", MUTED)}>No student activity recorded yet.</div>
                  )}
                </AdminSection>
              </div>
            ) : null}

            {/* OPERATIONS */}
            {activeTab === "operations" ? (
              <div className="space-y-8">
                <AdminSection
                  eyebrow="Knowledge"
                  title="Data & content pipeline"
                  description="What study data is ingested — subjects, chapters, topics — and the RAG memory powering retrieval."
                  action={<ActionButton tone="gold" onClick={reindexContent}><AppIcon name="plus" /> Re-index</ActionButton>}
                >
                  <div className="grid gap-3 xl:grid-cols-[0.85fr_1.15fr] xl:items-start">
                    <PipelineReadinessCard content={data.content} report={report} />
                    <DataIngestionReport report={report} />
                  </div>
                </AdminSection>

                <AdminSection eyebrow="AgentOps" title="Agent operations" description="Live agent fleet: status, recent activity, throughput, and errors.">
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {data.agents.length ? data.agents.map((agent) => {
                      const state = classifyHealth(`${agent.status} ${agent.health}`);
                      return (
                        <article key={agent.agent_id} className={cn(PANEL, "p-4")}>
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className={cn("truncate text-sm font-semibold", TEXT)}>{agent.display_name}</p>
                              <p className={cn("mt-0.5 line-clamp-2 text-[11px] leading-4", MUTED)}>{agent.role || agent.current_task || "No role reported."}</p>
                            </div>
                            <HealthBadge state={state} label={agent.health || "observing"} />
                          </div>
                          <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                            <div><p className={cn("text-[10px]", MUTED)}>Requests</p><p className={cn("text-sm font-semibold", TEXT)}>{formatCompact(agent.total_requests)}</p></div>
                            <div><p className={cn("text-[10px]", MUTED)}>Errors</p><p className={cn("text-sm font-semibold", agent.total_errors ? "text-[#D94A57]" : TEXT)}>{formatCompact(agent.total_errors)}</p></div>
                            <div><p className={cn("text-[10px]", MUTED)}>Success</p><p className="text-sm font-semibold text-[#0F8F82]">{formatPercent(agent.success_rate)}</p></div>
                          </div>
                          <p className={cn("mt-3 text-[11px]", MUTED)}>Last active {relativeTime(agent.last_activity)} · {Math.round(agent.avg_latency_ms || 0)}ms avg</p>
                        </article>
                      );
                    }) : <div className={cn(PANEL, "p-5 text-sm", MUTED)}>No agents are reporting yet.</div>}
                  </div>
                </AdminSection>

                {data.model_registry?.current ? (
                  <AdminSection eyebrow="Models" title="Live model" description="Current provider, model, and observed quality.">
                    <div className={cn(PANEL, "p-5")}>
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className={cn("text-sm font-semibold", TEXT)}>{data.model_registry.current.llm_provider || "provider"} / {data.model_registry.current.llm_model || "model"}</p>
                          <p className={cn("mt-0.5 text-xs", MUTED)}>RAG index {data.model_registry.current.rag_index_version || "—"} · embeddings {data.model_registry.current.embedding_model || "off"}</p>
                        </div>
                        <HealthBadge state="healthy" label="live" pulse />
                      </div>
                      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
                        <div className={cn(SOFT_PANEL, "px-3 py-2.5")}><p className={cn("text-[10px] font-bold uppercase tracking-[0.14em]", MUTED)}>Quality</p><p className={cn("mt-1 text-lg font-semibold", TEXT)}>{formatPercent(data.model_registry.current.quality_score)}</p></div>
                        <div className={cn(SOFT_PANEL, "px-3 py-2.5")}><p className={cn("text-[10px] font-bold uppercase tracking-[0.14em]", MUTED)}>Grounded</p><p className={cn("mt-1 text-lg font-semibold", TEXT)}>{formatPercent(data.model_registry.current.grounded_answer_rate)}</p></div>
                        <div className={cn(SOFT_PANEL, "px-3 py-2.5")}><p className={cn("text-[10px] font-bold uppercase tracking-[0.14em]", MUTED)}>Latency</p><p className={cn("mt-1 text-lg font-semibold", TEXT)}>{data.model_registry.current.latency_ms ? `${Math.round(data.model_registry.current.latency_ms)}ms` : "--"}</p></div>
                      </div>
                    </div>
                  </AdminSection>
                ) : null}
              </div>
            ) : null}

            {/* ACTIVITY */}
            {activeTab === "activity" ? (
              <div className="grid gap-8 xl:grid-cols-[1fr_0.9fr] xl:items-start">
                <AdminSection eyebrow="Audit" title="Activity timeline" description="Founder actions, content ingestion, and config changes.">
                  <div className={cn(PANEL, "p-5")}>
                    <ActivityTimeline rows={data.audit} />
                  </div>
                </AdminSection>
                <AdminSection eyebrow="Traces" title="Recent model traces" description="Latest model and tool calls with latency and status.">
                  <div className="space-y-2">
                    {data.traces.length ? data.traces.slice(0, 14).map((trace) => (
                      <div key={trace.id} className={cn(SOFT_PANEL, "flex items-center justify-between gap-3 p-3")}>
                        <div className="min-w-0">
                          <p className={cn("truncate text-sm font-semibold", TEXT)}>{trace.name}</p>
                          <p className={cn("truncate text-[11px]", MUTED)}>{trace.model || trace.provider || trace.trace_type} · {relativeTime(trace.created_at)}</p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <HealthBadge state={classifyHealth(trace.status)} label={trace.status} />
                          <span className={cn("text-[11px]", trace.latency_ms >= 7000 ? "text-[#D94A57]" : MUTED)}>{trace.latency_ms}ms</span>
                        </div>
                      </div>
                    )) : <div className={cn(PANEL, "p-5 text-sm", MUTED)}>No traces recorded yet.</div>}
                  </div>
                </AdminSection>
              </div>
            ) : null}
          </>
        ) : null}
      </div>
    </div>
  );
}
