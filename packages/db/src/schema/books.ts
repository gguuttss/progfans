import { sql } from "drizzle-orm";
import {
  bigint,
  bigserial,
  boolean,
  date,
  index,
  integer,
  numeric,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";
import { series } from "./catalog";
import { externalSource, ratingSource } from "./enums";

/**
 * An individual BOOK within a series. Series remain the only viewable entity;
 * books add per-volume detail (synopsis, cover, links, ratings). Books are
 * OPTIONAL — RR web serials carry zero books and keep their series-level link.
 */
export const books = pgTable(
  "books",
  {
    id: bigserial({ mode: "number" }).primaryKey(),
    seriesId: bigint({ mode: "number" })
      .notNull()
      .references(() => series.id, { onDelete: "cascade" }),
    title: text().notNull(),
    position: smallint(), // book number within the series (Goodreads "Book N")
    description: text(), // per-book synopsis
    coverUrl: text(),
    firstPublishedAt: date(),
    goodreadsId: text().unique(), // GR legacy book id — idempotent re-scrape key
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("books_series_idx").on(t.seriesId),
    // Trigram index so book-title search can resolve to the parent series.
    index("books_title_trgm_idx").using("gin", sql`${t.title} gin_trgm_ops`),
  ],
);

/** Per-book where-to-read + affiliate links (one canonical link per source). */
export const bookLinks = pgTable(
  "book_links",
  {
    id: bigserial({ mode: "number" }).primaryKey(),
    bookId: bigint({ mode: "number" })
      .notNull()
      .references(() => books.id, { onDelete: "cascade" }),
    source: externalSource().notNull(),
    url: text().notNull(),
    externalId: text(),
    isAffiliate: boolean().notNull().default(false),
  },
  (t) => [unique("book_links_book_source_uq").on(t.bookId, t.source)],
);

/**
 * Per-book rating slots (Goodreads, Audible, …) — granular, never blended at
 * storage. The series-level roll-up (vote-weighted average) is derived from
 * these into series_ratings for the grade system.
 */
export const bookRatings = pgTable(
  "book_ratings",
  {
    bookId: bigint({ mode: "number" })
      .notNull()
      .references(() => books.id, { onDelete: "cascade" }),
    source: ratingSource().notNull(),
    value: numeric({ precision: 4, scale: 2 }),
    votes: integer().notNull().default(0),
    fetchedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.bookId, t.source] }),
    index("book_ratings_source_value_idx").on(t.source, t.value),
  ],
);
