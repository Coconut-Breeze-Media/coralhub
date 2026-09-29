/** Helpers shared by the News Feed and group post composers. */

const BARE_URL_PATTERN = /(^|[\s(\[])(www\.[^\s<>"'`\])}]+)/gi;
const TRAILING_URL_PUNCTUATION = /[.,;:!?)}\]]+$/;

/**
 * Turns a browser-style URL such as `www.nature.com` into a safe absolute
 * HTTPS URL. Explicit http(s) URLs are kept as entered; other schemes are not
 * valid post links.
 */
export function normalizeExternalUrl(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const candidate = /^www\./i.test(trimmed) ? `https://${trimmed}` : trimmed;

  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

/** Normalize bare www. URLs written directly in the post text before saving. */
export function normalizeBareUrlsInText(value: string): string {
  return value.replace(BARE_URL_PATTERN, (match, prefix: string, rawUrl: string) => {
    const trailing = rawUrl.match(TRAILING_URL_PUNCTUATION)?.[0] ?? '';
    const normalized = normalizeExternalUrl(rawUrl.slice(0, rawUrl.length - trailing.length));
    return normalized ? `${prefix}${normalized}${trailing}` : match;
  });
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/** Create safe, normalized markup for the optional link composer field. */
export function postLinkMarkup(url: string): string {
  const escapedUrl = escapeHtml(url);
  return `<a href="${escapedUrl}" target="_blank" rel="noopener noreferrer">${escapedUrl}</a>`;
}
