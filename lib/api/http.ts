/**
 * http.ts
 * -----------------------------------------------------------------------------
 * Purpose
 *  - Thin, consistent HTTP utilities for the API layer.
 *  - Compose timeout + caller AbortSignal.
 *  - Normalize errors into ApiError with friendly messages and request context.
 *  - Provide small helpers (getJson/getText) and optional GET retries.
 *
 * Key exports
 *  - ApiError: Error with .status (HTTP status) and optional .url/.method.
 *  - assertOk(res): throws ApiError if !res.ok (parses json/text for message).
 *  - fetchWithTimeout(input, init?, timeoutMs?): Promise<Response>
 *      Composes a timeout AbortController with a caller-provided signal.
 *  - getJson<T>(input, init?): Promise<T>
 *  - getText(input, init?): Promise<string>
 *  - isAbortError(err): boolean
 *  - fetchRetryGet(input, init?): Promise<Response>
 *      GET-only small retry with backoff on 429/503/network/timeout.
 * -----------------------------------------------------------------------------
 */

export class ApiError extends Error {
  status: number;
  url?: string;
  method?: string;

  constructor(message: string, status: number, ctx?: { url?: string; method?: string }) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.url = ctx?.url;
    this.method = ctx?.method;
  }
}

function stripHtml(raw: string): string {
  return raw?.replace?.(/<[^>]+>/g, '').trim?.() ?? '';
}

function trimMsg(s: string, max = 600) {
  return s.length > max ? s.slice(0, max) + '…' : s;
}

/** Type guard for AbortError (timeout or caller abort) */
export function isAbortError(e: unknown): boolean {
  return !!e && (e as any).name === 'AbortError';
}

export type FetchWithTimeoutInit = RequestInit & {
  /** Abort and reject after this many ms (default 15000) */
  timeoutMs?: number;
};

/**
 * Compose a timeout-based AbortController with a caller-provided signal.
 * If caller signal aborts or the timeout fires, the request is aborted.
 */
export function fetchWithTimeout(
  input: RequestInfo | URL,
  init: FetchWithTimeoutInit = {}
) {
  const { timeoutMs = 15000, signal: callerSignal, ...rest } = init;

  // Controller we actually pass to fetch()
  const ctrl = new AbortController();

  // Bridge caller abort → our controller
  const abortFromCaller = () => ctrl.abort();
  if (callerSignal) {
    if (callerSignal.aborted) {
      ctrl.abort();
    } else {
      callerSignal.addEventListener('abort', abortFromCaller, { once: true });
    }
  }

  // Timeout → abort
  const timeoutId = setTimeout(() => ctrl.abort(), timeoutMs);

  // Do the fetch with the composed signal
  return fetch(input, { ...rest, signal: ctrl.signal })
    .finally(() => {
      clearTimeout(timeoutId);
      if (callerSignal) callerSignal.removeEventListener('abort', abortFromCaller as any);
    });
}

/**
 * Throws ApiError on non-2xx responses. Extracts a friendly message from body.
 */
export async function assertOk(res: Response, ctx?: { url?: string; method?: string }) {
  if (res.ok) return res;

  const copy = res.clone();
  let msg = `HTTP ${res.status}`;

  try {
    const data = await copy.json();
    const raw = data?.message ?? data?.error ?? JSON.stringify(data);
    msg = stripHtml(String(raw));
  } catch {
    try {
      const text = await copy.text();
      msg = stripHtml(String(text));
    } catch {
      /* ignore */
    }
  }

  throw new ApiError(trimMsg(msg), res.status, ctx);
}

/** Small helpers so callers don’t repeat boilerplate */
export async function getJson<T = any>(
  input: RequestInfo | URL,
  init: FetchWithTimeoutInit = {}
): Promise<T> {
  const method = (init.method ?? 'GET').toUpperCase();
  const url = typeof input === 'string' ? input : (input as URL).toString();
  const res = await fetchWithTimeout(input, init);
  await assertOk(res, { url, method });
  return res.json() as Promise<T>;
}

export async function getText(
  input: RequestInfo | URL,
  init: FetchWithTimeoutInit = {}
): Promise<string> {
  const method = (init.method ?? 'GET').toUpperCase();
  const url = typeof input === 'string' ? input : (input as URL).toString();
  const res = await fetchWithTimeout(input, init);
  await assertOk(res, { url, method });
  return res.text();
}

/**
 * GET-only retry helper with exponential backoff.
 * Retries on:
 *  - network failures (including AbortError from timeout)
 *  - 429 Too Many Requests (respects Retry-After if present)
 *  - 503 Service Unavailable
 *
 * Not intended for POST/PUT/DELETE (side-effects).
 */
export async function fetchRetryGet(
  input: RequestInfo | URL,
  init: FetchWithTimeoutInit = {}
): Promise<Response> {
  const method = (init.method ?? 'GET').toUpperCase();
  if (method !== 'GET') {
    // fall back to single call for non-GET
    return fetchWithTimeout(input, init);
  }

  const url = typeof input === 'string' ? input : (input as URL).toString();
  const maxAttempts = 3;
  let attempt = 0;
  let lastErr: any;

  while (attempt < maxAttempts) {
    attempt++;
    try {
      const res = await fetchWithTimeout(input, init);
      if (res.ok) return res;

      // 429/503 → optional retry
      if (res.status === 429 || res.status === 503) {
        const retryAfter = res.headers.get('retry-after');
        let waitMs = 0;
        if (retryAfter) {
          const n = Number(retryAfter);
          waitMs = Number.isFinite(n) ? n * 1000 : 0;
        }
        if (!waitMs) {
          // basic backoff: 300ms, 900ms, 2100ms
          waitMs = 300 * attempt * (attempt - 0.5);
        }
        if (attempt < maxAttempts) {
          await new Promise(r => setTimeout(r, waitMs));
          continue;
        }
      }

      await assertOk(res, { url, method }); // will throw ApiError
      return res; // unreachable
    } catch (e) {
      lastErr = e;
      // retry network errors/timeouts; stop for caller-aborted
      if (isAbortError(e) && init.signal && (init.signal as AbortSignal).aborted) {
        throw e; // caller explicitly aborted
      }
      if (attempt < maxAttempts) {
        const backoff = 250 * attempt * attempt; // 250, 1000
        await new Promise(r => setTimeout(r, backoff));
        continue;
      }
      throw e;
    }
  }

  throw lastErr;
}