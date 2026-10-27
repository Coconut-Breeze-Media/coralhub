// lib/siteSearch.ts
/**
 * Site-wide search for the "Search CoRR Hub" screen.
 *
 * Prefers GET /coral/v1/search (coral-social-api plugin), which runs the
 * website's own search query: pages, posts, custom post types and uploaded
 * documents in one relevance-ordered list, with PMPro lock state.
 *
 * Until that route is deployed (404), falls back to WordPress core:
 *   GET /wp/v2/search?type=post&subtype=any&_embed  (pages/posts/CPTs)
 *   GET /wp/v2/media?media_type=application          (PDFs and other files, page 1 only)
 * Core only covers post types registered with show_in_rest, so the fallback
 * can miss some website results.
 */
import { ApiError, authedFetch } from './api';
import { stripMessageHtml } from './messagePresentation';
import type { SiteSearchPage, SiteSearchResult } from '../types';

export const SITE_SEARCH_PAGE_SIZE = 20;

/** null = not probed yet; false = route missing, use the core fallback. */
let coralSearchAvailable: boolean | null = null;

type CoralSearchResponse = {
  results?: SiteSearchResult[];
  page?: number;
  total_pages?: number;
  total?: number;
};

type CoreSearchItem = {
  id?: number;
  title?: string;
  url?: string;
  type?: string;
  subtype?: string;
  _embedded?: {
    self?: Array<{
      excerpt?: { rendered?: string };
      date_gmt?: string;
      date?: string;
    }>;
  };
};

type CoreMediaItem = {
  id?: number;
  title?: { rendered?: string };
  caption?: { rendered?: string };
  description?: { rendered?: string };
  source_url?: string;
  link?: string;
  mime_type?: string;
  date_gmt?: string;
};

function plainText(value: unknown): string {
  return typeof value === 'string' ? stripMessageHtml(value) : '';
}

function truncate(value: string, max = 220): string {
  if (value.length <= max) return value;
  return `${value.slice(0, max).replace(/\s+\S*$/, '')}…`;
}

function labelForSubtype(subtype?: string): string {
  if (!subtype) return 'Page';
  if (subtype === 'page') return 'Page';
  if (subtype === 'post') return 'Post';
  const words = subtype.replace(/[-_]+/g, ' ').trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export function documentLabel(mime?: string): string {
  const value = (mime || '').toLowerCase();
  if (value === 'application/pdf') return 'PDF';
  if (value.includes('word') || value.includes('opendocument.text')) return 'Document';
  if (value.includes('sheet') || value.includes('excel')) return 'Spreadsheet';
  if (value.includes('presentation') || value.includes('powerpoint')) return 'Presentation';
  return 'File';
}

async function searchWithCoral(
  token: string,
  query: string,
  page: number
): Promise<SiteSearchPage> {
  const params = new URLSearchParams({
    q: query,
    page: String(page),
    per_page: String(SITE_SEARCH_PAGE_SIZE),
  });
  const data = await authedFetch<CoralSearchResponse>(`/coral/v1/search?${params}`, token);
  const results = Array.isArray(data?.results) ? data.results : [];
  return {
    results: results.map((item) => ({
      ...item,
      title: plainText(item.title) || 'Untitled',
      excerpt: plainText(item.excerpt),
    })),
    page,
    total_pages: Number(data?.total_pages) || 0,
    total: Number(data?.total) || undefined,
  };
}

async function searchWithCore(
  token: string,
  query: string,
  page: number
): Promise<SiteSearchPage> {
  const postParams = new URLSearchParams({
    search: query,
    type: 'post',
    subtype: 'any',
    per_page: String(SITE_SEARCH_PAGE_SIZE),
    page: String(page),
    _embed: 'self',
  });

  const postsPromise = authedFetch<CoreSearchItem[]>(`/wp/v2/search?${postParams}`, token).catch(
    (error: unknown) => {
      // WordPress answers 400 for a page past the end.
      if (error instanceof ApiError && error.status === 400 && page > 1) return [];
      throw error;
    }
  );

  const mediaPromise =
    page === 1
      ? authedFetch<CoreMediaItem[]>(
          `/wp/v2/media?${new URLSearchParams({
            search: query,
            media_type: 'application',
            per_page: String(SITE_SEARCH_PAGE_SIZE),
          })}`,
          token
        ).catch(() => [] as CoreMediaItem[])
      : Promise.resolve([] as CoreMediaItem[]);

  const [posts, media] = await Promise.all([postsPromise, mediaPromise]);

  const results: SiteSearchResult[] = [];

  for (const item of Array.isArray(posts) ? posts : []) {
    if (!item?.id || !item.url) continue;
    const embedded = item._embedded?.self?.[0];
    results.push({
      id: item.id,
      type: item.subtype || 'page',
      type_label: labelForSubtype(item.subtype),
      title: plainText(item.title) || 'Untitled',
      excerpt: truncate(plainText(embedded?.excerpt?.rendered)),
      url: item.url,
      date: embedded?.date_gmt || embedded?.date,
    });
  }

  for (const item of Array.isArray(media) ? media : []) {
    if (!item?.id || !item.source_url) continue;
    results.push({
      id: item.id,
      type: 'document',
      type_label: documentLabel(item.mime_type),
      title: plainText(item.title?.rendered) || 'Untitled document',
      excerpt: truncate(plainText(item.caption?.rendered) || plainText(item.description?.rendered)),
      url: item.link || item.source_url,
      file_url: item.source_url,
      mime_type: item.mime_type,
      date: item.date_gmt,
    });
  }

  const postCount = Array.isArray(posts) ? posts.length : 0;
  return {
    results,
    page,
    // Core does not report totals through authedFetch; a full page means
    // there may be another one.
    total_pages: postCount >= SITE_SEARCH_PAGE_SIZE ? page + 1 : page,
  };
}

/** Search all website content as the signed-in member. */
export async function searchSite(
  token: string,
  query: string,
  page = 1
): Promise<SiteSearchPage> {
  const trimmed = query.trim();
  if (!trimmed) return { results: [], page, total_pages: 0 };

  if (coralSearchAvailable !== false) {
    try {
      const result = await searchWithCoral(token, trimmed, page);
      coralSearchAvailable = true;
      return result;
    } catch (error) {
      if (!(error instanceof ApiError && error.status === 404)) throw error;
      coralSearchAvailable = false;
    }
  }

  return searchWithCore(token, trimmed, page);
}

/**
 * URL the in-app resource viewer should open for a result. PDFs open the
 * file itself (the viewer renders PDFs); everything else opens its page, so
 * it goes through the signed-in website session.
 */
export function siteSearchResultUrl(result: SiteSearchResult): string {
  if (result.type === 'document' && result.file_url && /\.pdf($|[?#])/i.test(result.file_url)) {
    return result.file_url;
  }
  return result.url || result.file_url || '';
}
