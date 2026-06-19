import type { MetadataRoute } from "next";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";

const BASE = "https://progfans.com";

// Regenerate at most once a day — the catalog changes slowly.
export const revalidate = 86400;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  let series: Record<string, unknown>[] = [];
  let tiers: Record<string, unknown>[] = [];
  try {
    [series, tiers] = await Promise.all([
      db.execute<Record<string, unknown>>(sql`
        select slug, updated_at from series
        where eligibility_status in ('eligible', 'manual_include')`),
      db.execute<Record<string, unknown>>(sql`
        select slug, created_at from tier_lists where is_public = true`),
    ]);
  } catch {
    // If the DB is unreachable (e.g. during build), still emit the static pages.
  }

  const staticPages: MetadataRoute.Sitemap = [
    { url: BASE, changeFrequency: "daily", priority: 1 },
    { url: `${BASE}/browse`, changeFrequency: "daily", priority: 0.8 },
    { url: `${BASE}/tier`, changeFrequency: "weekly", priority: 0.6 },
    { url: `${BASE}/privacy`, priority: 0.2 },
    { url: `${BASE}/terms`, priority: 0.2 },
  ];

  const seriesPages: MetadataRoute.Sitemap = series.map((s) => ({
    url: `${BASE}/series/${String(s.slug)}`,
    lastModified: s.updated_at ? new Date(String(s.updated_at)) : undefined,
    changeFrequency: "weekly",
    priority: 0.7,
  }));

  const tierPages: MetadataRoute.Sitemap = tiers.map((t) => ({
    url: `${BASE}/tier/${String(t.slug)}`,
    lastModified: t.created_at ? new Date(String(t.created_at)) : undefined,
    changeFrequency: "weekly",
    priority: 0.5,
  }));

  return [...staticPages, ...seriesPages, ...tierPages];
}
