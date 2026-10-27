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

// ─────────────────────────────────────────────
// Emoji / entity handling shared by posts, comments and edit forms
// ─────────────────────────────────────────────

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  ndash: '–', mdash: '—', lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”',
  hellip: '…', bull: '•', copy: '©', reg: '®', trade: '™',
};

/** Decode numeric (`&#x1f600;`, `&#128512;`) and common named HTML entities. */
export function decodeHtmlEntities(text: string): string {
  // Content that was escaped twice (`&amp;#x1f600;`) would otherwise show the
  // raw entity code after one decoding pass.
  const unescaped = text.replace(/&amp;(#x?[0-9a-f]+;)/gi, '&$1');
  return unescaped.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, entity: string) => {
    if (entity.startsWith('#')) {
      const isHex = entity[1]?.toLowerCase() === 'x';
      const codePoint = Number.parseInt(entity.slice(isHex ? 2 : 1), isHex ? 16 : 10);
      if (!Number.isFinite(codePoint) || codePoint <= 0) return match;
      try {
        return String.fromCodePoint(codePoint);
      } catch {
        return match;
      }
    }
    return NAMED_ENTITIES[entity.toLowerCase()] ?? match;
  });
}

const EMOJI_IMAGE_SRC = /s\.w\.org\/images\/core\/emoji|\/emoji\/|twemoji|emojione|joypixels|\/smilies\//i;

/** True when an image URL points at an emoji/smiley sprite rather than a photo. */
export function isEmojiImageUrl(url: string): boolean {
  return EMOJI_IMAGE_SRC.test(url);
}

/**
 * True for an `<img>` tag that is really an emoji. WordPress core turns
 * smilies/emoji into `<img class="wp-smiley|emoji" src=".../s.w.org/images/core/emoji/...">`,
 * and common website plugins use Twemoji / EmojiOne / JoyPixels images. They
 * belong inline in the text and must never be treated as a post image.
 */
export function isEmojiImageTag(tag: string): boolean {
  const className = tag.match(/\bclass\s*=\s*["']([^"']*)["']/i)?.[1] ?? '';
  if (/\b(wp-smiley|emoji|emojione\w*|joypixels|twemoji)\b/i.test(className)) return true;

  const src = tag.match(/\b(?:src|data-src)\s*=\s*["']([^"']*)["']/i)?.[1] ?? '';
  return isEmojiImageUrl(src);
}

/** Replace emoji `<img>` tags with their unicode `alt` text. */
export function replaceEmojiImages(html: string): string {
  return html.replace(/<img\b[^>]*>/gi, (tag) => {
    if (!isEmojiImageTag(tag)) return tag;
    return tag.match(/\balt\s*=\s*["']([^"']*)["']/i)?.[1] ?? '';
  });
}

// Windows-1252 characters that stand in for bytes 0x80–0x9F when UTF-8 text
// was mis-decoded as cp1252 (e.g. "ðŸ˜€" instead of "😀").
const CP1252_TO_BYTE: Record<number, number> = {
  0x20ac: 0x80, 0x201a: 0x82, 0x0192: 0x83, 0x201e: 0x84, 0x2026: 0x85,
  0x2020: 0x86, 0x2021: 0x87, 0x02c6: 0x88, 0x2030: 0x89, 0x0160: 0x8a,
  0x2039: 0x8b, 0x0152: 0x8c, 0x017d: 0x8e, 0x2018: 0x91, 0x2019: 0x92,
  0x201c: 0x93, 0x201d: 0x94, 0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97,
  0x02dc: 0x98, 0x2122: 0x99, 0x0161: 0x9a, 0x203a: 0x9b, 0x0153: 0x9c,
  0x017e: 0x9e, 0x0178: 0x9f,
};
const MOJIBAKE_CONT =
  '[\\u0080-\\u00BF\\u20AC\\u201A\\u0192\\u201E\\u2026\\u2020\\u2021\\u02C6\\u2030\\u0160\\u2039' +
  '\\u0152\\u017D\\u2018\\u2019\\u201C\\u201D\\u2022\\u2013\\u2014\\u02DC\\u2122\\u0161\\u203A' +
  '\\u0153\\u017E\\u0178]';
