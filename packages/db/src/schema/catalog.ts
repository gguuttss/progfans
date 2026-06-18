import { sql } from "drizzle-orm";
import {
  bigint,
  bigserial,
  boolean,
  customType,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  real,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import {
  eligibilityStatus,
  externalSource,
  mcGender,
  pov,
  progressionPace,
  ratingSource,
  romance,
  seriesStatus,
  tropeCategory,
  tropeSource,
} from "./enums";

// Postgres full-text search vector — no native Drizzle type, so declare a thin one.
const tsvector = customType<{ data: string }>({
  dataType() {
    return "tsvector";
  },
});

/**
 * A SERIES is the catalog's atomic entry (like a MAL anime entry), not an
 * individual book. Facets are single-select enums; tropes live in `seriesTropes`.
 */
export const series = pgTable(
  "series",
  {
    id: bigserial({ mode: "number" }).primaryKey(),
    slug: text().notNull().unique(),
    title: text().notNull(),
    description: text(),
    coverUrl: text(),
    firstPublishedAt: date(),
    status: seriesStatus().notNull().default("unknown"),

    // Facets
    pov: pov(),
    mcGender: mcGender(),
    progressionPace: progressionPace(),
    romance: romance(),

    // Format availability
    hasWeb: boolean().notNull().default(false),
    hasEbook: boolean().notNull().default(false),
    hasKu: boolean().notNull().default(false),
    hasAudio: boolean().notNull().default(false),

    // Length (whichever dimensions are known)
    lengthChapters: integer(),
    lengthWords: integer(),
    lengthAudioMinutes: integer(),

    // Denormalized count of users tracking this series (bootstrapped from RR followers).
    popularity: integer().notNull().default(0),
    eligibilityStatus: eligibilityStatus().notNull().default("eligible"),

    // Generated FTS column over title + description.
    searchVector: tsvector().generatedAlwaysAs(
      sql`to_tsvector('english', coalesce(title, '') || ' ' || coalesce(description, ''))`,
    ),

    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("series_popularity_idx").on(t.popularity),
    index("series_status_idx").on(t.status),
    index("series_search_idx").using("gin", t.searchVector),
    index("series_title_trgm_idx").using("gin", sql`${t.title} gin_trgm_ops`),
  ],
);

export const authors = pgTable("authors", {
  id: bigserial({ mode: "number" }).primaryKey(),
  name: text().notNull(),
  slug: text().notNull().unique(),
});

export const seriesAuthors = pgTable(
  "series_authors",
  {
    seriesId: bigint({ mode: "number" })
      .notNull()
      .references(() => series.id, { onDelete: "cascade" }),
    authorId: bigint({ mode: "number" })
      .notNull()
      .references(() => authors.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.seriesId, t.authorId] })],
);

/** Where-to-read + affiliate links, one canonical link per external source. */
export const sourceLinks = pgTable(
  "source_links",
  {
    id: bigserial({ mode: "number" }).primaryKey(),
    seriesId: bigint({ mode: "number" })
      .notNull()
      .references(() => series.id, { onDelete: "cascade" }),
    source: externalSource().notNull(),
    url: text().notNull(),
    externalId: text(),
    isAffiliate: boolean().notNull().default(false),
  },
  (t) => [unique("source_links_series_source_uq").on(t.seriesId, t.source)],
);

/** Canonical controlled vocabulary. Seeded from src/seed/tropes.ts. */
export const tropes = pgTable("tropes", {
  id: bigserial({ mode: "number" }).primaryKey(),
  slug: text().notNull().unique(),
  name: text().notNull(),
  category: tropeCategory().notNull(),
  description: text(),
});

export const seriesTropes = pgTable(
  "series_tropes",
  {
    seriesId: bigint({ mode: "number" })
      .notNull()
      .references(() => series.id, { onDelete: "cascade" }),
    tropeId: bigint({ mode: "number" })
      .notNull()
      .references(() => tropes.id, { onDelete: "cascade" }),
    source: tropeSource().notNull().default("admin"),
    confidence: real(),
  },
  (t) => [
    primaryKey({ columns: [t.seriesId, t.tropeId] }),
    index("series_tropes_trope_idx").on(t.tropeId),
  ],
);

/** Per-source rating slots; never blended for ranking. */
export const seriesRatings = pgTable(
  "series_ratings",
  {
    seriesId: bigint({ mode: "number" })
      .notNull()
      .references(() => series.id, { onDelete: "cascade" }),
    source: ratingSource().notNull(),
    value: numeric({ precision: 4, scale: 2 }),
    votes: integer().notNull().default(0),
    fetchedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.seriesId, t.source] }),
    index("series_ratings_source_value_idx").on(t.source, t.value),
  ],
);

/**
 * Per-source popularity (followers on Royal Road, rating count on Goodreads,
 * tracked-reader count on progfans). Never blended — like series_ratings, each
 * source is its own row. series.popularity is just a derived sort key.
 */
export const seriesPopularity = pgTable(
  "series_popularity",
  {
    seriesId: bigint({ mode: "number" })
      .notNull()
      .references(() => series.id, { onDelete: "cascade" }),
    source: ratingSource().notNull(),
    value: integer().notNull(),
    fetchedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.seriesId, t.source] }),
    index("series_popularity_source_value_idx").on(t.source, t.value),
  ],
);

/** Untouched scraped payloads; canonical tables derive from these. */
export const rawRecords = pgTable(
  "raw_records",
  {
    id: bigserial({ mode: "number" }).primaryKey(),
    source: externalSource().notNull(),
    externalId: text().notNull(),
    payload: jsonb().notNull(),
    contentHash: text().notNull(),
    fetchedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique("raw_records_source_external_uq").on(t.source, t.externalId)],
);

/** Sub-threshold book suggestions (table now; UI deferred past v1). */
export const nominations = pgTable("nominations", {
  id: bigserial({ mode: "number" }).primaryKey(),
  seriesId: bigint({ mode: "number" }).references(() => series.id, { onDelete: "cascade" }),
  rawTitle: text(),
  note: text(),
  userId: uuid(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});
