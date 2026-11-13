/** Case-insensitive substring match for a member's display name. Empty query matches everyone. */
export function matchesMemberName(name: string | undefined | null, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return (name || '').toLowerCase().includes(needle);
}