const MOJIBAKE_PATTERN = new RegExp(
  `[\\u00C2-\\u00DF]${MOJIBAKE_CONT}|[\\u00E0-\\u00EF]${MOJIBAKE_CONT}{2}|[\\u00F0-\\u00F4]${MOJIBAKE_CONT}{3}`,
  'g'
);

function mojibakeCharToByte(char: string): number {
  const code = char.charCodeAt(0);
  return code <= 0xff ? code : CP1252_TO_BYTE[code] ?? -1;
}

/**
 * Repair UTF-8 text that was decoded as Latin-1/cp1252 somewhere between the
 * app, WordPress and MySQL — the "ð" / "ðŸ˜€" seen instead of an emoji.
 * Only complete, valid UTF-8 sequences are rewritten.
 */
export function repairMojibake(text: string): string {
  if (!/[Â-ô]/.test(text)) return text;
  return text.replace(MOJIBAKE_PATTERN, (sequence) => {
    const bytes = Array.from(sequence).map(mojibakeCharToByte);
    if (bytes.some((b) => b < 0)) return sequence;
    let codePoint: number;
    if (bytes.length === 2) {
      codePoint = ((bytes[0] & 0x1f) << 6) | (bytes[1] & 0x3f);
    } else if (bytes.length === 3) {
      codePoint = ((bytes[0] & 0x0f) << 12) | ((bytes[1] & 0x3f) << 6) | (bytes[2] & 0x3f);
    } else {
      codePoint =
        ((bytes[0] & 0x07) << 18) | ((bytes[1] & 0x3f) << 12) | ((bytes[2] & 0x3f) << 6) | (bytes[3] & 0x3f);
    }
    const minimum = bytes.length === 2 ? 0x80 : bytes.length === 3 ? 0x800 : 0x10000;
    if (codePoint < minimum || codePoint > 0x10ffff || (codePoint >= 0xd800 && codePoint <= 0xdfff)) {
      return sequence;
    }
    return String.fromCodePoint(codePoint);
  });
}

/**
 * Encode characters outside the Basic Multilingual Plane (emoji, etc.) as
 * numeric HTML entities before sending content to WordPress. This mirrors
 * WordPress' own `wp_encode_emoji()` and keeps emoji intact even when the
 * activity table is not utf8mb4 (where 4-byte characters are stripped or
 * mangled). The app and the website both decode the entities on display.
 */
export function encodeEmojiEntities(text: string): string {
  let result = '';
  for (const char of text) {
    const codePoint = char.codePointAt(0) ?? 0;
    result += codePoint > 0xffff ? `&#x${codePoint.toString(16)};` : char;
  }
  return result;
}

/**
 * Convert WordPress/BuddyPress HTML (a comment, or a post being edited) into
 * plain text with emoji restored: emoji images become their unicode `alt`,
 * entities are decoded and mis-encoded UTF-8 is repaired.
 */
export function htmlToPlainText(html: string): string {
  const withBreaks = replaceEmojiImages(html || '')
    .replace(/<\/p\s*>/gi, '\n\n')
    .replace(/<br\s*\/?>/gi, '\n');
  return repairMojibake(decodeHtmlEntities(withBreaks.replace(/<[^>]+>/g, '')))
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Make a protocol-relative (`//host/...`) avatar/preview URL usable by <Image>. */
export function toAbsoluteUrl(url: string | null | undefined): string | undefined {
  const trimmed = url?.trim();
  if (!trimmed) return undefined;
  if (trimmed.startsWith('//')) return `https:${trimmed}`;
  return trimmed;
}
