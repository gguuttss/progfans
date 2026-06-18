// Import published litRPG from litrpg.lo5.me (GR ratings) — non-RR coverage.
// Run: pnpm --filter @progfans/scraper import:lo5
import "../env";
import * as cheerio from "cheerio";
import { client } from "../db";
import { type ExternalLink, type ExternalRating, upsertExternalSeries } from "../external/upsert";

const MIN_GR_VOTES = 250;

const toNum = (s: string): number | null => {
  const n = parseFloat((s || "").replace(/[^\d.]/g, ""));
  return Number.isNaN(n) ? null : n;
};
const toInt = (s: string): number => {
  const n = parseInt((s || "").replace(/[^\d]/g, ""), 10);
  return Number.isNaN(n) ? 0 : n;
};

async function main() {
  const html = await (
    await fetch("https://litrpg.lo5.me/", { headers: { "User-Agent": "Mozilla/5.0" } })
  ).text();
  const $ = cheerio.load(html);

  // Data table = the one with the most rows.
  const table = $(
    $("table")
      .toArray()
      .sort((a, b) => $(b).find("tr").length - $(a).find("tr").length)[0],
  );
  const rows = table.find("tr").toArray().slice(1); // drop header
  console.log(`lo5: ${rows.length} rows; importing those with >= ${MIN_GR_VOTES} GR ratings...`);

  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const tr of rows) {
    const $tr = $(tr);
    const c = $tr
      .find("td")
      .toArray()
      .map((td) => $(td).text().trim());
    if (c.length < 12) {
      skipped++;
      continue;
    }
    // Display + dedup by the SERIES name (col 3) when present — "Cradle", not
    // "Unsouled" — falling back to the book title for standalone works.
    const seriesName = (c[3] ?? "").trim();
    const title = seriesName || (c[1] ?? "");
    const grRating = toNum(c[4] ?? "");
    const audRating = toNum(c[5] ?? "");
    const nGR = toInt(c[7] ?? "");
    const nAud = toInt(c[9] ?? ""); // Audible rating count
    const pub = c[11] ?? "";

    if (!title || grRating == null || nGR < MIN_GR_VOTES) {
      skipped++;
      continue;
    }

    const links: ExternalLink[] = [];
    $tr.find("a").each((_, a) => {
      const href = $(a).attr("href") ?? "";
      if (href.includes("goodreads.com/book/show")) {
        links.push({
          source: "goodreads",
          url: href.split("?")[0]!,
          externalId: (href.match(/show\/(\d+)/) ?? [])[1] ?? null,
        });
      } else if (href.includes("amazon.")) {
        links.push({ source: "amazon", url: href });
      } else if (href.includes("audible.")) {
        links.push({ source: "audible", url: href });
      }
    });

    const ratings: ExternalRating[] = [{ source: "goodreads", value: grRating, votes: nGR }];
    if (audRating != null) ratings.push({ source: "audible", value: audRating, votes: nAud });

    const { created: isNew } = await upsertExternalSeries({
      title,
      authors: (c[2] ?? "")
        .split(/,|&/)
        .map((s) => s.trim())
        .filter(Boolean),
      firstPublishedAt: /^\d{4}$/.test(pub) ? `${pub}-01-01` : null,
      hasEbook: links.some((l) => l.source === "amazon"),
      hasAudio: links.some((l) => l.source === "audible"),
      popularity: nGR,
      ratings,
      links,
    });
    if (isNew) created++;
    else updated++;
  }

  console.log(
    `\nlo5 done. created=${created}, updated(matched existing)=${updated}, skipped=${skipped}`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => client.end());
