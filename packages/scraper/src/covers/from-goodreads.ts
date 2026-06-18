// Cover pass for non-RR books: visit each Goodreads book page, pull the
// high-res og:image, and self-host it. Closes the cover gap for lo5 books
// (lo5 provides no cover images).
// Run: pnpm --filter @progfans/scraper covers:gr
import "../env";
import * as cheerio from "cheerio";
import { eq, sql } from "drizzle-orm";
import { client, db, schema } from "../db";
import { closeBrowser, fetchGoodreads } from "../goodreads/browser";
import { hostCover } from "./host";

async function main() {
  const rows = await db.execute<{ id: number; url: string }>(sql`
    select s.id, l.url from series s
    join source_links l on l.series_id = s.id and l.source = 'goodreads'
    where s.cover_url is null
       or s.cover_url not like '%/storage/v1/object/public/covers/%'
    order by s.popularity desc`);

  console.log(`${rows.length} series need a Goodreads cover...`);
  let ok = 0;
  let fail = 0;

  for (const [i, r] of rows.entries()) {
    try {
      const html = await fetchGoodreads(r.url);
      const og = cheerio.load(html)('meta[property="og:image"]').attr("content");
      if (!og) throw new Error("no og:image");
      const url = await hostCover(r.id, og);
      await db.update(schema.series).set({ coverUrl: url }).where(eq(schema.series.id, r.id));
      ok++;
    } catch (e) {
      fail++;
      if (fail <= 15) console.warn(`  ✗ series ${r.id}: ${(e as Error).message}`);
    }
    if ((i + 1) % 25 === 0) console.log(`  ${i + 1}/${rows.length} (ok=${ok}, fail=${fail})`);
  }

  console.log(`\nDone. hosted=${ok}, failed=${fail}`);
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
