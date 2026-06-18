// Regenerate slugs for series whose TITLE changed during the rewrite. Detects
// changes by diffing against the pre-rewrite snapshot, so series whose title was
// kept (and any intentionally-deduped slugs) are left untouched. Collisions get
// a numeric suffix. Writes an old->new map for optional redirects.
// Run AFTER apply:rewrite. Usage: pnpm --filter @progfans/scraper reslug:rewrite [snapshot.json]
import "../env";
import { readFileSync, writeFileSync } from "node:fs";
import { sql } from "drizzle-orm";
import { client, db } from "../db";
import { slugify } from "../royalroad/util";

const SNAP = process.argv[2] ?? "C:/Users/31633/Documents/GitHub/progfans-rewrite-snapshot.json";
const REDIRECTS = "C:/Users/31633/Documents/GitHub/progfans-slug-redirects.json";

async function main() {
  const snap = JSON.parse(readFileSync(SNAP, "utf8")) as {
    series: { id: number | string; title: string }[];
  };
  const oldTitle = new Map(snap.series.map((s) => [Number(s.id), s.title]));

  const rows = await db.execute<Record<string, unknown>>(sql`select id, title, slug from series`);
  const taken = new Set(rows.map((r) => String(r.slug)));

  const changes: { id: number; from: string; to: string }[] = [];
  for (const r of rows) {
    const id = Number(r.id);
    const title = String(r.title);
    const slug = String(r.slug);
    const prev = oldTitle.get(id);
    if (prev == null || prev === title) continue; // title unchanged → keep slug
    const base = slugify(title);
    if (base === slug) continue; // slug already matches the new title

    let cand = base;
    let n = 2;
    while (taken.has(cand)) cand = `${base}-${n++}`;
    taken.delete(slug);
    taken.add(cand);
    changes.push({ id, from: slug, to: cand });
  }

  for (const c of changes) {
    await db.execute(sql`update series set slug = ${c.to} where id = ${c.id}`);
  }

  writeFileSync(
    REDIRECTS,
    JSON.stringify(
      changes.map((c) => ({ from: c.from, to: c.to })),
      null,
      0,
    ),
  );
  console.log(`reslugged ${changes.length} series; old→new map -> ${REDIRECTS}`);
  for (const c of changes.slice(0, 25)) console.log(`  ${c.from}  ->  ${c.to}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => client.end());
