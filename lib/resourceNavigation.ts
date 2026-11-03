/**
 * Decide whether a WebView navigation stays inside the resource viewer.
 *
 * Google reCAPTCHA (used by the website login and by User Submitted Posts)
 * loads in an iframe on www.google.com. Sending that URL to the system
 * browser opens Safari/Chrome on a page that is only the reCAPTCHA logo,
 * which is the "< CoRR Hub" hand-off members are hitting.
 */

const EMBEDDED_HOSTS = new Set([
  'google.com',
  'www.google.com',
  'recaptcha.net',
  'www.recaptcha.net',
  'gstatic.com',
  'www.gstatic.com',
  'docs.google.com',
]);

export function hostOf(url: string): string {
  try {
    return new URL(url).host.toLowerCase();
  } catch {
    return '';
  }
}

function sameSite(host: string, siteHost: string): boolean {
  if (!siteHost) return true;
  if (host === siteHost) return true;
  const bare = (value: string) => value.replace(/^www\./, '');
  return bare(host) === bare(siteHost);
}

export function isPdfUrl(url: string): boolean {
  try {
    return new URL(url).pathname.toLowerCase().endsWith('.pdf');
  } catch {
    return /\.pdf($|\?)/i.test(url);
  }
}

/**
 * True when `url` is an absolute http(s) URL on the WordPress site (www and
 * bare host count as the same site). Unlike `sameSite`, an unknown site host
 * never matches.
 */
export function isSameSiteUrl(url: string, siteUrl: string): boolean {
  if (!/^https?:\/\//i.test(url)) return false;
  const host = hostOf(url);
  const siteHost = hostOf(siteUrl);
  if (!host || !siteHost) return false;
  return sameSite(host, siteHost);
}

/**
 * HTML resources on the website need the member's WordPress session, so the
 * viewer exchanges the app JWT for a one-time sign-in URL first. PDFs are
 * public files and off-site URLs never get a session.
 */
export function needsWebSession(resourceUrl: string, siteUrl: string): boolean {
  return isSameSiteUrl(resourceUrl, siteUrl) && !isPdfUrl(resourceUrl);
}

/**
 * Sanity-check the URL returned by POST /coral/v1/auth/web-session before
 * loading it: it must be on our own site (https when the site is https) and
 * carry the coral_sso token.
 */
export function isWebSessionHandoffUrl(url: string, siteUrl: string): boolean {
  if (!isSameSiteUrl(url, siteUrl)) return false;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' && new URL(siteUrl).protocol === 'https:') return false;
    return !!parsed.searchParams.get('coral_sso');
  } catch {
    return false;
  }
}

/**
 * Login URL for a same-site resource.
 *
 * The website's /login/ page reads redirect_to. Paid Memberships Pro sends
 * someone who is already signed in straight to that page, and after a new
 * sign-in it returns them there. Returns null for off-site or unparseable
 * targets so we never turn the login page into an open redirect.
 */
export function websiteLoginUrl(resourceUrl: string, siteUrl: string): string | null {
  let resourceHost = '';
  let site: URL;
  try {
    resourceHost = new URL(resourceUrl).host;
    site = new URL(siteUrl);
  } catch {
    return null;
  }

  if (!/^https?:\/\//i.test(resourceUrl)) return null;
  if (!resourceHost || !sameSite(resourceHost, site.host)) return null;

  const login = new URL('/login/', site.origin);
  login.searchParams.set('redirect_to', resourceUrl);
  return login.toString();
}

/**
 * URL the resource viewer loads when no one-time sign-in URL is available
 * (PDFs, or the web-session endpoint failed / is not deployed).
 * HTML pages start at the website login so the member signs in and lands on
 * the resource. PDFs are public; Android's WebView renders them via gview.
 */
export function resourceViewerEntry(
  resourceUrl: string,
  siteUrl: string,
  platform?: string
): string {
  if (isPdfUrl(resourceUrl)) {
    if (platform === 'android') {
      return `https://docs.google.com/gview?embedded=1&url=${encodeURIComponent(resourceUrl)}`;
    }
    return resourceUrl;
  }

  return websiteLoginUrl(resourceUrl, siteUrl) ?? resourceUrl;
}

export function shouldKeepResourceNavigation(
  target: string,
  siteHost: string,
  isTopFrame?: boolean
): boolean {
  if (
    target.startsWith('about:') ||
    target.startsWith('data:') ||
    target.startsWith('blob:')
  ) {
    return true;
  }

  // Subframes must never be handed to Safari. reCAPTCHA's badge is one of these.
  if (isTopFrame === false) return true;

  if (/^https?:\/\//i.test(target)) {
    const host = hostOf(target);
    return sameSite(host, siteHost) || EMBEDDED_HOSTS.has(host);
  }

  return false;
}
