export class ApiError extends Error {
    status: number;
    constructor(message: string, status: number) {
      super(message);
      this.name = 'ApiError';
      this.status = status;
    }
  }
  
  function stripHtml(raw: string): string {
    return raw?.replace?.(/<[^>]+>/g, '').trim?.() ?? '';
  }
  
  export async function assertOk(res: Response) {
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
      } catch {}
    }
    throw new ApiError(msg, res.status);
  }
  
  export function fetchWithTimeout(
    input: RequestInfo | URL,
    init?: RequestInit,
    ms = 15000
  ) {
    const ctrl = new AbortController();
    const id = setTimeout(() => ctrl.abort(), ms);
    return fetch(input, { ...init, signal: ctrl.signal })
      .finally(() => clearTimeout(id));
  }