"use client";

import { useAuth } from "@/context/AuthContext";
import { apiFetch, apiJson, ensureBackendReady } from "@/lib/apiClient";
import { cn } from "@/lib/utils";
import { AppIcon, ErrorState } from "@/components/ui/Polished";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { AdminSection } from "@/components/admin/AdminSection";
import { ActivityTimeline } from "@/components/admin/ActivityTimeline";
import { AgentPipeline } from "@/components/admin/AgentPipeline";
import { DataIngestionReport } from "@/components/admin/DataIngestionReport";
import { HealthBadge, HealthDot } from "@/components/admin/HealthBadge";
import {
  BRAND_GRADIENT,
  HEALTH_STYLES,
  MUTED,
  PANEL,
  SOFT_PANEL,
  TEXT,
  classifyHealth,
  formatBytes,
  formatCompact,
  formatPercent,
  formatTime,
  humanize,
  relativeTime,
} from "@/components/admin/format";
import type { AdminConsolePayload, ConsoleMetric, ConsoleTab, ContentReport, HealthState } from "@/components/admin/types";

const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL || "http://127.0.0.1:8000";
const REFRESH_MS = 15000;
const NUM = "font-mono tabular-nums";

const TABS: Array<{ id: ConsoleTab; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "operations", label: "Operations" },
  { id: "activity", label: "Activity" },
];

const USAGE_METRICS: Array<{ key: string; label: string }> = [
  { key: "total_users", label: "Users" },
  { key: "active_students_today", label: "Active today" },
  { key: "active_sessions", label: "Sessions" },
  { key: "questions_asked", label: "Questions" },
  { key: "mcqs_attempted", label: "MCQs" },
  { key: "exam_generations", label: "Exam gen" },
  { key: "average_accuracy", label: "Avg accuracy" },
  { key: "api_llm_usage", label: "LLM calls" },
];

const QUALITY_SIGNALS: Array<{ key: keyof AdminConsolePayload["quality"]; label: string }> = [
  { key: "hallucination_risk", label: "Hallucination" },
  { key: "missing_sources", label: "Missing src" },
  { key: "failed_mcq_generation", label: "MCQ fails" },
  { key: "empty_retrieval", label: "Empty retr." },
  { key: "slow_responses", label: "Slow resp." },
  { key: "fallback_used", label: "Fallbacks" },
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
  if (states.every((s) => s === "unknown")) return "unknown";
  return "healthy";
}
function isTransientError(error: unknown): boolean {
  const name = (error as { name?: string })?.name || "";
  const message = (error instanceof Error ? error.message : String(error || "")).toLowerCase();
  return name === "AbortError" || /abort|timed out|timeout|failed to fetch|load failed|network ?error|fetch failed|502|503|504/.test(message);
}
function metricValue(metric?: ConsoleMetric): { value: string; tracked: boolean } {
  if (!metric || metric.value === null || metric.value === undefined || metric.value === "") return { value: "—", tracked: false };
  const v = metric.value;
  if (typeof v === "number") {
    if (metric.unit?.includes("usd")) return { value: `$${v.toFixed(2)}`, tracked: true };
    if (metric.unit?.includes("%")) return { value: `${v}%`, tracked: true };
    if (metric.unit?.includes("ms")) return { value: v >= 1000 ? `${(v / 1000).toFixed(1)}s` : `${Math.round(v)}ms`, tracked: true };
    return { value: formatCompact(v), tracked: true };
  }
  return { value: String(v), tracked: true };
}
function exportJson(filename: string, payload: unknown) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function ActionButton({ children, onClick, tone = "ghost" }: { children: React.ReactNode; onClick?: () => void; tone?: "ghost" | "gold" }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition hover:-translate-y-0.5",
        tone === "gold"
          ? "border-[#F2B84B]/35 bg-[#F2B84B]/12 text-[#B7791F]"
          : "border-[color:var(--agentify-border)] bg-[color:var(--agentify-hover-bg)] text-[color:var(--agentify-primary-text)]",
      )}
    >
      {children}
    </button>
  );
}

function KpiCell({ label, value, sub, tone, dim }: { label: string; value: string; sub?: string; tone?: string; dim?: boolean }) {
  return (
    <div className="rounded-lg border border-[color:var(--agentify-border)] bg-[color:var(--agentify-hover-bg)] px-2.5 py-2">
      <p className={cn("text-[9px] font-bold uppercase tracking-[0.14em]", MUTED)}>{label}</p>
      <p className={cn("mt-0.5 text-base font-semibold", NUM, dim ? "text-slate-400" : tone || TEXT)}>{value}</p>
      {sub ? <p className={cn("text-[9px]", MUTED)}>{sub}</p> : null}
    </div>
  );
}

