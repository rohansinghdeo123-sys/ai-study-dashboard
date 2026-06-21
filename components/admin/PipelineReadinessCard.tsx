import { cn } from "@/lib/utils";
import { HealthBadge } from "./HealthBadge";
import { MUTED, PANEL, TEXT, classifyHealth, clampPercent, formatCompact, formatPercent } from "./format";
import type { AdminConsolePayload, ContentReport } from "./types";

function Stat({ label, value, tone }: { label: string; value: string; tone?: "teal" | "gold" | "rose" | "slate" }) {
  const color =
    tone === "teal" ? "text-[#0F8F82]" : tone === "gold" ? "text-[#B7791F]" : tone === "rose" ? "text-[#D94A57]" : TEXT;
  return (
    <div className="rounded-xl border border-[color:var(--agentify-border)] bg-[color:var(--agentify-hover-bg)] px-3 py-2.5">
      <p className={cn("text-[10px] font-bold uppercase tracking-[0.14em]", MUTED)}>{label}</p>
      <p className={cn("mt-1 text-lg font-semibold", color)}>{value}</p>
    </div>
  );
}

function Meter({ label, percent, detail, tone = "#14B8A6" }: { label: string; percent: number; detail?: string; tone?: string }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-3 text-xs">
        <span className={cn("font-semibold", TEXT)}>{label}</span>
        <span className={MUTED}>{Math.round(percent)}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-[color:var(--agentify-border)]">
        <div className="h-full rounded-full" style={{ width: `${percent}%`, background: tone }} />
      </div>
      {detail ? <p className={cn("text-[11px]", MUTED)}>{detail}</p> : null}
    </div>
  );
}

// At-a-glance content + RAG-memory readiness. Prefers the detailed ingestion
// report when available, falling back to the console content summary.
export function PipelineReadinessCard({
  content,
  report,
}: {
  content: AdminConsolePayload["content"];
  report?: ContentReport | null;
}) {
  const chapters = report?.totals.chapters ?? content.chapters_total;
  const approved = report
    ? report.chapters.filter((c) => c.is_live).length
    : content.approved_or_published;
  const concepts = report?.totals.concepts ?? null;
  const chunks = report?.totals.chunks ?? null;
  const embedded = report?.totals.embedded_chunks ?? null;
  const coverage = content.coverage_score_avg;

  const statusCounts = content.status_counts || {};
  const pending = Object.entries(statusCounts)
    .filter(([name]) => /review|validated|indexed|uploaded|json/.test(name))
    .reduce((total, [, count]) => total + Number(count || 0), 0);
  const failed = Number(statusCounts.failed || 0);

  const ragState = classifyHealth(
    embedded === null ? null : embedded > 0 ? "healthy" : chunks && chunks > 0 ? "warning" : "unknown",
  );
  const embedPercent = chunks && chunks > 0 ? ((embedded || 0) / chunks) * 100 : 0;

  return (
    <div className={cn(PANEL, "p-5")}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className={cn("text-sm font-semibold", TEXT)}>Knowledge base readiness</p>
          <p className={cn("mt-0.5 text-xs", MUTED)}>
            {approved} live · {chapters} total chapters
          </p>
        </div>
        <HealthBadge state={ragState} label={ragState === "healthy" ? "RAG live" : ragState === "warning" ? "Not indexed" : "RAG"} pulse={ragState === "healthy"} />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="Live chapters" value={formatCompact(approved)} tone="teal" />
        <Stat label="Pending" value={formatCompact(pending)} tone="gold" />
        <Stat label="Concepts" value={concepts === null ? "—" : formatCompact(concepts)} />
        <Stat label="Failed jobs" value={formatCompact(failed)} tone={failed ? "rose" : "slate"} />
      </div>

      <div className="mt-5 space-y-4">
        {coverage !== null && coverage !== undefined ? (
          <Meter
            label="Average coverage"
            percent={clampPercent(coverage)}
            detail="Share of extracted pages referenced by approved concepts."
            tone="#0E7490"
          />
        ) : null}
        {chunks !== null ? (
          <Meter
            label="RAG memory embedded"
            percent={clampPercent(embedPercent)}
            detail={`${formatCompact(embedded)} of ${formatCompact(chunks)} chunks vectorized${report?.embeddings_model ? ` · ${report.embeddings_model}` : ""}`}
            tone="#14B8A6"
          />
        ) : null}
      </div>
      {report && !report.embeddings_enabled ? (
        <p className="mt-4 rounded-xl border border-[#F2B84B]/30 bg-[#F2B84B]/10 px-3 py-2 text-[11px] text-[#B7791F]">
          Semantic retrieval is disabled (lexical-only). Set EMBEDDINGS_API_KEY and embed chunks to enable it.
        </p>
      ) : null}
      <p className={cn("mt-3 text-[11px]", MUTED)}>
        {formatPercent(coverage)} avg coverage · embeddings {report ? (report.embeddings_enabled ? "on" : "off") : "—"}
      </p>
    </div>
  );
}
