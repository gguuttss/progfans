// One-pass Goodreads backfill for non-RR books: visit each book page once and
// capture BOTH the full synopsis (for AI trope-tagging + on-site display) and,
// if still missing, the self-hosted cover. lo5/Listopia gave us titles + ratings
// only — no description, no cover — so this is where published books get fleshed out.
// Run: pnpm --filter @progfans/scraper backfill:gr
import "../env";
import * as cheerio from "cheerio";
import { eq, sql } from "drizzle-orm";
import { hostCover } from "../covers/host";
import { client, db, schema } from "../db";
import { closeBrowser, fetchGoodreads } from "./browser";

function extractDescription(html: string): string | null {
  const $ = cheerio.load(html);
  let text =
    $('[data-testid="description"] .Formatted').first().text() ||
    $(".BookPageMetadataSection__description .Formatted").first().text() ||
    $('meta[property="og:description"]').attr("content") ||
    "";
  text = text.replace(/\s+/g, " ").trim();
  // Drop the boilerplate librarian/alternate-cover note that GR prepends.
  text = text.replace(/^Librarian['’]s note:.*?here\s*/i, "").trim();
  return text.length >= 40 ? text : null;
}

async function main() {
  const rows = await db.execute<{
    id: number;
    url: string;
    needsCover: boolean;
    needsDesc: boolean;
  }>(sql`
    select s.id,
           l.url,
           (s.cover_url is null or s.cover_url not like '%/storage/v1/object/public/covers/%') as "needsCover",
           (s.description is null or length(s.description) < 40) as "needsDesc"
    from series s
    join source_links l on l.series_id = s.id and l.source = 'goodreads'
    where not exists (select 1 from source_links r where r.series_id = s.id and r.source = 'royalroad')
      and (
        s.description is null or length(s.description) < 40
        or s.cover_url is null or s.cover_url not like '%/storage/v1/object/public/covers/%'
      )
    order by s.popularity desc`);

  console.log(`${rows.length} non-RR books need a synopsis and/or cover...`);
  let desc = 0;
  let cover = 0;
  let fail = 0;

  for (const [i, r] of rows.entries()) {
    try {
      // Wait for the description to hydrate when we still need it (book body is
      // client-rendered); covers come from SSR meta tags and need no wait.
      const html = await fetchGoodreads(
        r.url,
        r.needsDesc
          ? '[data-testid="description"] .Formatted, .BookPageMetadataSection__description'
          : undefined,
      );
      const $ = cheerio.load(html);

      if (r.needsDesc) {
        const d = extractDescription(html);
        if (d) {
          await db.update(schema.series).set({ description: d }).where(eq(schema.series.id, r.id));
          desc++;
        }
      }

      if (r.needsCover) {
        const og = $('meta[property="og:image"]').attr("content");
        if (og) {
          const url = await hostCover(r.id, og);
          await db.update(schema.series).set({ coverUrl: url }).where(eq(schema.series.id, r.id));
          cover++;
        }
      }
    } catch (e) {
      fail++;
      if (fail <= 15) console.warn(`  ✗ series ${r.id}: ${(e as Error).message}`);
    }
    if ((i + 1) % 25 === 0)
      console.log(`  ${i + 1}/${rows.length} (desc=${desc}, cover=${cover}, fail=${fail})`);
  }

  console.log(`\nDone. descriptions=${desc}, covers=${cover}, failed=${fail}`);
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
