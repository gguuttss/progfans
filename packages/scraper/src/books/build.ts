// Build the books table for a Goodreads series: group our duplicate series
// entries, merge them into one canonical series, and populate books +
// book_links + book_ratings from each real book's GR page. Finally roll the
// per-book GR ratings up into a vote-weighted series rating.
//
// Dry run:  pnpm --filter @progfans/scraper exec tsx src/books/build.ts unsouled dungeon-crawler-carl
// Apply:    pnpm --filter @progfans/scraper exec tsx src/books/build.ts unsouled -- --apply
import "../env";
import { sql } from "drizzle-orm";
import { client } from "../db";
import { closeBrowser, fetchGoodreads } from "../goodreads/browser";
import { type GrBook, parseSeriesPage } from "../goodreads/parse-book";
import { authorSimilar } from "../goodreads/search";
import {
  exec,
  fetchBook,
  grIdFromUrl,
  mergeInto,
  norm,
  type Row,
  rollUp,
  upsertBook,
} from "./core";

const ALL = process.argv.includes("--all");
const APPLY = process.argv.includes("--apply") || ALL;
const slugs = process.argv.slice(2).filter((a) => !a.startsWith("-"));

type Status = "built" | "standalone" | "skipped";

async function buildOne(slug: string, skipIfBuilt = false): Promise<Status> {
  const [target] = await exec(sql`
    select s.id, s.title, l.url from series s
    join source_links l on l.series_id=s.id and l.source='goodreads' where s.slug=${slug} limit 1`);
  if (!target) return "skipped"; // merged away, or no GR link anymore

  // Resume support: a canonical that already has books was built on a prior pass.
  if (skipIfBuilt) {
    const [bc] = await exec(sql`select count(*)::int as n from books where series_id=${target.id}`);
    if (Number(bc?.n ?? 0) > 0) return "skipped";
  }

  console.log(`\n#### ${slug} ####`);

  // 1. The target's book page → which GR series it belongs to.
  const targetId = grIdFromUrl(String(target.url));
  const tb = targetId ? await fetchBook(targetId) : null;
  if (!tb?.seriesUrl) {
    console.log(`  "${target.title}" — not part of a GR series`);
    return "standalone";
  }

  // 2. The series page → real numbered books + every item id.
  const { realBooks, allItemIds } = parseSeriesPage(
    await fetchGoodreads(tb.seriesUrl, 'a[href*="/book/show/"]'),
  );

  // 3. Our series belonging to this GR series (id-match, GR-series-name, target).
  const allLinks = await exec(sql`
    select s.id, s.title, l.url,
      (select count(*)::int from series_tropes where series_id=s.id) as tropes,
      (select coalesce(string_agg(a.name, '||'), '')
       from series_authors sa join authors a on a.id=sa.author_id where sa.series_id=s.id) as authors
    from series s join source_links l on l.series_id=s.id and l.source='goodreads'`);
  const idSet = new Set(allItemIds);
  const seriesNorm = norm(tb.seriesName ?? "");
  const inGroup = (r: Row): boolean => {
    const id = grIdFromUrl(String(r.url));
    return (
      Number(r.id) === Number(target.id) ||
      (id != null && idSet.has(id)) ||
      norm(String(r.title)) === seriesNorm
    );
  };
  const group = allLinks.filter(inGroup);

  // 4. Canonical = title is the GR series name; else the target; else richest.
  const canonical =
    group.find((r) => norm(String(r.title)) === seriesNorm) ??
    group.find((r) => Number(r.id) === Number(target.id)) ??
    group
      .slice()
      .sort((a, b) => Number(b.tropes) - Number(a.tropes) || Number(a.id) - Number(b.id))[0];
  if (!canonical) return "skipped";
  const canonId = Number(canonical.id);
  const idMerges = group.filter((r) => Number(r.id) !== canonId);

  if (!APPLY) {
    console.log(
      `  GR "${tb.seriesName}": ${realBooks.length} books, canonical [${canonId}] "${canonical.title}", id/name merges ${idMerges.length}`,
    );
    return "built";
  }

  // 5. Fetch each real book page (for population + title-matching).
  const books: { pos: number; b: GrBook }[] = [];
  for (const rb of realBooks) {
    const b = await fetchBook(rb.grId);
    if (b) books.push({ pos: rb.position, b });
  }

  // 6. Second pass: edition-mismatched entries matched by a real book title —
  //    GUARDED by a shared author so common titles ("Reaper") can't false-merge.
  const bookTitles = new Set(books.map((x) => norm(x.b.title)));
  const canonAuthors = String(canonical.authors).split("||").filter(Boolean);
  const titleMerges = allLinks.filter((r) => {
    if (Number(r.id) === canonId || group.some((g) => g.id === r.id)) return false;
    if (!bookTitles.has(norm(String(r.title)))) return false;
    const cand = String(r.authors).split("||").filter(Boolean);
    return cand.some((x) => canonAuthors.some((y) => authorSimilar(x, y)));
  });

  // 7. Merge into the canonical, adopt the GR name, point GR link at the series.
  for (const l of [...idMerges, ...titleMerges]) await mergeInto(canonId, Number(l.id));
  await exec(sql`update series set title=${tb.seriesName}, updated_at=now() where id=${canonId}`);
  await exec(sql`insert into source_links (series_id, source, url) values (${canonId}, 'goodreads', ${tb.seriesUrl})
    on conflict (series_id, source) do update set url=excluded.url`);

  // 8. Upsert books + roll up the vote-weighted series GR rating.
  for (const { pos, b } of books) await upsertBook(canonId, pos, b);
  await rollUp(canonId);

  console.log(
    `  "${tb.seriesName}" [${canonId}]: ${books.length} books, merged ${idMerges.length + titleMerges.length}`,
  );
  return "built";
}

async function main() {
  if (ALL) {
    const targets = await exec(sql`
      select s.slug from series s join source_links l on l.series_id=s.id and l.source='goodreads'
      order by s.id`);
    console.log(`FULL RUN over ${targets.length} GR-linked series\n`);
    const c = { built: 0, standalone: 0, skipped: 0, errors: 0 };
    for (let i = 0; i < targets.length; i++) {
      const t = targets[i];
      if (!t) continue;
      try {
        c[await buildOne(String(t.slug), true)]++;
      } catch (e) {
        c.errors++;
        console.log(`  ! ERROR ${t.slug}: ${(e as Error).message}`);
      }
      if ((i + 1) % 25 === 0)
        console.log(
          `\n===== ${i + 1}/${targets.length} | built ${c.built} · standalone ${c.standalone} · skipped ${c.skipped} · errors ${c.errors} =====\n`,
        );
    }
    console.log(
      `\nDONE — built ${c.built} · standalone ${c.standalone} · skipped ${c.skipped} · errors ${c.errors}`,
    );
  } else if (slugs.length) {
    console.log(APPLY ? "APPLY mode\n" : "DRY RUN (pass -- --apply to write)\n");
    for (const slug of slugs) await buildOne(slug);
  } else {
    console.log("usage: build.ts <series-slug...> [-- --apply]   |   build.ts --all");
  }
  await closeBrowser();
  await client.end();
}

main().catch(async (e) => {
  console.error(e);
  await closeBrowser();
  await client.end();
  process.exitCode = 1;
});
