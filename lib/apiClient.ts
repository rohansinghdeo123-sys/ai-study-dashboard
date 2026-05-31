export type BackendHealth = {
  status?: string;
  artifacts_ready?: boolean;
  artifact_sections?: string[];
};

type JsonRequestOptions = RequestInit & {
  cacheKey?: string;
  cacheTtlMs?: number;
  retries?: number;
  timeoutMs?: number;
};

type CacheEntry = {
  expiresAt: number;
  value: unknown;
};

const responseCache = new Map<string, CacheEntry>();
const inFlightJson = new Map<string, Promise<unknown>>();

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function getRequestKey(url: string, options: JsonRequestOptions) {
  if (options.cacheKey) return options.cacheKey;
  return `${options.method || "GET"}:${url}:${String(options.body || "")}`;
}

function shouldRetry(status: number) {
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

export class ApiRequestError extends Error {
  status: number;

  constructor(message: string, status = 0) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
  }
}

export async function apiFetch(
  url: string,
  options: RequestInit & { retries?: number; timeoutMs?: number } = {},
) {
  const { retries = 0, timeoutMs = 9000, signal, ...requestInit } = options;
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const abort = () => controller.abort();
    const timeout = window.setTimeout(abort, timeoutMs);
    signal?.addEventListener("abort", abort, { once: true });

    try {
      const response = await fetch(url, {
        ...requestInit,
        signal: controller.signal,
      });
      if (response.ok || attempt === retries || !shouldRetry(response.status)) {
        return response;
      }
      lastError = new ApiRequestError(`Request failed: ${response.status}`, response.status);
    } catch (error) {
      lastError = error;
      if ((error as Error).name === "AbortError" && signal?.aborted) throw error;
      if (attempt === retries) throw error;
    } finally {
      window.clearTimeout(timeout);
      signal?.removeEventListener("abort", abort);
    }

    await sleep(250 * (attempt + 1));
  }

  throw lastError instanceof Error ? lastError : new ApiRequestError("Request failed");
}

export async function apiJson<T>(url: string, options: JsonRequestOptions = {}): Promise<T> {
  const method = String(options.method || "GET").toUpperCase();
  const cacheTtlMs = options.cacheTtlMs ?? 0;
  const requestKey = getRequestKey(url, options);
  const cached = responseCache.get(requestKey);

  if (cached && cached.expiresAt > Date.now()) {
    return cached.value as T;
  }

  if (method === "GET" && inFlightJson.has(requestKey)) {
    return inFlightJson.get(requestKey) as Promise<T>;
  }

  const request = (async () => {
    const response = await apiFetch(url, options);
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      const detail =
        data && typeof data === "object" && "detail" in data
          ? String((data as { detail?: unknown }).detail || "")
          : "";
      throw new ApiRequestError(detail || `Request failed: ${response.status}`, response.status);
    }
    if (cacheTtlMs > 0) {
      responseCache.set(requestKey, {
        expiresAt: Date.now() + cacheTtlMs,
        value: data,
      });
    }
    return data as T;
  })();

  if (method === "GET") {
    inFlightJson.set(requestKey, request);
  }

  try {
    return await request;
  } finally {
    if (method === "GET") {
      inFlightJson.delete(requestKey);
    }
  }
}

export function invalidateApiCache(prefix?: string) {
  if (!prefix) {
    responseCache.clear();
    return;
  }

  for (const key of responseCache.keys()) {
    if (key.includes(prefix)) responseCache.delete(key);
  }
}

export async function warmBackend(backendURL: string) {
  return apiJson<BackendHealth>(`${backendURL}/health`, {
    cacheKey: `health:${backendURL}`,
    cacheTtlMs: 45000,
    retries: 1,
    timeoutMs: 4500,
  });
}
