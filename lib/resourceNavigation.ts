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
