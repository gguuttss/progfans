// Merge split duplicates: a published (non-RR) series whose title starts with
// an RR series' title AND shares a fuzzy-matching author is the same series.
// Dry-run by default; pass --apply to merge.
// Run: pnpm --filter @progfans/scraper dedup           (report)
//      pnpm --filter @progfans/scraper dedup -- --apply (merge)
import "../env";
import { sql } from "drizzle-orm";
import { client, db } from "../db";
import { authorSimilar } from "../goodreads/search";
import { normTitle } from "./upsert";

const APPLY = process.argv.includes("--apply");

async function authorsOf(id: number | string): Promise<string[]> {
  const rows = await db.execute<{ name: string }>(
    sql`select a.name from authors a join series_authors sa on sa.author_id = a.id where sa.series_id = ${id}`,
  );
  return rows.map((r) => r.name);
}

async function mergeInto(rrId: number, nrId: number): Promise<void> {
  // Move ratings + links from the duplicate onto the RR series.
  // Keep the RR series' canonical (book-1) rating/link; only fill what's missing.
  await db.execute(sql`
    insert into series_ratings (series_id, source, value, votes, fetched_at)
    select ${rrId}, source, value, votes, fetched_at from series_ratings where series_id = ${nrId}
    on conflict (series_id, source) do nothing`);
  await db.execute(sql`
    insert into source_links (series_id, source, url, external_id, is_affiliate)
    select ${rrId}, source, url, external_id, is_affiliate from source_links where series_id = ${nrId}
    on conflict (series_id, source) do nothing`);
  await db.execute(sql`
    insert into series_popularity (series_id, source, value, fetched_at)
    select ${rrId}, source, value, fetched_at from series_popularity where series_id = ${nrId}
    on conflict (series_id, source) do nothing`);
  // Fill gaps on the RR series from the published one.
  await db.execute(sql`
    update series r set
      cover_url = coalesce(r.cover_url, n.cover_url),
      first_published_at = coalesce(r.first_published_at, n.first_published_at),
      has_ebook = r.has_ebook or n.has_ebook,
      has_audio = r.has_audio or n.has_audio
    from series n where r.id = ${rrId} and n.id = ${nrId}`);
  await db.execute(sql`delete from series where id = ${nrId}`);
}

async function main() {
  const pairs = await db.execute<Record<string, unknown>>(sql`
    with norm as (
      select id, title, eligibility_status,
        regexp_replace(lower(title), '[^a-z0-9]', '', 'g') as nt
      from series
    )
    select r.id as base_id, r.title as base_title, r.eligibility_status as base_elig,
           n.id as dup_id, n.title as dup_title
    from norm r
    join norm n
      on r.eligibility_status in ('eligible', 'manual_include')
      and n.eligibility_status = 'manual_include'
      and r.id <> n.id
      and length(r.nt) >= 4
      and length(n.nt) > length(r.nt)
      and n.nt like r.nt || '%'`);

  const merges: { rrId: number; rrTitle: string; nrId: number; nrTitle: string }[] = [];
  for (const p of pairs) {
    const baseTitle = String(p.base_title);
    const dupTitle = String(p.dup_title);
    const [ba, da] = await Promise.all([
      authorsOf(p.base_id as number),
      authorsOf(p.dup_id as number),
    ]);
    if (!ba.some((x) => da.some((y) => authorSimilar(x, y)))) continue;

    // For an RR base, a subtitle (e.g. "Elydes: A New Dawn") is fine. For a
    // non-RR base, only merge if the extra part is a book number — so we don't
    // fuse two distinct same-author series ("Mage" vs "Mage Errant").
    if (p.base_elig !== "eligible") {
      const suffix = normTitle(dupTitle).slice(normTitle(baseTitle).length);
      if (!/^([0-9]|book|vol|part)/.test(suffix)) continue;
    }

    merges.push({
      rrId: Number(p.base_id),
      rrTitle: baseTitle.trim(),
      nrId: Number(p.dup_id),
      nrTitle: dupTitle.trim(),
    });
  }

  console.log(`${pairs.length} prefix candidates; ${merges.length} confirmed by author match:\n`);
  for (const m of merges) {
    console.log(`  RR[${m.rrId}] "${m.rrTitle}"  <-  NR[${m.nrId}] "${m.nrTitle}"`);
  }

  if (APPLY) {
    for (const m of merges) await mergeInto(m.rrId, m.nrId);
    console.log(`\n✅ merged ${merges.length} duplicates into their RR series.`);
  } else {
    console.log(`\n(dry run — re-run with \`-- --apply\` to merge)`);
  }

  await client.end();
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => client.end());
