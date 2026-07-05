// Client for the backend spaced-repetition queue (GET /revision/queue/{user_id}).
// Shared by Mission (revision radar) and, later, Progress.

import { apiFetch } from "@/lib/apiClient";

export type RevisionBucket = "overdue" | "due" | "strengthen" | "fresh";

export interface RevisionEntry {
  topic: string;
  bucket: RevisionBucket;
  priority: number;
  retention_estimate: number;
  days_since_practiced: number;
  accuracy: number;
  attempts: number;
  weak: boolean;
  declining: boolean;
  suggested_mode: string;
  suggested_minutes: number;
  reason: string;
}

export interface RevisionQueueResponse {
  user_id: string;
  generated_at: string;
  summary: {
    overdue: number;
    due: number;
    strengthen: number;
    fresh: number;
    top_pick: RevisionEntry | null;
    message: string;
  };
  queue: RevisionEntry[];
}

export const BUCKET_LABELS: Record<RevisionBucket, string> = {
  overdue: "Overdue",
  due: "Due",
  strengthen: "Strengthen",
  fresh: "Fresh",
};

// chip classes per bucket, on the light glass surfaces used across the app
export const BUCKET_CHIPS: Record<RevisionBucket, string> = {
  overdue: "border-[#F43F5E]/30 bg-[#F43F5E]/10 text-[#D94A57]",
  due: "border-[#F2B84B]/40 bg-[#F2B84B]/12 text-[#B7791F]",
  strengthen: "border-[#0E7490]/25 bg-[#0E7490]/10 text-[#0E7490]",
  fresh: "border-slate-300 bg-slate-100 text-slate-500",
};

export async function fetchRevisionQueue(
  backendURL: string,
  userId: string,
  headers: HeadersInit,
  limit = 5,
): Promise<RevisionQueueResponse | null> {
  try {
    const res = await apiFetch(`${backendURL}/revision/queue/${userId}?limit=${limit}`, {
      headers,
      retries: 0,
      timeoutMs: 12000,
    });
    if (!res.ok) return null;
    return (await res.json()) as RevisionQueueResponse;
  } catch {
    return null; // the radar is additive — never block the page on it
  }
}
