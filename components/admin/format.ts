// Formatting + status helpers and shared theme-aware class strings for the admin console.
// All colors resolve through CSS variables / fixed brand tokens so light and dark
// mode both render with correct contrast (see app/globals.css [data-theme]).

import type { HealthState } from "./types";

// ── Theme-aware surfaces (driven by --agentify-* vars that flip per [data-theme]) ──
export const PANEL =
  "rounded-[1.4rem] border border-[color:var(--agentify-border)] bg-[var(--agentify-card-bg)] shadow-[0_18px_58px_rgba(15,23,42,0.08)] backdrop-blur-xl";
export const SOFT_PANEL =
  "rounded-2xl border border-[color:var(--agentify-border)] bg-[color:var(--agentify-hover-bg)]";
export const TEXT = "text-[color:var(--agentify-primary-text)]";
export const MUTED = "text-[color:var(--agentify-muted-text)]";

// ── Brand tokens (fixed; legible on both themes) ──
export const BRAND_GRADIENT = "linear-gradient(90deg,#0E7490,#14B8A6,#F2B84B)";

export interface HealthStyle {
  dot: string;
  text: string;
  ring: string;
  chip: string;
}

export const HEALTH_STYLES: Record<HealthState, HealthStyle> = {
  healthy: {
    dot: "bg-[#14B8A6]",
    text: "text-[#0F8F82]",
    ring: "ring-[#14B8A6]/30",
    chip: "border-[#14B8A6]/25 bg-[#14B8A6]/10 text-[#0F8F82]",
  },
  warning: {
    dot: "bg-[#F2B84B]",
    text: "text-[#B7791F]",
    ring: "ring-[#F2B84B]/30",
    chip: "border-[#F2B84B]/30 bg-[#F2B84B]/12 text-[#B7791F]",
  },
  error: {
    dot: "bg-[#F43F5E]",
    text: "text-[#D94A57]",
    ring: "ring-[#F43F5E]/30",
    chip: "border-[#F43F5E]/25 bg-[#F43F5E]/10 text-[#D94A57]",
  },
  unknown: {
    dot: "bg-slate-400",
    text: "text-slate-500",
    ring: "ring-slate-400/20",
    chip: "border-slate-400/25 bg-slate-400/10 text-slate-500",
  },
};

const HEALTHY_WORDS = ["ready", "online", "healthy", "success", "configured", "running", "live", "ok", "approved", "published"];
const WARNING_WORDS = ["degraded", "waiting", "warning", "needs", "pending", "checking", "review", "queued", "syncing"];
const ERROR_WORDS = ["error", "failed", "fail", "critical", "missing", "not_configured", "offline", "down", "unavailable"];

export function classifyHealth(value: boolean | string | null | undefined): HealthState {
  if (value === true) return "healthy";
  if (value === false) return "error";
  if (value === null || value === undefined) return "unknown";
  const normalized = String(value).toLowerCase().trim();
  if (!normalized || normalized === "unknown") return "unknown";
  if (ERROR_WORDS.some((word) => normalized.includes(word))) return "error";
  if (WARNING_WORDS.some((word) => normalized.includes(word))) return "warning";
  if (HEALTHY_WORDS.some((word) => normalized.includes(word))) return "healthy";
  return "unknown";
}

export function humanize(value: string): string {
  return String(value || "").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function isTracked(value: number | string | null | undefined): boolean {
  return !(value === null || value === undefined || value === "");
}

export function formatCompact(value?: number | string | null): string {
  if (value === null || value === undefined || value === "" || Number.isNaN(Number(value))) return "--";
  const numeric = Number(value);
  if (Math.abs(numeric) >= 1_000_000) return `${(numeric / 1_000_000).toFixed(1)}M`;
  if (Math.abs(numeric) >= 1_000) return `${(numeric / 1_000).toFixed(1)}K`;
  return Intl.NumberFormat().format(Math.round(numeric));
}

export function formatPercent(value?: number | null): string {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "--";
  const numeric = Number(value);
  return `${numeric <= 1 ? Math.round(numeric * 100) : Math.round(numeric)}%`;
}

export function formatCost(value?: number | null): string {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "$0";
  const numeric = Number(value);
  return `$${numeric.toFixed(numeric >= 1 ? 2 : 5)}`;
}

export function clampPercent(value?: number | null): number {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return 0;
  const normalized = Number(value) <= 1 ? Number(value) * 100 : Number(value);
  return Math.max(0, Math.min(100, normalized));
}

export function formatTime(value?: string | null): string {
  if (!value) return "Unknown";
  const time = new Date(value);
  if (!Number.isFinite(time.getTime())) return "Unknown";
  return time.toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function relativeTime(value?: string | null): string {
  if (!value) return "—";
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return "—";
  const diff = Date.now() - time;
  if (diff < 0) return "just now";
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
