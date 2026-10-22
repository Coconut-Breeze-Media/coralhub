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

function isPdfUrl(url: string): boolean {
  try {
    return new URL(url).pathname.toLowerCase().endsWith('.pdf');
  } catch {
    return /\.pdf($|\?)/i.test(url);
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
 * First URL the resource viewer should load.
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
