import "./env";
import { client } from "./db";
import { canonicalize } from "./royalroad/canonicalize";
import { fetchHtml } from "./royalroad/client";
import { enumerateList, type ListItem } from "./royalroad/enumerate";
import { parseFiction } from "./royalroad/parse";

const MIN_FOLLOWERS = 1000;
const MAX_PAGES = Number(process.env.RR_MAX_PAGES ?? 60);
// Sweep several Royal Road lists for broad coverage; the canonicalizer dedupes
// by RR external id, so overlap between lists is harmless.
const LISTS = (
  process.env.RR_LISTS ??
  "/fictions/best-rated,/fictions/active-popular,/fictions/weekly-popular,/fictions/trending,/fictions/complete"
)
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

async function main() {
  const eligible = new Map<string, ListItem>();
  for (const list of LISTS) {
    console.log(`\nEnumerating ${list} (<=${MAX_PAGES} pages, followers >= ${MIN_FOLLOWERS})...`);
    const items = await enumerateList(list, { maxPages: MAX_PAGES, minFollowers: MIN_FOLLOWERS });
    for (const it of items) if (!eligible.has(it.externalId)) eligible.set(it.externalId, it);
    console.log(`  ${list}: ${items.length} eligible (${eligible.size} unique total)`);
  }

  const all = [...eligible.values()];
  console.log(`\n${all.length} unique eligible fictions. Fetching details...\n`);

  let created = 0;
  let updated = 0;
  let failed = 0;

  for (const [i, item] of all.entries()) {
    const pos = `[${i + 1}/${all.length}]`;
    try {
      const html = await fetchHtml(`/fiction/${item.externalId}`);
      const fiction = parseFiction(html, `https://www.royalroad.com/fiction/${item.externalId}`);
      const { created: isNew } = await canonicalize(fiction);
      if (isNew) created++;
      else updated++;
      if ((i + 1) % 25 === 0 || isNew) {
        console.log(
          `  ${pos} ${isNew ? "+" : "~"} ${fiction.title} (${fiction.followers} followers)`,
        );
      }
    } catch (e) {
      failed++;
      console.warn(`  ${pos} ✗ ${item.externalId}: ${(e as Error).message}`);
    }
  }

  console.log(`\nDone. created=${created}, updated=${updated}, failed=${failed}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => client.end());
