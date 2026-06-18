// Refresh VOLATILE Goodreads data for series that already have books: update
// each book's rating, ADD any new volumes, and recompute the series rollup.
// Existing books' curated title/synopsis/cover are preserved (refreshBook only
// touches ratings); the series is never renamed.
// Run: pnpm --filter @progfans/scraper refresh:gr
import "../env";
import { sql } from "drizzle-orm";
import { client } from "../db";
import { closeBrowser, fetchGoodreads } from "../goodreads/browser";
import { parseSeriesPage } from "../goodreads/parse-book";
import { exec, fetchBook, refreshBook, rollUp } from "./core";

async function refreshOne(
  seriesId: number,
  grUrl: string,
): Promise<{ added: number; updated: number }> {
  // After the build, a series with books links to its GR SERIES page.
  if (!/\/series\//.test(grUrl)) return { added: 0, updated: 0 };
  const { realBooks } = parseSeriesPage(await fetchGoodreads(grUrl, 'a[href*="/book/show/"]'));
  let added = 0;
  let updated = 0;
  for (const rb of realBooks) {
    const b = await fetchBook(rb.grId);
    if (!b) continue;
    const r = await refreshBook(seriesId, rb.position, b);
    if (r === "added") added++;
    else updated++;
  }
  await rollUp(seriesId);
  return { added, updated };
}

async function main() {
  // Refresh the stalest series first, capped per run (GR re-fetches are slow and
  // a CI job is time-limited). Weekly runs cycle through the whole catalog.
  const limit = Number(process.env.REFRESH_LIMIT ?? 400);
  const rows = await exec(sql`
    select s.id, l.url,
      (select min(fetched_at) from series_ratings where series_id = s.id and source = 'goodreads') as fetched
    from series s
    join source_links l on l.series_id = s.id and l.source = 'goodreads'
    where exists (select 1 from books b where b.series_id = s.id)
    order by fetched asc nulls first
    limit ${limit}`);
  console.log(
    `Refreshing Goodreads data for ${rows.length} series (stalest first, limit ${limit})\n`,
  );

  let tAdded = 0;
  let tUpdated = 0;
  let fail = 0;
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (!r) continue;
    try {
      const { added, updated } = await refreshOne(Number(r.id), String(r.url));
      tAdded += added;
      tUpdated += updated;
      if (added) console.log(`  + ${added} new book(s) on series ${r.id}`);
    } catch (e) {
      fail++;
      console.warn(`  ✗ series ${r.id}: ${(e as Error).message}`);
    }
    if ((i + 1) % 25 === 0)
      console.log(`  ${i + 1}/${rows.length} | new ${tAdded} · updated ${tUpdated} · fail ${fail}`);
  }

  console.log(`\nDone. new books=${tAdded}, ratings updated=${tUpdated}, fail=${fail}`);
  await closeBrowser();
  await client.end();
}

main().catch(async (e) => {
  console.error(e);
  await closeBrowser();
  await client.end();
  process.exitCode = 1;
});
