// Refresh VOLATILE Royal Road data for series we already have: status, word
// count, chapters, rating, follower count. Curated fields (title, description,
// cover, tropes, facets) are intentionally left untouched so edits survive.
// Run: pnpm --filter @progfans/scraper refresh:rr
import "../env";
import { sql } from "drizzle-orm";
import { client, db } from "../db";
import { fetchHtml } from "./client";
import { parseFiction } from "./parse";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  // Stalest-first, capped per run (RR_REFRESH_LIMIT, 0 = all) so a frequent cron
  // cycles the whole catalogue within the budget without timing out.
  const limit = Number(process.env.RR_REFRESH_LIMIT ?? 0);
  const rows = await db.execute<Record<string, unknown>>(sql`
    select s.id, l.external_id, l.url,
      (select min(fetched_at) from series_ratings where series_id = s.id and source = 'royalroad') as fetched
    from series s
    join source_links l on l.series_id = s.id and l.source = 'royalroad'
    where l.external_id is not null
    order by fetched asc nulls first
    ${limit > 0 ? sql`limit ${limit}` : sql``}`);
  console.log(`Refreshing Royal Road data for ${rows.length} series (data only)\n`);

  let ok = 0;
  let fail = 0;
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (!r) continue;
    try {
      const html = await fetchHtml(`/fiction/${r.external_id}`);
      const f = parseFiction(html, String(r.url));
      const ratingValue = f.ratingValue != null ? String(f.ratingValue) : null;

      await db.execute(sql`update series set
        status = ${f.status}::series_status,
        length_chapters = ${f.chapters}, length_words = ${f.words},
        popularity = ${f.followers}, updated_at = now()
        where id = ${r.id}`);
      await db.execute(sql`insert into series_ratings (series_id, source, value, votes)
        values (${r.id}, 'royalroad', ${ratingValue}, ${f.ratingCount})
        on conflict (series_id, source) do update set value = excluded.value, votes = excluded.votes, fetched_at = now()`);
      await db.execute(sql`insert into series_popularity (series_id, source, value)
        values (${r.id}, 'royalroad', ${f.followers})
        on conflict (series_id, source) do update set value = excluded.value, fetched_at = now()`);
      ok++;
    } catch (e) {
      fail++;
      console.warn(`  ✗ ${r.external_id}: ${(e as Error).message}`);
    }
    if ((i + 1) % 50 === 0) console.log(`  ${i + 1}/${rows.length} (ok ${ok}, fail ${fail})`);
    await sleep(250);
  }

  console.log(`\nDone. ok=${ok} fail=${fail}`);
  await client.end();
}

main().catch(async (e) => {
  console.error(e);
  await client.end();
  process.exitCode = 1;
});
