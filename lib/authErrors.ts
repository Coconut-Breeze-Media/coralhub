/**
 * Failures that mean "we could not reach the server", not "the session is invalid".
 * A 401/403 is definitive. Timeouts, dropped connections, and 5xx are not.
 */
export function isTransientError(error: unknown): boolean {
  if (error instanceof TypeError) return true;
  if (error instanceof Error && (error.name === 'AbortError' || error.name === 'TimeoutError')) {
    return true;
  }

  if (error && typeof error === 'object' && 'status' in error) {
    const status = Number((error as { status: unknown }).status);
    if (Number.isFinite(status)) return status === 0 || status >= 500;
  }

  return false;
}
