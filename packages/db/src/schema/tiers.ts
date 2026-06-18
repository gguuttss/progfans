import {
  type AnyPgColumn,
  bigint,
  bigserial,
  boolean,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { series } from "./catalog";
import { profiles } from "./users";

export const tierLists = pgTable("tier_lists", {
  id: bigserial({ mode: "number" }).primaryKey(),
  slug: text().notNull().unique(),
  ownerId: uuid().references(() => profiles.id, { onDelete: "set null" }),
  title: text().notNull(),
  isPublic: boolean().notNull().default(true),
  remixedFrom: bigint({ mode: "number" }).references((): AnyPgColumn => tierLists.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export const tierListTiers = pgTable("tier_list_tiers", {
  id: bigserial({ mode: "number" }).primaryKey(),
  tierListId: bigint({ mode: "number" })
    .notNull()
    .references(() => tierLists.id, { onDelete: "cascade" }),
  label: text().notNull(),
  color: text(),
  position: integer().notNull(),
});

export const tierListVotes = pgTable(
  "tier_list_votes",
  {
    tierListId: bigint({ mode: "number" })
      .notNull()
      .references(() => tierLists.id, { onDelete: "cascade" }),
    userId: uuid()
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.tierListId, t.userId] })],
);

export const tierListItems = pgTable("tier_list_items", {
  id: bigserial({ mode: "number" }).primaryKey(),
  tierListId: bigint({ mode: "number" })
    .notNull()
    .references(() => tierLists.id, { onDelete: "cascade" }),
  seriesId: bigint({ mode: "number" })
    .notNull()
    .references(() => series.id, { onDelete: "cascade" }),
  tierId: bigint({ mode: "number" })
    .notNull()
    .references(() => tierListTiers.id, { onDelete: "cascade" }),
  position: integer().notNull(),
});
