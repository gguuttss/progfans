// Import a Goodreads Listopia list (default: "Best LitRPG books ALL", 127417).
// This is how non-Royal-Road, published-first books enter the catalog.
// Run: pnpm --filter @progfans/scraper import:gr-list
import "../env";
import { client } from "../db";
import { sleep } from "../royalroad/util";
import { upsertExternalSeries } from "../external/upsert";
import { closeBrowser, fetchGoodreads } from "./browser";
import { cleanGrTitle, parseSearchResults } from "./search";

const LIST_ID = process.env.GR_LIST ?? "127417";
const MAX_PAGES = Number(process.env.GR_LIST_PAGES ?? 20);

async function main() {
  let created = 0;
  let matched = 0;

  for (let page = 1; page <= MAX_PAGES; page++) {
    const url = `https://www.goodreads.com/list/show/${LIST_ID}?page=${page}`;
    const results = parseSearchResults(await fetchGoodreads(url));
    if (results.length === 0) {
      console.log(`page ${page}: empty — stopping.`);
      break;
    }

    let pageNew = 0;
    for (const r of results) {
      if (r.rating == null || r.votes < 1) continue;
      const grId = (r.url.match(/show\/(\d+)/) ?? [])[1] ?? null;
      const { created: isNew } = await upsertExternalSeries({
        title: cleanGrTitle(r.title),
        authors: r.author ? [r.author] : [],
        coverUrl: r.cover,
        hasEbook: true,
        popularity: r.votes,
        ratings: [{ source: "goodreads", value: r.rating!, votes: r.votes }],
        links: r.url ? [{ source: "goodreads", url: r.url, externalId: grId }] : [],
      });
      if (isNew) {
        created++;
        pageNew++;
      } else {
        matched++;
      }
    }
    console.log(
      `page ${page}: ${results.length} books (+${pageNew} new; ${created} new / ${matched} matched total)`,
    );
    await sleep(800);
  }

  console.log(`\nListopia ${LIST_ID} done. created=${created}, matched existing=${matched}`);
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
