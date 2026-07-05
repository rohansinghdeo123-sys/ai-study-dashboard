/** Generic display/parse helpers shared across dashboard pages. */

import { EMPTY_VALUE } from "@/lib/examConfig";

export function toNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function displayValue(value: unknown) {
  if (value === null || value === undefined || value === "") return EMPTY_VALUE;
  return String(value);
}

export function formatLabel(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (match) => match.toUpperCase());
}

export function getRecordEntries(
  record: Record<string, string | number> | Record<string, number> | undefined,
) {
  return Object.entries(record || {})
    .map(([key, value]) => ({ key, value }))
    .sort((first, second) => toNumber(second.value) - toNumber(first.value));
}
