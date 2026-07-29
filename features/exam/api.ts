import { ApiRequestError, apiFetch, apiJson, invalidateApiCache } from "@/lib/apiClient";

export type ExamAuthHeaders = () => Promise<HeadersInit>;

export type ExamApiRequestOptions = {
  method?: string;
  body?: unknown;
  headers?: HeadersInit;
  getAuthHeaders?: ExamAuthHeaders;
  backendURL?: string;
  signal?: AbortSignal;
  timeoutMs?: number;
  retries?: number;
  cacheKey?: string;
  cacheTtlMs?: number;
  forceFresh?: boolean;
  invalidate?: string | string[];
};

export type ExamApiUploadOptions = Omit<
  ExamApiRequestOptions,
  "method" | "body" | "cacheKey" | "cacheTtlMs" | "forceFresh"
>;

const DEFAULT_MUTATION_INVALIDATIONS = [
  "exam-",
  "/exam/",
  "written-",
  "weakness",
  "sessions:",
  "progress:",
  "leaderboard",
] as const;

export class ExamApiError extends Error {
  status: number;
  path: string;

  constructor(message: string, status: number, path: string) {
    super(message);
    this.name = "ExamApiError";
    this.status = status;
    this.path = path;
  }
}

function getBackendURL(override?: string) {
  return (override || process.env.NEXT_PUBLIC_BACKEND_URL || "http://127.0.0.1:8000").replace(/\/$/, "");
}

function getRequestURL(path: string, backendURL?: string) {
  if (/^https?:\/\//i.test(path)) return path;
  return `${getBackendURL(backendURL)}${path.startsWith("/") ? path : `/${path}`}`;
}

async function resolveHeaders(options: Pick<ExamApiRequestOptions, "headers" | "getAuthHeaders">) {
  const next = new Headers(options.getAuthHeaders ? await options.getAuthHeaders() : undefined);
  new Headers(options.headers).forEach((value, key) => next.set(key, value));
  return next;
}

function normalizeInvalidations(invalidate?: string | string[]) {
  if (!invalidate) return [];
  return Array.isArray(invalidate) ? invalidate : [invalidate];
}

export function invalidateExamCaches(invalidate?: string | string[]) {
  const keys = new Set<string>([
    ...DEFAULT_MUTATION_INVALIDATIONS,
    ...normalizeInvalidations(invalidate),
  ]);
  keys.forEach((key) => invalidateApiCache(key));
}

function toExamApiError(error: unknown, path: string) {
  if (error instanceof ExamApiError) return error;
  if (error instanceof ApiRequestError) return new ExamApiError(error.message, error.status, path);
  if (error instanceof Error) return error;
  return new ExamApiError("The Exam Lab request could not be completed.", 0, path);
}

export async function examApiRequest<T>(
  path: string,
  options: ExamApiRequestOptions = {},
): Promise<T> {
  const method = String(options.method || "GET").toUpperCase();
  const isRead = method === "GET" || method === "HEAD";
  const headers = await resolveHeaders(options);
  if (!isRead && options.body !== undefined && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  try {
    const data = await apiJson<T>(getRequestURL(path, options.backendURL), {
      method,
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: options.signal,
      retries: options.retries ?? (isRead ? 1 : 0),
      timeoutMs: options.timeoutMs ?? (isRead ? 18000 : 45000),
      cacheKey: options.cacheKey,
      cacheTtlMs: options.cacheTtlMs ?? (options.cacheKey ? 30000 : 0),
      forceFresh: isRead ? options.forceFresh : true,
    });

    if (!isRead) invalidateExamCaches(options.invalidate);
    return data;
  } catch (error) {
    throw toExamApiError(error, path);
  }
}

export async function examApiUpload<T>(
  path: string,
  formData: FormData,
  options: ExamApiUploadOptions = {},
): Promise<T> {
  const headers = await resolveHeaders(options);
  headers.delete("Content-Type");

  try {
    const response = await apiFetch(getRequestURL(path, options.backendURL), {
      method: "POST",
      headers,
      body: formData,
      signal: options.signal,
      retries: options.retries ?? 0,
      timeoutMs: options.timeoutMs ?? 60000,
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      const detail = data && typeof data === "object" && "detail" in data
        ? String((data as { detail?: unknown }).detail || "")
        : "";
      const retryAfter = response.headers.get("Retry-After");
      const retryHint = response.status === 429 && retryAfter ? ` Retry after ${retryAfter}s.` : "";
      throw new ExamApiError(detail || `Upload failed (${response.status}).${retryHint}`, response.status, path);
    }

    invalidateExamCaches(options.invalidate);
    return data as T;
  } catch (error) {
    throw toExamApiError(error, path);
  }
}
