// Recompute every series' Goodreads rating from its books — pure DB, no scrape.
// VALUE = vote-weighted average of per-book ratings; COUNT = max per-book votes
// (≈ book 1; summing would double-count the same readers). Run this whenever the
// rollup formula changes — the per-book data already lives in book_ratings.
import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL, { prepare: false });

const rated = await sql`
  insert into series_ratings (series_id, source, value, votes)
  select b.series_id, 'goodreads',
    round(sum(br.value * br.votes) / nullif(sum(br.votes), 0), 2), max(br.votes)
  from book_ratings br join books b on b.id = br.book_id
  where br.source = 'goodreads' and br.votes > 0
  group by b.series_id
  on conflict (series_id, source) do update set
    value = excluded.value, votes = excluded.votes, fetched_at = now()
  returning series_id`;

await sql`
  insert into series_popularity (series_id, source, value)
  select b.series_id, 'goodreads', max(br.votes)
  from book_ratings br join books b on b.id = br.book_id
  where br.source = 'goodreads'
  group by b.series_id
  on conflict (series_id, source) do update set value = excluded.value, fetched_at = now()`;

console.log(`recomputed GR rollup for ${rated.length} series`);
await sql.end();
