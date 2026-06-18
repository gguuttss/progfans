// Add a requested series from a Royal Road and/or Goodreads link. RR provides
// rich metadata + tropes; GR provides the book list + per-book ratings. Give
// either or both — both attach to ONE series.
// Run: pnpm --filter @progfans/scraper add -- --rr <url> --gr <url>
import "./env";
import { sql } from "drizzle-orm";
import { exec, fetchBook, grIdFromUrl, rollUp, upsertBook } from "./books/core";
import { client } from "./db";
import { closeBrowser, fetchGoodreads } from "./goodreads/browser";
import { type GrBook, parseSeriesPage } from "./goodreads/parse-book";
import { canonicalize } from "./royalroad/canonicalize";
import { fetchHtml } from "./royalroad/client";
import { parseFiction } from "./royalroad/parse";
import { slugify } from "./royalroad/util";

const arg = (name: string): string | undefined => {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
};

async function createSeries(title: string): Promise<number> {
  const base = slugify(title);
  for (const slug of [base, `${base}-${Math.floor(Date.now() / 1000) % 100000}`]) {
    try {
      const [row] = await exec(sql`
        insert into series (slug, title, status, eligibility_status)
        values (${slug}, ${title}, 'unknown', 'manual_include') returning id`);
      if (row) return Number(row.id);
    } catch (e) {
      if ((e as { code?: string }).code === "23505") continue; // slug taken
      throw e;
    }
  }
  throw new Error(`could not create series for "${title}"`);
}

async function addRoyalRoad(rrUrl: string): Promise<{ seriesId: number; title: string }> {
  const id = rrUrl.match(/\/fiction\/(\d+)/)?.[1];
  if (!id) throw new Error(`bad Royal Road url: ${rrUrl}`);
  const f = parseFiction(
    await fetchHtml(`/fiction/${id}`),
    `https://www.royalroad.com/fiction/${id}`,
  );
  const { seriesId, created } = await canonicalize(f);
  console.log(`RR: ${created ? "created" : "updated"} “${f.title}” [${seriesId}]`);
  return { seriesId, title: f.title };
}

async function addGoodreads(
  grUrl: string,
  seriesId: number | null,
  rrTitle: string | null,
): Promise<void> {
  // Resolve the GR series page + name (input may be a book or a series url).
  let seriesUrl: string | undefined;
  let seriesName: string | undefined;
  let standalone: GrBook | null = null;

  if (/\/series\//.test(grUrl)) {
    seriesUrl = grUrl;
  } else {
    const grId = grIdFromUrl(grUrl);
    if (!grId) throw new Error(`bad Goodreads url: ${grUrl}`);
    const tb = await fetchBook(grId);
    if (!tb) throw new Error(`could not fetch Goodreads book ${grId}`);
    if (tb.seriesUrl) {
      seriesUrl = tb.seriesUrl;
      seriesName = tb.seriesName ?? undefined;
    } else {
      standalone = tb; // a one-off book, not part of a GR series
    }
  }

  let realBooks: { grId: string; position: number }[] = [];
  if (seriesUrl) {
    realBooks = parseSeriesPage(
      await fetchGoodreads(seriesUrl, 'a[href*="/book/show/"]'),
    ).realBooks;
    if (!seriesName && realBooks[0]) {
      const first = await fetchBook(realBooks[0].grId);
      seriesName = first?.seriesName ?? first?.title ?? undefined;
    }
  }

  // Make sure we have a series to attach to (create one if GR was given alone).
  let sid = seriesId;
  if (sid == null) {
    const t = rrTitle ?? seriesName ?? standalone?.title ?? "Untitled";
    sid = await createSeries(t);
    console.log(`GR: created series “${t}” [${sid}]`);
  }

  await exec(sql`insert into source_links (series_id, source, url)
    values (${sid}, 'goodreads', ${seriesUrl ?? grUrl})
    on conflict (series_id, source) do update set url = excluded.url`);

  if (standalone) {
    await upsertBook(sid, Number(standalone.position) || 1, standalone);
    console.log(`  + 1 book (“${standalone.title}”)`);
  } else {
    let n = 0;
    for (const rb of realBooks) {
      const b = await fetchBook(rb.grId);
      if (!b) continue;
      await upsertBook(sid, rb.position, b);
      n++;
    }
    console.log(`  + ${n} books`);
  }
  await rollUp(sid);
}

async function main() {
  const rrUrl = arg("--rr");
  const grUrl = arg("--gr");
  const seriesArg = arg("--series"); // attach GR to an existing series (fix bad GR data)
  if (!rrUrl && !grUrl) {
    console.log(
      "usage: add -- --rr <royalroad url> --gr <goodreads url>   (either or both)\n" +
        "       add -- --series <id> --gr <goodreads url>    (re-attach GR to an existing series)",
    );
    return;
  }

  let seriesId: number | null = seriesArg ? Number(seriesArg) : null;
  let title: string | null = null;
  if (rrUrl) {
    const r = await addRoyalRoad(rrUrl);
    seriesId = r.seriesId;
    title = r.title;
  }
  if (grUrl) await addGoodreads(grUrl, seriesId, title);

  console.log("\nDone.");
  await closeBrowser();
  await client.end();
}

main().catch(async (e) => {
  console.error(e);
  await closeBrowser();
  await client.end();
  process.exitCode = 1;
});
