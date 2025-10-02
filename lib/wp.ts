// lib/wp.ts
export async function getAllCategories() {
    const res = await fetch(`${process.env.EXPO_PUBLIC_WP_BASE?.replace(/\/$/, "")}/wp-json/wp/v2/categories?per_page=100`);
    if (!res.ok) throw new Error(`Failed to fetch categories: ${res.status}`);
    return (await res.json()) as Array<{ id: number; name: string; slug: string }>;
  }