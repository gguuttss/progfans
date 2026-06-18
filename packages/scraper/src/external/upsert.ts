import { sql } from "drizzle-orm";
import { db, schema } from "../db";
import { slugify } from "../royalroad/util";

const normTitle = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]/g, "");

export type ExternalRating = { source: "goodreads" | "audible"; value: number; votes: number };
export type ExternalLink = {
  source: "goodreads" | "amazon" | "audible";
  url: string;
  externalId?: string | null;
};

/** A published book sourced from outside Royal Road (Goodreads list, lo5, …). */
export type ExternalBook = {
  title: string;
  authors: string[];
  firstPublishedAt?: string | null;
  coverUrl?: string | null;
  hasEbook?: boolean;
  hasAudio?: boolean;
  /** Engagement proxy for non-RR books (GR vote count), used for default sort. */
  popularity?: number;
  ratings?: ExternalRating[];
  links?: ExternalLink[];
};

function isUniqueViolation(e: unknown): boolean {
  return typeof e === "object" && e !== null && (e as { code?: string }).code === "23505";
}

/** Match an existing series by punctuation-insensitive title (so RR books in
 * these lists get enriched rather than duplicated). */
async function findExistingByTitle(title: string): Promise<number | null> {
  const n = normTitle(title);
  if (n.length < 4) return null;
  const [row] = await db.execute<{ id: number }>(
    sql`select id from series where lower(regexp_replace(title, '[^a-zA-Z0-9]+', '', 'g')) = ${n} limit 1`,
  );
  return row ? Number(row.id) : null;
}

/** Match by Goodreads book id — catches an already-present GR book even when
 * the stored title differs from this source's title. */
async function findExistingByGrId(externalId: string): Promise<number | null> {
  const [row] = await db.execute<{ series_id: number }>(
    sql`select series_id from source_links where source = 'goodreads' and external_id = ${externalId} limit 1`,
  );
  return row ? Number(row.series_id) : null;
}

async function insertSeries(title: string, b: ExternalBook): Promise<number> {
  const base = {
    title,
    coverUrl: b.coverUrl ?? null,
    firstPublishedAt: b.firstPublishedAt ?? null,
    status: "unknown" as const,
    eligibilityStatus: "manual_include" as const,
    hasEbook: b.hasEbook ?? false,
    hasAudio: b.hasAudio ?? false,
    popularity: b.popularity ?? 0,
    updatedAt: new Date(),
  };
  const root = slugify(title);
  for (let i = 1; i <= 8; i++) {
    const slug = i === 1 ? root : `${root}-${i}`;
    try {
      const [row] = await db
        .insert(schema.series)
        .values({ ...base, slug })
        .returning({ id: schema.series.id });
      return row!.id;
    } catch (e) {
      if (isUniqueViolation(e)) continue;
      throw e;
    }
  }
  throw new Error(`could not allocate a slug for "${title}"`);
}

async function linkAuthors(seriesId: number, names: string[]): Promise<void> {
  for (const name of names.map((n) => n.trim()).filter(Boolean)) {
    const [author] = await db
      .insert(schema.authors)
      .values({ name, slug: slugify(name) })
      .onConflictDoUpdate({ target: schema.authors.slug, set: { name } })
      .returning({ id: schema.authors.id });
    await db
      .insert(schema.seriesAuthors)
      .values({ seriesId, authorId: author!.id })
      .onConflictDoNothing();
  }
}

/** Match-or-create a series for an external (non-RR) book, then attach its
 * ratings and links. Never overwrites an existing series' core fields. */
export async function upsertExternalSeries(
  b: ExternalBook,
): Promise<{ seriesId: number; created: boolean }> {
  // Dedup priority: same Goodreads book id, then same normalized title.
  const grId = (b.links ?? []).find((l) => l.source === "goodreads" && l.externalId)?.externalId;
  const existing =
    (grId ? await findExistingByGrId(grId) : null) ?? (await findExistingByTitle(b.title));
  const seriesId = existing ?? (await insertSeries(b.title, b));
  const created = existing == null;

  if (created) await linkAuthors(seriesId, b.authors);

  for (const r of b.ratings ?? []) {
    if (!Number.isFinite(r.value)) continue;
    await db
      .insert(schema.seriesRatings)
      .values({ seriesId, source: r.source, value: String(r.value), votes: r.votes })
      .onConflictDoUpdate({
        target: [schema.seriesRatings.seriesId, schema.seriesRatings.source],
        set: { value: String(r.value), votes: r.votes, fetchedAt: new Date() },
      });
  }

  for (const l of b.links ?? []) {
    await db
      .insert(schema.sourceLinks)
      .values({ seriesId, source: l.source, url: l.url, externalId: l.externalId ?? null })
      .onConflictDoUpdate({
        target: [schema.sourceLinks.seriesId, schema.sourceLinks.source],
        set: { url: l.url, externalId: l.externalId ?? null },
      });
  }

  // Popularity for count-based sources (GR / Audible rating counts), stored
  // per-source like series_ratings — alongside any RR followers.
  for (const r of b.ratings ?? []) {
    if (r.votes > 0) {
      await db
        .insert(schema.seriesPopularity)
        .values({ seriesId, source: r.source, value: r.votes })
        .onConflictDoUpdate({
          target: [schema.seriesPopularity.seriesId, schema.seriesPopularity.source],
          set: { value: r.votes, fetchedAt: new Date() },
        });
    }
  }

  return { seriesId, created };
}

export { normTitle };
