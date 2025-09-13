// utils/extractFirstLink.ts
export function extractFirstLink(html: string): string | null {
    const m = html.match(/https?:\/\/[^\s<>"']+/i);
    return m ? m[0] : null;
  }