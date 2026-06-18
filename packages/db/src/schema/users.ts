import { sql } from "drizzle-orm";
import {
  bigint,
  bigserial,
  boolean,
  check,
  date,
  jsonb,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { listStatus } from "./enums";
import { series } from "./catalog";

/**
 * Extends Supabase `auth.users`. `id` equals the auth uid (FK to auth.users).
 */
export const profiles = pgTable("profiles", {
  id: uuid().primaryKey(),
  username: text().notNull().unique(),
  displayName: text(),
  bio: text(),
  location: text(),
  birthday: date(),
  birthdayPrecision: text(), // 'year' | 'month' | 'day' — how much of the date to show
  gender: text(),
  avatarUrl: text(),
  isAdmin: boolean().notNull().default(false),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

/**
 * A proposed change to the catalog. Admins' edits are applied immediately;
 * everyone else's land here as `pending` for an admin to review (a GitHub-style
 * diff). `kind` is 'edit' (payload = full proposed series state) or 'new_series'
 * (payload = a requested book the catalog is missing).
 */
export const changeRequests = pgTable("change_requests", {
  id: bigserial({ mode: "number" }).primaryKey(),
  kind: text().notNull(), // 'edit' | 'new_series'
  seriesId: bigint({ mode: "number" }).references(() => series.id, { onDelete: "cascade" }),
  proposerId: uuid().references(() => profiles.id, { onDelete: "set null" }),
  status: text().notNull().default("pending"), // 'pending' | 'approved' | 'rejected'
  payload: jsonb().notNull(),
  note: text(),
  reviewedBy: uuid().references(() => profiles.id, { onDelete: "set null" }),
  reviewedAt: timestamp({ withTimezone: true }),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

/** A user's hand-picked favourite series (max 10, enforced in app). */
export const profileFavorites = pgTable(
  "profile_favorites",
  {
    userId: uuid()
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    seriesId: bigint({ mode: "number" })
      .notNull()
      .references(() => series.id, { onDelete: "cascade" }),
    position: smallint().notNull().default(0),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.seriesId] })],
);

export const listEntries = pgTable(
  "list_entries",
  {
    id: bigserial({ mode: "number" }).primaryKey(),
    userId: uuid()
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    seriesId: bigint({ mode: "number" })
      .notNull()
      .references(() => series.id, { onDelete: "cascade" }),
    status: listStatus().notNull(),
    score: smallint(),
    notes: text(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("list_entries_user_series_uq").on(t.userId, t.seriesId),
    check("list_entries_score_chk", sql`${t.score} is null or ${t.score} between 1 and 10`),
  ],
);
