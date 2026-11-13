import type { ActivityLinkPreview } from '../types';

const cache = new Map<string, ActivityLinkPreview | null>();
const pending = new Map<string, Promise<ActivityLinkPreview | null>>();

function metaContent(html: string, key: string): string {
  const pattern = new RegExp(
    `<meta[^>]+(?:property|name)=["']${key}["'][^>]+content=["']([^"']+)["']|<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${key}["']`,
    'i'
  );
  const match = html.match(pattern);
  return (match?.[1] || match?.[2] || '').trim();
}

function resolveUrl(value: string, pageUrl: string): string {
  if (!value) return '';
  try {
    return new URL(value, pageUrl).toString();
  } catch {
    return value;
  }
}

/** Read Open Graph / Twitter card tags from an HTML document. */
export function parseOpenGraph(html: string, pageUrl: string): ActivityLinkPreview | null {
  const slice = html.slice(0, 200_000);
  const title =
    metaContent(slice, 'og:title') ||
    metaContent(slice, 'twitter:title') ||
    (slice.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1] || '').trim();
  const description =
    metaContent(slice, 'og:description') ||
    metaContent(slice, 'twitter:description') ||
    metaContent(slice, 'description');
  const image = resolveUrl(
    metaContent(slice, 'og:image:secure_url') ||
      metaContent(slice, 'og:image') ||
      metaContent(slice, 'twitter:image') ||
      metaContent(slice, 'twitter:image:src'),
    pageUrl
  );
  const siteName = metaContent(slice, 'og:site_name');
  if (!title && !description && !image) return null;
  return {
    url: pageUrl,
    title: title || undefined,
    description: description || undefined,
    image: image || undefined,
    site_name: siteName || undefined,
  };
}

/**
 * Fetch a page and read its preview when the activity payload has none.
 * Results are cached for the session. Failures resolve to null.
 */
export function fetchOpenGraphPreview(url: string): Promise<ActivityLinkPreview | null> {
  if (cache.has(url)) return Promise.resolve(cache.get(url) ?? null);
  const existing = pending.get(url);
  if (existing) return existing;

  const request = (async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: { Accept: 'text/html' },
      });
      if (!response.ok) {
        cache.set(url, null);
        return null;
      }
      const html = await response.text();
      const preview = parseOpenGraph(html, url);
      cache.set(url, preview);
      return preview;
    } catch {
      cache.set(url, null);
      return null;
    } finally {
      clearTimeout(timer);
      pending.delete(url);
    }
  })();

  pending.set(url, request);
  return request;
}
