import { cn } from "@/lib/utils";
import { AppIcon, type AppIconName } from "@/components/ui/Polished";
import { HealthDot } from "./HealthBadge";
import { HEALTH_STYLES, MUTED, PANEL, TEXT, humanize } from "./format";
import type { HealthState } from "./types";

// A single system-health card: icon, label, color-coded state, and microcopy.
export function AdminStatusCard({
  icon,
  label,
  state,
  detail,
  valueLabel,
}: {
  icon: AppIconName;
  label: string;
  state: HealthState;
  detail?: string;
  valueLabel?: string;
}) {
  const style = HEALTH_STYLES[state];
  return (
    <article className={cn(PANEL, "p-4")}>
      <div className="flex items-center justify-between gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-[color:var(--agentify-border)] bg-[color:var(--agentify-hover-bg)] text-[color:var(--agentify-accent)]">
          <AppIcon name={icon} />
        </span>
        <HealthDot state={state} pulse={state === "healthy"} />
      </div>
      <p className={cn("mt-3 text-sm font-semibold", TEXT)}>{label}</p>
      <p className={cn("mt-0.5 text-xs font-bold uppercase tracking-[0.12em]", style.text)}>
        {valueLabel ? humanize(valueLabel) : humanize(state)}
      </p>
      {detail ? <p className={cn("mt-2 line-clamp-2 text-[11px] leading-4", MUTED)}>{detail}</p> : null}
    </article>
  );
}
