/**
 * Helpers for BuddyPress extended profile fields.
 *
 * The members REST payload nests fields under `xprofile.groups[].fields`,
 * with values in `raw` / `unserialized` / HTML `rendered`. Checkbox fields
 * sometimes arrive as PHP serialized strings.
 */

import type { BPMember, BPXProfileField, BPXProfileGroup } from '../types';

export type ProfileField = {
  id: number;
  name: string;
  label: string;
  value: string;
};

const HIDDEN_FIELD_NAMES = new Set([
  'your full name',
  'name',
]);

const FEATURED_FIELD_NAMES = [
  'your primary research interest',
  'your secondary research interest',
];

function decodeEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

function stripHtml(value: string): string {
  return decodeEntities(value.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
}

function parsePhpSerializedStrings(raw: string): string[] | null {
  const trimmed = raw.trim();
  if (!/^a:\d+:\{/.test(trimmed)) return null;
  if (/^a:0:\{\}$/.test(trimmed)) return [];
  const matches = [...trimmed.matchAll(/s:\d+:"((?:\\.|[^"\\])*)"/g)];
  return matches.map((match) => match[1].replace(/\\"/g, '"'));
}

function stringifyUnserialized(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string') return stripHtml(value);
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) {
    return value
      .map((item) => stringifyUnserialized(item))
      .filter(Boolean)
      .join(', ');
  }
  return '';
}

export function fieldDisplayValue(field: BPXProfileField): string {
  const value = field.value;
  if (!value) return '';

  const fromUnserialized = stringifyUnserialized(value.unserialized);
  if (fromUnserialized) return fromUnserialized;

  const raw = value.raw;
  if (Array.isArray(raw)) {
    return raw.map((item) => stripHtml(String(item))).filter(Boolean).join(', ');
  }
  if (typeof raw === 'string' && raw.trim()) {
    const php = parsePhpSerializedStrings(raw);
    if (php) return php.filter(Boolean).join(', ');
    const cleaned = stripHtml(raw);
    if (cleaned && cleaned !== 'a:0:{}') return cleaned;
  }

  if (typeof value.rendered === 'string') {
    return stripHtml(value.rendered);
  }
  return '';
}

function flattenFields(xprofile: BPMember['xprofile']): BPXProfileField[] {
  if (!xprofile) return [];
  if (Array.isArray(xprofile)) return xprofile;
  const groups: BPXProfileGroup[] = xprofile.groups ?? [];
  return groups.flatMap((group) => group.fields ?? []);
}

function displayLabel(name: string): string {
  return name.replace(/^Your\s+/i, '').trim() || name;
}

export function getExtendedProfileFields(member: BPMember | null | undefined): ProfileField[] {
  if (!member) return [];
  return flattenFields(member.xprofile)
    .map((field) => {
      const name = field.name?.trim() ?? '';
      return {
        id: Number(field.id ?? field.field_id ?? 0),
        name,
        label: displayLabel(name),
        value: fieldDisplayValue(field),
      };
    })
    .filter((field) => field.name && field.value && !HIDDEN_FIELD_NAMES.has(field.name.toLowerCase()));
}

export function getFeaturedResearchFields(fields: ProfileField[]): ProfileField[] {
  return FEATURED_FIELD_NAMES.map((wanted) =>
    fields.find((field) => field.name.toLowerCase() === wanted)
  ).filter((field): field is ProfileField => Boolean(field));
}

export function getRemainingProfileFields(fields: ProfileField[]): ProfileField[] {
  const featured = new Set(FEATURED_FIELD_NAMES);
  return fields.filter((field) => !featured.has(field.name.toLowerCase()));
}
