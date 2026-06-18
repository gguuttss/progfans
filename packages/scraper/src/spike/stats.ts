import "../env";
import { sql } from "drizzle-orm";
import { client, db } from "../db";

async function main() {
  const counts = await db.execute(sql`
    select
      (select count(*) from series) as series,
      (select count(*) from authors) as authors,
      (select count(*) from source_links) as links,
      (select count(*) from series_ratings) as ratings,
      (select count(*) from raw_records) as raw`);
  console.log("counts:", counts[0]);

  const byStatus = await db.execute(sql`
    select status, count(*)::int as n from series group by status order by n desc`);
  console.log("by status:", byStatus.map((r) => `${r.status}=${r.n}`).join(", "));

  const unknown = await db.execute(sql`
    select s.id, s.title, l.external_id
    from series s join source_links l on l.series_id = s.id
    where s.status = 'unknown' limit 3`);
  console.log("sample unknown-status:", unknown);

  const top = await db.execute(sql`
    select s.title, s.popularity, r.value as rr_rating, r.votes
    from series s left join series_ratings r on r.series_id = s.id and r.source = 'royalroad'
    order by s.popularity desc limit 5`);
  console.log("top by popularity:");
  for (const t of top) console.log(`  ${t.popularity}f  ${t.rr_rating}/5 (${t.votes})  ${t.title}`);

  const [gr] = await db.execute(
    sql`select count(*)::int as n from series_ratings where source = 'goodreads'`,
  );
  console.log("\ngoodreads ratings:", gr!.n, "of 96");
  const cmp = await db.execute(sql`
    select s.title,
      max(r.value) filter (where r.source = 'royalroad') as rr,
      max(r.value) filter (where r.source = 'goodreads') as gr,
      max(r.votes) filter (where r.source = 'goodreads') as gr_votes
    from series s join series_ratings r on r.series_id = s.id
    group by s.id, s.title, s.popularity
    having max(r.value) filter (where r.source = 'goodreads') is not null
    order by s.popularity desc limit 8`);
  console.log("RR vs GR (top with GR):");
  for (const r of cmp) console.log(`  RR ${r.rr} | GR ${r.gr} (${r.gr_votes})  ${r.title}`);

  await client.end();
}
main();
