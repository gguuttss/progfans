// One-time Goodreads rating seed for existing series.
// Run: pnpm --filter @progfans/scraper enrich:gr
import "../env";
import { and, eq, sql } from "drizzle-orm";
import { client, db, schema } from "../db";
import { closeBrowser, searchBooks } from "./browser";
import { isGrDenylisted, looksLikeFanfic, parseSearchResults, pickFirstBook } from "./search";
import { sleep } from "../royalroad/util";

async function main() {
  // Clean reseed, but ONLY for Royal-Road-origin series — leave GR data that
  // the lo5/Listopia importers attached to non-RR books untouched.
  const rrOrigin = sql`series_id in (select series_id from source_links where source = 'royalroad')`;
  await db.execute(sql`delete from series_ratings where source = 'goodreads' and ${rrOrigin}`);
  await db.execute(sql`delete from source_links where source = 'goodreads' and ${rrOrigin}`);

  const rows = await db
    .select({
      id: schema.series.id,
      title: schema.series.title,
      author: sql<string>`coalesce(string_agg(distinct ${schema.authors.name}, ', '), '')`,
    })
    .from(schema.series)
    .innerJoin(
      schema.sourceLinks,
      and(
        eq(schema.sourceLinks.seriesId, schema.series.id),
        eq(schema.sourceLinks.source, "royalroad"),
      ),
    )
    .leftJoin(schema.seriesAuthors, eq(schema.seriesAuthors.seriesId, schema.series.id))
    .leftJoin(schema.authors, eq(schema.authors.id, schema.seriesAuthors.authorId))
    .groupBy(schema.series.id, schema.series.title, schema.series.popularity)
    .orderBy(sql`${schema.series.popularity} desc`);

  console.log(`Enriching ${rows.length} series with Goodreads ratings...\n`);
  let matched = 0;
  let missed = 0;

  for (const [i, s] of rows.entries()) {
    const pos = `[${i + 1}/${rows.length}]`;
    if (looksLikeFanfic(s.title)) {
      missed++;
      console.log(`${pos} ⊘ ${s.title} → skipped (fanfiction; not on Goodreads)`);
      continue;
    }
    if (isGrDenylisted(s.title)) {
      missed++;
      console.log(`${pos} ⊘ ${s.title} → skipped (denylisted false match)`);
      continue;
    }
    try {
      const query = s.title.replace(/\[.*?\]|\(.*?\)/g, " ").trim();
      const hit = pickFirstBook(parseSearchResults(await searchBooks(query)), s.title, s.author);
      if (hit) {
        await db
          .insert(schema.seriesRatings)
          .values({
            seriesId: s.id,
            source: "goodreads",
            value: String(hit.rating),
            votes: hit.votes,
          })
          .onConflictDoUpdate({
            target: [schema.seriesRatings.seriesId, schema.seriesRatings.source],
            set: { value: String(hit.rating), votes: hit.votes, fetchedAt: new Date() },
          });
        // Goodreads popularity proxy = its rating count (stored alongside any RR followers).
        await db
          .insert(schema.seriesPopularity)
          .values({ seriesId: s.id, source: "goodreads", value: hit.votes })
          .onConflictDoUpdate({
            target: [schema.seriesPopularity.seriesId, schema.seriesPopularity.source],
            set: { value: hit.votes, fetchedAt: new Date() },
          });
        if (hit.url) {
          await db
            .insert(schema.sourceLinks)
            .values({ seriesId: s.id, source: "goodreads", url: hit.url })
            .onConflictDoUpdate({
              target: [schema.sourceLinks.seriesId, schema.sourceLinks.source],
              set: { url: hit.url },
            });
        }
        matched++;
        console.log(`${pos} ✓ ${s.title} → ${hit.title} (${hit.rating}/5, ${hit.votes})`);
      } else {
        missed++;
        console.log(`${pos} – ${s.title} → no GR match`);
      }
    } catch (e) {
      missed++;
      console.warn(`${pos} ✗ ${s.title}: ${(e as Error).message}`);
    }
    await sleep(2000);
  }

  console.log(`\nDone. matched=${matched}, missed=${missed}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeBrowser();
    await client.end();
  });
