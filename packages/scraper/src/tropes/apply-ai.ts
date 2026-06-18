// Apply AI-generated trope assignments to the DB. Reads a JSON file:
//   [{ "id": 123, "slugs": ["litrpg", "dungeon-crawling"] }, ...]
// Writes series_tropes rows with source='ai' (idempotent: clears prior 'ai'
// rows for each touched series first, so re-running replaces rather than dupes).
// Unknown slugs are skipped and reported. Admin/RR/GR tropes are never touched.
// Run: pnpm --filter @progfans/scraper apply-ai <results.json>
import "../env";
import { readFileSync } from "node:fs";
import { and, eq, inArray } from "drizzle-orm";
import { client, db, schema } from "../db";

type Entry = { id: number; slugs: string[] };

async function main() {
  const paths = process.argv.slice(2);
  if (!paths.length) throw new Error("usage: apply-ai <results.json> [more.json ...]");
  const entries: Entry[] = paths.flatMap((p) => JSON.parse(readFileSync(p, "utf8")));

  // Common model-hallucinated slugs → canonical taxonomy slugs.
  const ALIASES: Record<string, string> = {
    isekai: "portal-fantasy-isekai",
    "monster-taming": "beast-monster-taming",
    necromancy: "summoner-necromancy",
    summoner: "summoner-necromancy",
    survival: "post-apocalyptic-survival",
    comedic: "comedy",
    funny: "comedy",
    grimdark: "dark-grimdark",
    dark: "dark-grimdark",
    cozy: "cozy-lighthearted",
    lighthearted: "cozy-lighthearted",
    "reincarnation-second-chance": "reincarnation",
    "reinc-nation-second-chance": "reincarnation",
    "system-apocalypse-litrpg": "system-apocalypse",
    crafting: "crafting-smithing",
    smithing: "crafting-smithing",
    alchemy: "alchemy-potions",
    dungeon: "dungeon-crawling",
    tower: "tower-climbing",
    academy: "academy-school",
    school: "academy-school",
    military: "war-military",
    war: "war-military",
    romance: "slow-burn-romance",
    strategist: "genius-strategist",
    genius: "genius-strategist",
  };

  const tropeRows = await db
    .select({ id: schema.tropes.id, slug: schema.tropes.slug })
    .from(schema.tropes);
  const slugToId = new Map(tropeRows.map((t) => [t.slug, t.id]));
  const canon = (slug: string) => slugToId.get(ALIASES[slug] ?? slug);

  const ids = entries.map((e) => e.id);
  if (ids.length) {
    // Clear prior AI rows for these series so a re-run is a clean replace.
    await db
      .delete(schema.seriesTropes)
      .where(and(inArray(schema.seriesTropes.seriesId, ids), eq(schema.seriesTropes.source, "ai")));
  }

  const unknown = new Set<string>();
  const values: { seriesId: number; tropeId: number; source: "ai" }[] = [];
  for (const e of entries) {
    const seen = new Set<number>();
    for (const slug of e.slugs ?? []) {
      const tid = canon(slug);
      if (!tid) {
        unknown.add(slug);
        continue;
      }
      if (seen.has(tid)) continue;
      seen.add(tid);
      values.push({ seriesId: e.id, tropeId: tid, source: "ai" });
    }
  }

  let inserted = 0;
  for (let i = 0; i < values.length; i += 500) {
    const chunk = values.slice(i, i + 500);
    await db.insert(schema.seriesTropes).values(chunk).onConflictDoNothing();
    inserted += chunk.length;
  }

  console.log(`applied ${inserted} AI trope rows across ${entries.length} series`);
  if (unknown.size) console.warn(`skipped unknown slugs: ${[...unknown].join(", ")}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => client.end());
