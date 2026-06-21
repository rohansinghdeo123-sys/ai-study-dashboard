import { cn } from "@/lib/utils";
import { MUTED, PANEL, TEXT, isTracked } from "./format";
import type { ConsoleMetric } from "./types";

function formatMetric(metric?: ConsoleMetric): string {
  if (!metric || !isTracked(metric.value)) return "Not tracked";
  const value = metric.value;
  if (typeof value === "number") {
    if (metric.unit?.includes("usd")) return `$${value.toFixed(4)}`;
    if (metric.unit?.includes("%")) return `${value}%`;
    if (metric.unit?.includes("ms")) return value >= 1000 ? `${(value / 1000).toFixed(1)}s` : `${Math.round(value)}ms`;
    if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
    if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  }
  return String(value);
}

// A single metric. The `notTracked` state is first-class so the console never
// fakes a number for a metric the backend has not instrumented.
export function MetricCard({
  label,
  metric,
  value,
  source,
  note,
  accent,
}: {
  label: string;
  metric?: ConsoleMetric;
  value?: string;
  source?: string;
  note?: string;
  accent?: boolean;
}) {
  const display = value ?? formatMetric(metric);
  const notTracked = value === undefined && (!metric || !isTracked(metric.value));
  const sourceLabel = source ?? metric?.source;
  const noteLabel = note ?? metric?.note ?? metric?.unit;

  return (
    <article className={cn(PANEL, "min-h-[112px] p-4", accent && !notTracked && "ring-1 ring-[#14B8A6]/25")}>
      <div className="flex items-start justify-between gap-3">
        <p className={cn("max-w-[11rem] text-xs font-semibold", MUTED)}>{label}</p>
        {sourceLabel ? (
          <span className="shrink-0 rounded-full border border-[color:var(--agentify-border)] px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-[color:var(--agentify-muted-text)]">
            {sourceLabel}
          </span>
        ) : null}
      </div>
      <p className={cn("mt-4 text-[1.7rem] font-semibold leading-none tracking-tight", notTracked ? "text-slate-400" : TEXT)}>
        {display}
      </p>
      {notTracked ? (
        <p className="mt-2 text-[11px] leading-4 text-slate-400">Not instrumented in the backend yet.</p>
      ) : (
        <p className={cn("mt-2 line-clamp-2 text-[11px] leading-4", MUTED)}>{noteLabel || "Live backend metric"}</p>
      )}
    </article>
  );
}
