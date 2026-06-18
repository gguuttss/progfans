// Apply AI title/synopsis rewrites + re-tagging from out-*.json files.
// Each file: [{ id, title, description, tropes:[slug], books:[{id,title,description}] }]
// - Bulk-updates series.title/description and books.title/description (a book
//   description of null means "keep the existing one").
// - Replaces each series' source='ai' tropes (admin/RR/GR tropes are untouched).
// Run: pnpm --filter @progfans/scraper apply:rewrite <out-000.json> [more...]
import "../env";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { and, eq, inArray } from "drizzle-orm";
import { client, db, schema } from "../db";

type BookOut = { id: number; title?: string | null; description?: string | null };
type SeriesOut = {
  id: number;
  title?: string | null;
  description?: string | null;
  tropes?: string[];
  books?: BookOut[];
};

// Model-hallucinated slugs → canonical taxonomy slugs (kept in sync with apply-ai).
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

const clean = (v: string | null | undefined): string | null => {
  if (v == null) return null;
  const t = v.trim();
  return t.length ? t : null;
};

async function main() {
  const args = process.argv.slice(2);
  if (!args.length) throw new Error("usage: apply:rewrite <dir | out.json> [more...]");
  // Accept files and/or directories (a dir contributes its out-*.json files).
  const paths = args.flatMap((p) =>
    statSync(p).isDirectory()
      ? readdirSync(p)
          .filter((f) => /^out-.*\.json$/.test(f))
          .map((f) => join(p, f))
      : [p],
  );
  // Resilient load: one malformed chunk shouldn't block the rest.
  const entries: SeriesOut[] = [];
  for (const p of paths) {
    try {
      const data = JSON.parse(readFileSync(p, "utf8"));
      if (Array.isArray(data)) entries.push(...data.filter((e) => e && e.id != null));
      else console.warn(`skip ${p}: not a JSON array`);
    } catch (e) {
      console.warn(`skip ${p}: ${(e as Error).message}`);
    }
  }
  if (!entries.length) throw new Error("no valid entries found");

  // 1) Bulk series title/description (coalesce → a null keeps the existing value).
  const sIds = entries.map((e) => e.id);
  const sTitles = entries.map((e) => clean(e.title));
  const sDescs = entries.map((e) => clean(e.description));
  await client`
    update series s set
      title = coalesce(u.title, s.title),
      description = coalesce(u.description, s.description),
      updated_at = now()
    from unnest(${sIds}::bigint[], ${sTitles}::text[], ${sDescs}::text[]) as u(id, title, description)
    where s.id = u.id`;

  // 2) Bulk book title/description. A book description of null means "keep".
  const books = entries.flatMap((e) => e.books ?? []);
  if (books.length) {
    const bIds = books.map((b) => b.id);
    const bTitles = books.map((b) => clean(b.title));
    const bDescs = books.map((b) => (b.description === null ? null : clean(b.description)));
    await client`
      update books b set
        title = coalesce(u.title, b.title),
        description = coalesce(u.description, b.description),
        updated_at = now()
      from unnest(${bIds}::bigint[], ${bTitles}::text[], ${bDescs}::text[]) as u(id, title, description)
      where b.id = u.id`;
  }

  // 3) Replace AI tropes for the touched series.
  const tropeRows = await db
    .select({ id: schema.tropes.id, slug: schema.tropes.slug })
    .from(schema.tropes);
  const slugToId = new Map(tropeRows.map((t) => [t.slug, t.id]));
  const canon = (slug: string) => slugToId.get(ALIASES[slug] ?? slug);

  const ids = entries.map((e) => e.id);
  await db
    .delete(schema.seriesTropes)
    .where(and(inArray(schema.seriesTropes.seriesId, ids), eq(schema.seriesTropes.source, "ai")));

  const unknown = new Set<string>();
  const values: { seriesId: number; tropeId: number; source: "ai" }[] = [];
  for (const e of entries) {
    const seen = new Set<number>();
    for (const slug of e.tropes ?? []) {
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
  for (let i = 0; i < values.length; i += 500) {
    await db
      .insert(schema.seriesTropes)
      .values(values.slice(i, i + 500))
      .onConflictDoNothing();
  }

  console.log(
    `applied: ${entries.length} series, ${books.length} books, ${values.length} AI trope rows`,
  );
  if (unknown.size) console.warn(`skipped unknown trope slugs: ${[...unknown].join(", ")}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => client.end());
