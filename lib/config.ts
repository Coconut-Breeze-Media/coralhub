const LOCAL_HOSTNAMES = new Set([
  'localhost',
  '127.0.0.1',
  '0.0.0.0',
  'host.docker.internal',
]);

function isPrivateIpv4(hostname: string): boolean {
  const match = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!match) return false;

  const [a, b, c, d] = match.slice(1).map(Number);
  const octets = [a, b, c, d];

  if (octets.some((part) => Number.isNaN(part) || part < 0 || part > 255)) {
    return false;
  }

  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 192 && b === 168) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;

  return false;
}

function assertProductionUrl(name: string, rawValue: string, options?: { requireWpJson?: boolean }): string {
  let parsed: URL;

  try {
    parsed = new URL(rawValue);
  } catch {
    throw new Error(`${name} must be a valid absolute URL`);
  }

  if (parsed.protocol !== 'https:') {
    throw new Error(`${name} must use https in production`);
  }

  const hostname = parsed.hostname.toLowerCase();
  if (
    LOCAL_HOSTNAMES.has(hostname) ||
    hostname.endsWith('.local') ||
    isPrivateIpv4(hostname)
  ) {
    throw new Error(`${name} cannot point to a local or private server`);
  }

  if (options?.requireWpJson && !parsed.pathname.includes('/wp-json')) {
    throw new Error(`${name} must point to the WordPress REST API root (.../wp-json)`);
  }

  parsed.hash = '';
  parsed.search = '';
  parsed.pathname = parsed.pathname.replace(/\/+$/, '');

  return `${parsed.origin}${parsed.pathname}`;
}

function readRequiredUrl(
  name: 'EXPO_PUBLIC_WP_URL' | 'EXPO_PUBLIC_WP_API',
  rawValue: string | undefined,
): string {

  if (!rawValue) {
    throw new Error(`Missing ${name}`);
  }

  return assertProductionUrl(name, rawValue, {
    requireWpJson: name === 'EXPO_PUBLIC_WP_API',
  });
}

function joinSitePath(pathname: string): string {
  const normalizedPath = pathname.startsWith('/') ? pathname : `/${pathname}`;
  return new URL(normalizedPath, `${SITE_URL}/`).toString();
}

// Expo only inlines EXPO_PUBLIC_* variables when they are accessed statically.
export const SITE_URL = readRequiredUrl('EXPO_PUBLIC_WP_URL', process.env.EXPO_PUBLIC_WP_URL);
export const API_BASE_URL = readRequiredUrl('EXPO_PUBLIC_WP_API', process.env.EXPO_PUBLIC_WP_API);
export const PASSWORD_RESET_URL = joinSitePath('/wp-login.php?action=lostpassword');

export function siteUrl(pathname: string): string {
  return joinSitePath(pathname);
}
