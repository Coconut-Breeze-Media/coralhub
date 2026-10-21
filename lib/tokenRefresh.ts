/**
 * Coalesces refresh-token exchanges.
 *
 * BuddyPress/JWT setups that rotate refresh tokens reject a second use of the
 * token that was just consumed. Concurrent callers (and any caller still holding
 * the pre-rotation token) must share one request and then follow the chain to
 * the newest pair instead of sending the dead token again.
 */
export type RefreshResult = {
  token: string;
  refresh_token?: string;
};

/** Login, validate, and refresh calls must not trigger another refresh. */
export function isRefreshExemptPath(url: string): boolean {
  return (
    url.includes('/jwt-auth/v1/token') ||
    url.includes('/coral-auth/v1/login') ||
    url.includes('/coral-auth/v1/token/refresh') ||
    url.includes('/token/validate')
  );
}

/**
 * Bearer to retry with after a response, or null to keep the original response.
 * Retries once, and only when the refreshed access token is actually different.
 */
export function replacementBearer(
  status: number,
  requestBearer: string | null,
  url: string,
  refreshedBearer: string | null
): string | null {
  if (status !== 401 || !requestBearer || isRefreshExemptPath(url)) return null;
  if (!refreshedBearer || refreshedBearer === requestBearer) return null;
  return refreshedBearer;
}

export function createTokenRefreshCoordinator<T extends RefreshResult>(
  perform: (refreshToken: string) => Promise<T>
) {
  let inFlight: { key: string; promise: Promise<T> } | null = null;
  const chain = new Map<string, T>();

  function latest(refreshToken: string): T | null {
    let cursor = refreshToken;
    let found: T | null = null;
    const seen = new Set<string>();

    while (!seen.has(cursor) && chain.has(cursor)) {
      seen.add(cursor);
      const next = chain.get(cursor)!;
      found = next;
      const rotated = next.refresh_token;
      if (!rotated || rotated === cursor) break;
      cursor = rotated;
    }

    return found;
  }

  return {
    refresh(refreshToken: string): Promise<T> {
      const cached = latest(refreshToken);
      if (cached) return Promise.resolve(cached);
      if (inFlight?.key === refreshToken) return inFlight.promise;

      const promise = perform(refreshToken).then((result) => {
        chain.set(refreshToken, result);
        while (chain.size > 8) {
          const oldest = chain.keys().next().value;
          if (oldest == null) break;
          chain.delete(oldest);
        }
        return result;
      });

      inFlight = { key: refreshToken, promise };
      // Attach the cleanup on its own so a rejected refresh still clears the
      // in-flight slot without producing a second unhandled rejection.
      void promise.then(
        () => {
          if (inFlight?.promise === promise) inFlight = null;
        },
        () => {
          if (inFlight?.promise === promise) inFlight = null;
        }
      );
      return promise;
    },
  };
}