function SkeletonBlock({ className }: { className?: string }) {
  return <div className={cn(PANEL, "animate-pulse", className)} />;
}
function AdminSkeleton() {
  return (
    <div className="space-y-4" aria-hidden="true">
      <SkeletonBlock className="h-24" />
      <div className="grid gap-2 sm:grid-cols-4 xl:grid-cols-8">
        {Array.from({ length: 8 }).map((_, i) => <SkeletonBlock key={i} className="h-16" />)}
      </div>
      <SkeletonBlock className="h-64" />
    </div>
  );
}

function UnauthorizedState({ email }: { email: string }) {
  return (
    <div className="flex min-h-[calc(100svh-8rem)] items-center justify-center p-4">
      <div className={cn(PANEL, "max-w-xl p-8 text-center")}>
        <HealthBadge state="error" label="Founder access only" />
        <h1 className={cn("mt-5 text-2xl font-semibold", TEXT)}>Admin Console is restricted</h1>
        <p className={cn("mt-3 text-sm leading-6", MUTED)}>Signed in as {email || "an unknown account"}. This console only opens for approved founder emails.</p>
        <Link href="/dashboard" className="mt-6 inline-flex rounded-lg border border-[color:var(--agentify-border)] bg-[color:var(--agentify-hover-bg)] px-5 py-2.5 text-sm font-semibold text-[color:var(--agentify-primary-text)] transition hover:-translate-y-0.5">Return to dashboard</Link>
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
          <p className={cn("text-xs", MUTED)}>Checking admin claims and the founder allow-list.</p>
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
  const [waking, setWaking] = useState(false);
  const [detail, setDetail] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const openedRef = useRef(false);

  const allowedEmails = useMemo(() => founderEmails(), []);
  const email = (profile?.email || user?.email || "").toLowerCase();
  const founderAllowed = Boolean(isAdmin && email && allowedEmails.includes(email));

  const adminGet = useCallback(async <T,>(path: string): Promise<T> => {
    const headers = await getAuthHeaders();
    return apiJson<T>(`${API_BASE}${path}`, { headers, forceFresh: true, retries: 2, timeoutMs: 22000 });
  }, [getAuthHeaders]);

  const audit = useCallback(async (action: string, metadata: Record<string, unknown> = {}, targetType = "console", targetId = "") => {
    if (!founderAllowed) return;
    try {
      const headers = await getAuthHeaders();
      await apiFetch(`${API_BASE}/admin/audit`, { method: "POST", headers, timeoutMs: 6000, body: JSON.stringify({ action, target_type: targetType, target_id: targetId, metadata: { route: "/dashboard/internal/admin", ...metadata } }) });
    } catch { /* audit must not block visibility */ }
  }, [founderAllowed, getAuthHeaders]);

  const loadConsole = useCallback(async () => {
    if (!founderAllowed) return;
    setRefreshing(true);
    try {
      try { await ensureBackendReady(API_BASE, { timeoutMs: 55000 }); } catch { /* still attempt */ }
      const payload = await adminGet<AdminConsolePayload>("/admin/console");
      setData(payload);
      setError("");
      setWaking(false);
      try { setReport(await adminGet<ContentReport>("/admin/content/ingestion-report")); } catch { setReport(null); }
    } catch (caught) {
      const name = (caught as { name?: string })?.name || "Error";
      const status = (caught as { status?: number })?.status;
      setDetail(`${name}${status ? ` ${status}` : ""}: ${caught instanceof Error ? caught.message : String(caught)}`);
      if (isTransientError(caught)) { setWaking(true); setError(""); }
      else { setWaking(false); setError(caught instanceof Error ? caught.message : "Admin console could not load."); }
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

  const setTab = (tab: ConsoleTab) => { setActiveTab(tab); void audit("switch_admin_console_tab", { tab }, "tab", tab); };

  const healthCards = useMemo(() => {
    const h = data?.header;
    const c = data?.content;
    const contentState: HealthState = !c ? "unknown" : Number(c.status_counts?.failed || 0) > 0 ? "warning" : c.approved_or_published > 0 ? "healthy" : c.chapters_total > 0 ? "warning" : "unknown";
    return [
      { label: "Backend", state: classifyHealth(h?.backend_ready), value: h?.backend_ready ? "ready" : "degraded" },
      { label: "Database", state: classifyHealth(h?.database_status), value: h?.database_status },
      { label: "Auth", state: classifyHealth(h?.auth_status), value: h?.auth_status },
      { label: "LLM", state: classifyHealth(h?.llm_status), value: h?.llm_status },
      { label: "RAG", state: classifyHealth(h?.rag_status), value: h?.rag_status },
      { label: "Content", state: contentState, value: contentState === "healthy" ? "live" : contentState },
    ];
  }, [data]);
  const overallState = useMemo(() => worstState(healthCards.map((c) => c.state)), [healthCards]);

  const alerts = useMemo(() => {
    if (!data) return [];
    const out: Array<{ label: string; state: HealthState }> = [];
    const failedJobs = Number(data.content.status_counts?.failed || 0);
    const failedMcq = Number(data.quality.failed_mcq_generation || 0);
    const unhealthyAgents = data.agents.filter((a) => classifyHealth(`${a.status} ${a.health}`) === "error").length;
    const slow = data.traces.filter((t) => t.latency_ms >= 7000).length;
    if (failedJobs) out.push({ label: `${failedJobs} failed job${failedJobs === 1 ? "" : "s"}`, state: "error" });
    if (failedMcq) out.push({ label: `${failedMcq} MCQ fail${failedMcq === 1 ? "" : "s"}`, state: "warning" });
    if (unhealthyAgents) out.push({ label: `${unhealthyAgents} agent alert${unhealthyAgents === 1 ? "" : "s"}`, state: "warning" });
    if (slow) out.push({ label: `${slow} slow trace${slow === 1 ? "" : "s"}`, state: "warning" });
    return out;
  }, [data]);

  const exportReport = () => { if (!data) return; exportJson(`agentify-admin-${Date.now()}.json`, { console: data, content_report: report }); void audit("export_admin_console_report", {}, "report", "console"); };

  if (loading || claimsLoading) return <VerifyingState />;
  if (!founderAllowed) return <UnauthorizedState email={email} />;

  const header = data?.header;
  const totalMemory = report?.totals.memory_bytes ?? null;

  return (
    <div className="relative min-h-[100svh]">
      <div className="pointer-events-none fixed inset-0 -z-20 bg-[var(--agentify-page-bg)]" />
      <div className="pointer-events-none fixed inset-0 -z-10" style={{ background: "radial-gradient(circle at 10% -4%, rgba(20,184,166,0.10), transparent 32%), radial-gradient(circle at 92% 2%, rgba(242,184,75,0.10), transparent 28%)" }} />

      <div className="flex w-full flex-col gap-3 px-3 pb-12 pt-3 sm:px-5 lg:px-6">
        {/* Header */}
        <header className={cn(PANEL, "sticky top-2 z-20 p-3.5")}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <HealthBadge state="warning" label="Founder only" />
                <span className={cn("text-[11px]", MUTED)}>Synced {formatTime(header?.last_sync_time || data?.generated_at)}{refreshing ? " · syncing…" : ""}</span>
              </div>
              <h1 className={cn("mt-1.5 text-xl font-semibold tracking-tight sm:text-2xl", TEXT)}>AgentifyAI Admin Console</h1>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-bold text-white" style={{ background: BRAND_GRADIENT }}>
                <HealthDot state={overallState} pulse={overallState === "healthy"} />
                {data ? humanize(header?.system_status || overallState) : "Syncing"}
              </span>
              <ActionButton onClick={() => { void audit("manual_console_refresh"); void loadConsole(); }}><AppIcon name="history" /> {refreshing ? "…" : "Refresh"}</ActionButton>
              <ActionButton tone="gold" onClick={exportReport}><AppIcon name="download" /> Export</ActionButton>
            </div>
          </div>
        </header>

        {error && !data ? <ErrorState title="Admin console error" detail={error} action={<ActionButton onClick={() => void loadConsole()}>Retry</ActionButton>} /> : null}

        {!data && !error ? (
          <div className="space-y-3">
            {waking ? (
              <div className={cn(PANEL, "flex items-start gap-3 p-3.5")}>
                <span className="mt-0.5"><HealthDot state="warning" pulse /></span>
                <div className="min-w-0">
                  <p className={cn("text-sm font-semibold", TEXT)}>Connecting to the backend…</p>
                  <p className={cn("mt-1 truncate text-[11px]", MUTED)}>Calling <span className="font-mono">{API_BASE}/admin/console</span>{detail ? <> · <span className="text-[#D94A57]">{detail}</span></> : null}</p>
                </div>
              </div>
            ) : null}
            <AdminSkeleton />
          </div>
        ) : null}

        {data ? (
          <>
            {/* Status + system health strip */}
            <section className={cn(PANEL, "p-3")}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <HealthDot state={overallState} pulse={overallState === "healthy"} />
                  <span className={cn("text-sm font-semibold", TEXT)}>
                    {overallState === "healthy" ? "All systems operational" : overallState === "warning" ? "Operational · warnings" : overallState === "error" ? "Action required" : "Awaiting signals"}
                  </span>
                  <span className={cn(SOFT_PANEL, "px-2 py-0.5 text-[10px]", MUTED)}>env {data.environment || "dev"}</span>
                  <span className={cn(SOFT_PANEL, "px-2 py-0.5 text-[10px]", MUTED, NUM)}>{data.content.approved_or_published} chapters live</span>
                  {totalMemory !== null ? <span className={cn(SOFT_PANEL, "px-2 py-0.5 text-[10px]", MUTED, NUM)}>{formatBytes(totalMemory)} memory</span> : null}
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {alerts.length ? alerts.map((a) => (
                    <span key={a.label} className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold", HEALTH_STYLES[a.state].chip)}>
                      <HealthDot state={a.state} /> {a.label}
                    </span>
                  )) : <span className="inline-flex items-center gap-1 text-[11px] text-[#0F8F82]"><HealthDot state="healthy" /> No critical alerts</span>}
                </div>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-6">
                {healthCards.map((c) => (
                  <div key={c.label} className={cn(SOFT_PANEL, "px-2.5 py-2")}>
                    <div className="flex items-center justify-between gap-2">
                      <span className={cn("text-[10px] font-bold uppercase tracking-[0.12em]", MUTED)}>{c.label}</span>
                      <HealthDot state={c.state} pulse={c.state === "healthy"} />
                    </div>
                    <p className={cn("mt-1 truncate text-xs font-semibold", HEALTH_STYLES[c.state].text)}>{humanize(c.value || c.state)}</p>
                  </div>
                ))}
              </div>
            </section>

            {/* Tabs */}
            <nav className="flex w-full max-w-sm gap-1 rounded-lg border border-[color:var(--agentify-border)] bg-[color:var(--agentify-hover-bg)] p-1">
              {TABS.map((tab) => (
                <button key={tab.id} type="button" onClick={() => setTab(tab.id)}
                  className={cn("flex-1 rounded-md px-3 py-1.5 text-xs font-semibold transition", activeTab === tab.id ? "text-white" : cn(MUTED, "hover:text-[color:var(--agentify-primary-text)]"))}
                  style={activeTab === tab.id ? { background: BRAND_GRADIENT } : undefined}>
                  {tab.label}
                </button>
              ))}
            </nav>

            {/* OVERVIEW */}
            {activeTab === "overview" ? (
              <div className="space-y-5">
                <AdminSection eyebrow="Usage" title="Platform usage" description="Live metrics. Counters the backend has not instrumented show as “—”.">
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-8">
                    {USAGE_METRICS.map((m) => { const v = metricValue(data.overview[m.key]); return <KpiCell key={m.key} label={m.label} value={v.value} dim={!v.tracked} sub={data.overview[m.key]?.source} />; })}
                  </div>
                </AdminSection>

                <AdminSection eyebrow="Quality & safety" title="Risk signals" description="Grounding, retrieval, and generation risk counters from live traces.">
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                    {QUALITY_SIGNALS.map((s) => { const v = Number(data.quality[s.key] || 0); const tone = v === 0 ? "text-[#0F8F82]" : s.key === "slow_responses" || s.key === "fallback_used" ? "text-[#B7791F]" : "text-[#D94A57]"; return <KpiCell key={s.key} label={s.label} value={String(v)} tone={tone} />; })}
                  </div>
                  {data.quality.avg_quality_score !== null ? <p className={cn("mt-2 text-[11px]", MUTED)}>Avg answer quality · {formatPercent(data.quality.avg_quality_score)}</p> : null}
                </AdminSection>

                <AdminSection eyebrow="Cohort" title="Active students" description="Top students by accuracy. Read-only.">
                  {data.students.length ? (
                    <div className={cn(PANEL, "overflow-x-auto p-0")}>
                      <table className="w-full min-w-[560px] border-collapse text-left text-xs">
                        <thead><tr className={cn("text-[9px] font-bold uppercase tracking-[0.12em]", MUTED)}>
                          <th className="px-3 py-2">Student</th><th className="px-3 py-2">Class</th><th className="px-3 py-2 text-right">XP</th><th className="px-3 py-2 text-right">Accuracy</th><th className="px-3 py-2 text-right">Questions</th><th className="px-3 py-2 text-right">Focus</th><th className="px-3 py-2">Last active</th>
                        </tr></thead>
                        <tbody>
                          {data.students.slice(0, 12).map((s) => (
                            <tr key={s.user_id} className="border-t border-[color:var(--agentify-border)] hover:bg-[color:var(--agentify-active-bg)]">
                              <td className={cn("px-3 py-2 font-medium", TEXT)}>{s.display_name || "Student"}</td>
                              <td className={cn("px-3 py-2", MUTED)}>{s.class_level || "—"}</td>
                              <td className={cn("px-3 py-2 text-right", NUM, MUTED)}>{formatCompact(s.xp)}·L{s.level}</td>
                              <td className={cn("px-3 py-2 text-right", NUM, "text-[#0F8F82]")}>{s.accuracy}%</td>
                              <td className={cn("px-3 py-2 text-right", NUM, MUTED)}>{formatCompact(s.total_questions)}</td>
                              <td className={cn("px-3 py-2 text-right", NUM, MUTED)}>{s.focus_score}</td>
                              <td className={cn("px-3 py-2", MUTED)}>{s.last_active_date || "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : <div className={cn(PANEL, "p-4 text-sm", MUTED)}>No student activity yet.</div>}
                </AdminSection>
              </div>
            ) : null}

            {/* OPERATIONS */}
            {activeTab === "operations" ? (
              <div className="space-y-5">
                <AdminSection eyebrow="Knowledge" title="Data & content pipeline" description="Ingested study data by subject, chapter, and subtopic — with memory size, tokens, and error rate.">
                  <DataIngestionReport report={report} />
                </AdminSection>

                <AdminSection eyebrow="AgentOps" title="Agent pipelines" description="Each agent as its real processing flow, with live throughput, errors, and latency.">
                  {data.agents.length ? (
                    <div className="grid gap-2.5 md:grid-cols-2 xl:grid-cols-3">
                      {data.agents.map((a) => <AgentPipeline key={a.agent_id} agent={a} />)}
                    </div>
                  ) : <div className={cn(PANEL, "p-4 text-sm", MUTED)}>No agents are reporting yet.</div>}
                </AdminSection>

                {data.model_registry?.current ? (
                  <AdminSection eyebrow="Models" title="Live model">
                    <div className={cn(PANEL, "flex flex-wrap items-center justify-between gap-3 p-4")}>
                      <div className="min-w-0">
                        <p className={cn("text-sm font-semibold", TEXT)}>{data.model_registry.current.llm_provider || "provider"} / {data.model_registry.current.llm_model || "model"}</p>
                        <p className={cn("mt-0.5 text-[11px]", MUTED)}>RAG {data.model_registry.current.rag_index_version || "—"} · embeddings {data.model_registry.current.embedding_model || "off"}</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <KpiCell label="Quality" value={formatPercent(data.model_registry.current.quality_score)} />
                        <KpiCell label="Grounded" value={formatPercent(data.model_registry.current.grounded_answer_rate)} />
                        <KpiCell label="Latency" value={data.model_registry.current.latency_ms ? `${Math.round(data.model_registry.current.latency_ms)}ms` : "—"} />
                      </div>
                    </div>
                  </AdminSection>
                ) : null}
              </div>
            ) : null}

            {/* ACTIVITY */}
            {activeTab === "activity" ? (
              <div className="grid gap-5 xl:grid-cols-[1fr_0.9fr] xl:items-start">
                <AdminSection eyebrow="Audit" title="Activity timeline" description="Founder actions, ingestion, and config changes.">
                  <div className={cn(PANEL, "p-4")}><ActivityTimeline rows={data.audit} /></div>
                </AdminSection>
                <AdminSection eyebrow="Traces" title="Recent model traces" description="Latest model and tool calls.">
                  <div className="space-y-1.5">
                    {data.traces.length ? data.traces.slice(0, 16).map((t) => (
                      <div key={t.id} className={cn(SOFT_PANEL, "flex items-center justify-between gap-3 px-3 py-2")}>
                        <div className="min-w-0">
                          <p className={cn("truncate text-xs font-semibold", TEXT)}>{t.name}</p>
                          <p className={cn("truncate text-[10px]", MUTED)}>{t.model || t.provider || t.trace_type} · {relativeTime(t.created_at)}</p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <HealthBadge state={classifyHealth(t.status)} label={t.status} />
                          <span className={cn("text-[10px]", NUM, t.latency_ms >= 7000 ? "text-[#D94A57]" : MUTED)}>{t.latency_ms}ms</span>
                        </div>
                      </div>
                    )) : <div className={cn(PANEL, "p-4 text-sm", MUTED)}>No traces recorded yet.</div>}
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
