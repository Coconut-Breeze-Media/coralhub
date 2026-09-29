// hooks/useMemberProfile.ts
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../lib/auth';
import { getMemberCoverOrNull, getMemberProfile } from '../lib/api';
import type { BPMember, NormalizedXProfileField } from '../types';

function stripHtml(input: string): string {
  return input
    .replace(/<br\s*\/?>/gi, ', ')
    .replace(/<\/(p|li|div)>/gi, ', ')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/\s+/g, ' ')
    .replace(/(,\s*)+$/, '')
    .trim();
}

function valueToString(v: unknown): string {
  if (v == null) return '';
  if (Array.isArray(v)) {
    return v.map(valueToString).filter(Boolean).join(', ');
  }
  if (typeof v === 'string') return stripHtml(v);
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (typeof v === 'object') {
    const o = v as Record<string, unknown>;
    // Prefer rendered (HTML stripped), then unserialized array, then raw.
    const rendered = valueToString(o.rendered);
    if (rendered) return rendered;
    const unser = valueToString(o.unserialized);
    if (unser) return unser;
    return valueToString(o.raw);
  }
  return '';
}

/**
 * Normalize BuddyPress xprofile data. Handles both the flat array shape
 * (`[{ field_id, name, value }]`) and the grouped shape
 * (`{ groups: [{ id, name, fields: [{ id, name, value }] }] }`).
 * HTML is stripped, array values are joined with ", ", empty values dropped.
 */
export function normalizeXProfile(raw: unknown): NormalizedXProfileField[] {
  const out: NormalizedXProfileField[] = [];
  const pushField = (f: any, group?: string) => {
    if (!f || typeof f !== 'object') return;
    const name = typeof f.name === 'string' ? stripHtml(f.name) : '';
    const value = valueToString(f.value);
    if (!name || !value) return;
    const id = Number(f.id ?? f.field_id ?? 0) || 0;
    out.push({ id, name, value, ...(group ? { group } : {}) });
  };

  if (Array.isArray(raw)) {
    raw.forEach((item) => {
      // Array of groups, or array of fields
      if (item && typeof item === 'object' && Array.isArray((item as any).fields)) {
        const g = (item as any).name;
        (item as any).fields.forEach((f: unknown) => pushField(f, typeof g === 'string' ? g : undefined));
      } else {
        pushField(item);
      }
    });
  } else if (raw && typeof raw === 'object') {
    const groups = (raw as any).groups;
    const groupList: any[] = Array.isArray(groups)
      ? groups
      : groups && typeof groups === 'object'
        ? Object.values(groups)
        : [];
    groupList.forEach((g) => {
      const fields: unknown = g?.fields;
      const list: unknown[] = Array.isArray(fields)
        ? fields
        : fields && typeof fields === 'object'
          ? Object.values(fields as object)
          : [];
      list.forEach((f) => pushField(f, typeof g?.name === 'string' ? g.name : undefined));
    });
  }
  return out;
}

/**
 * Composes the member (with xprofile extras) and cover image queries.
 */
export function useMemberProfile(userId: number | null | undefined) {
  const { token } = useAuth();

  const memberQuery = useQuery<BPMember>({
    queryKey: ['profile', 'member', userId] as const,
    queryFn: async () => {
      if (!token) throw new Error('No authentication token');
      if (!userId) throw new Error('No user ID provided');
      return getMemberProfile(userId, token);
    },
    enabled: !!token && !!userId,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const coverQuery = useQuery<string | null>({
    queryKey: ['profile', 'cover', userId] as const,
    queryFn: async () => {
      if (!token || !userId) return null;
      return getMemberCoverOrNull(userId, token);
    },
    enabled: !!token && !!userId,
    staleTime: 10 * 60 * 1000,
  });

  const fields = useMemo(
    () => normalizeXProfile(memberQuery.data?.xprofile),
    [memberQuery.data?.xprofile]
  );

  return {
    member: memberQuery.data,
    fields,
    coverUrl: coverQuery.data ?? null,
    isLoading: memberQuery.isLoading,
    isError: memberQuery.isError,
    isRefetching: memberQuery.isRefetching || coverQuery.isRefetching,
    refetch: async () => {
      await Promise.all([memberQuery.refetch(), coverQuery.refetch()]);
    },
  };
}
