export function formatExamDate(value: string | null | undefined) {
  if (!value) return "Not available";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not available";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

export function formatExamDateTime(value: string | null | undefined) {
  if (!value) return "Not available";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not available";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export function formatExamFileSize(bytes: number | null | undefined) {
  const value = Number(bytes || 0);
  if (!Number.isFinite(value) || value <= 0) return "Size unavailable";
  if (value < 1024 * 1024) return `${Math.max(1, Math.round(value / 1024))} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatExamMarks(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "--";
  return Number.isInteger(Number(value)) ? String(Number(value)) : Number(value).toFixed(1);
}

export function formatExamConfidence(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "--";
  const numeric = Number(value);
  return `${Math.round(numeric <= 1 ? numeric * 100 : numeric)}%`;
}

export function formatExamLabel(value: string | null | undefined) {
  const text = String(value || "").trim();
  if (!text) return "Not specified";
  return text
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function toMetricEntries(data: Record<string, string | number> | null | undefined) {
  return Object.entries(data || {})
    .map(([label, value]) => ({ label: formatExamLabel(label), value }))
    .filter((entry) => String(entry.value).trim() !== "")
    .slice(0, 8);
}

export function paperStatusCopy(status: string) {
  if (status === "analyzed") return "Ready";
  if (status === "analyzed_empty") return "Review needed";
  if (status === "needs_ocr") return "OCR needed";
  if (status === "failed") return "Could not read";
  return formatExamLabel(status || "Processing");
}
