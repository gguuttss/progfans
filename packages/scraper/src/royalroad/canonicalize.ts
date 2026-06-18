import { createHash } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db, schema } from "../db";
import type { RoyalRoadFiction } from "./parse";
import { mapRoyalRoadTags } from "./tag-map";
import { slugify } from "./util";

const rrSlugFromUrl = (url: string): string =>
  (url.match(/\/fiction\/\d+\/([^/?#]+)/) ?? [])[1] ?? "";

function isUniqueViolation(e: unknown): boolean {
  return typeof e === "object" && e !== null && (e as { code?: string }).code === "23505";
}

// Cache the trope slug -> id lookup for the lifetime of the process.
let tropeIdCache: Map<string, number> | null = null;
async function tropeIdBySlug(): Promise<Map<string, number>> {
  if (!tropeIdCache) {
    const rows = await db
      .select({ id: schema.tropes.id, slug: schema.tropes.slug })
      .from(schema.tropes);
    tropeIdCache = new Map(rows.map((r) => [r.slug, r.id]));
  }
  return tropeIdCache;
}

/** Insert a series, falling back to an id-suffixed slug on the rare slug collision. */
async function insertSeries(
  base: Omit<typeof schema.series.$inferInsert, "slug">,
  rrSlug: string,
  externalId: string,
): Promise<number> {
  for (const slug of [rrSlug, `${rrSlug}-${externalId}`]) {
    try {
      const [row] = await db
        .insert(schema.series)
        .values({ ...base, slug })
        .returning({ id: schema.series.id });
      return row!.id;
    } catch (e) {
      if (isUniqueViolation(e) && slug === rrSlug) continue;
      throw e;
    }
  }
  throw new Error(`could not insert series for RR ${externalId}`);
}

/** Upsert one parsed Royal Road fiction into the canonical catalog tables. */
export async function canonicalize(
  f: RoyalRoadFiction,
): Promise<{ seriesId: number; created: boolean }> {
  const contentHash = createHash("sha1").update(JSON.stringify(f)).digest("hex");

  // 1. Raw snapshot (source of truth for re-derivation).
  await db
    .insert(schema.rawRecords)
    .values({ source: "royalroad", externalId: f.externalId, payload: f, contentHash })
    .onConflictDoUpdate({
      target: [schema.rawRecords.source, schema.rawRecords.externalId],
      set: { payload: f, contentHash, fetchedAt: new Date() },
    });

  // 2. Map RR tags -> canonical tropes + facets.
  const { tropeSlugs, facets } = mapRoyalRoadTags(f.tags);

  const ratingValue = f.ratingValue != null ? String(f.ratingValue) : null;
  const seriesValues = {
    title: f.title,
    description: f.description || null,
    coverUrl: f.coverUrl,
    firstPublishedAt: f.datePublished ? f.datePublished.slice(0, 10) : null,
    status: f.status,
    hasWeb: true,
    lengthChapters: f.chapters,
    lengthWords: f.words,
    popularity: f.followers,
    eligibilityStatus: "eligible" as const,
    updatedAt: new Date(),
    // Only set facets we actually derived (don't null out existing values).
    ...(facets.romance ? { romance: facets.romance } : {}),
    ...(facets.pov ? { pov: facets.pov } : {}),
    ...(facets.mcGender ? { mcGender: facets.mcGender } : {}),
  };

  // 3. Identity = the RR external id (via source_links).
  const [existing] = await db
    .select({ seriesId: schema.sourceLinks.seriesId })
    .from(schema.sourceLinks)
    .where(
      and(
        eq(schema.sourceLinks.source, "royalroad"),
        eq(schema.sourceLinks.externalId, f.externalId),
      ),
    )
    .limit(1);

  let seriesId: number;
  let created = false;
  if (existing) {
    seriesId = existing.seriesId;
    await db.update(schema.series).set(seriesValues).where(eq(schema.series.id, seriesId));
  } else {
    const rrSlug = slugify(rrSlugFromUrl(f.url) || f.title);
    seriesId = await insertSeries(seriesValues, rrSlug, f.externalId);
    await db
      .insert(schema.sourceLinks)
      .values({ seriesId, source: "royalroad", url: f.url, externalId: f.externalId });
    created = true;
  }

  // 4. Author + link.
  if (f.author) {
    const [author] = await db
      .insert(schema.authors)
      .values({ name: f.author, slug: slugify(f.author) })
      .onConflictDoUpdate({ target: schema.authors.slug, set: { name: f.author } })
      .returning({ id: schema.authors.id });
    await db
      .insert(schema.seriesAuthors)
      .values({ seriesId, authorId: author!.id })
      .onConflictDoNothing();
  }

  // 5. Royal Road rating slot.
  await db
    .insert(schema.seriesRatings)
    .values({ seriesId, source: "royalroad", value: ratingValue, votes: f.ratingCount })
    .onConflictDoUpdate({
      target: [schema.seriesRatings.seriesId, schema.seriesRatings.source],
      set: { value: ratingValue, votes: f.ratingCount, fetchedAt: new Date() },
    });

  // 5b. Royal Road popularity (follower count).
  await db
    .insert(schema.seriesPopularity)
    .values({ seriesId, source: "royalroad", value: f.followers })
    .onConflictDoUpdate({
      target: [schema.seriesPopularity.seriesId, schema.seriesPopularity.source],
      set: { value: f.followers, fetchedAt: new Date() },
    });

  // 6. Replace RR-sourced tropes (admin/user tropes are left untouched).
  await db
    .delete(schema.seriesTropes)
    .where(
      and(eq(schema.seriesTropes.seriesId, seriesId), eq(schema.seriesTropes.source, "royalroad")),
    );
  if (tropeSlugs.length) {
    const idBySlug = await tropeIdBySlug();
    const rows = tropeSlugs
      .map((slug) => idBySlug.get(slug))
      .filter((id): id is number => id != null)
      .map((tropeId) => ({ seriesId, tropeId, source: "royalroad" as const }));
    if (rows.length) await db.insert(schema.seriesTropes).values(rows).onConflictDoNothing();
  }

  return { seriesId, created };
}
