// Shared Goodreads book helpers used by build / refresh / add. No top-level
// side effects so it's safe to import anywhere.
import { sql } from "drizzle-orm";
import { db } from "../db";
import { fetchGoodreads } from "../goodreads/browser";
import { type GrBook, parseBookPage } from "../goodreads/parse-book";

export type Row = Record<string, unknown>;

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
export const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
export const grIdFromUrl = (url: string): string | null =>
  url.match(/\/book\/show\/(\d+)/)?.[1] ?? null;

export async function exec(q: ReturnType<typeof sql>): Promise<Row[]> {
  return db.execute<Row>(q);
}

// Goodreads sometimes returns a half-hydrated page; retry until it parses.
export async function fetchBook(grId: string): Promise<GrBook | null> {
  for (let i = 0; i < 4; i++) {
    const b = parseBookPage(
      await fetchGoodreads(
        `https://www.goodreads.com/book/show/${grId}`,
        '[data-testid="description"] .Formatted',
      ),
    );
    if (b?.title) return b;
    await sleep(1500);
  }
  return null;
}

// Fold one series entry into another: move user refs, fill gaps, carry links.
export async function mergeInto(winner: number, loser: number): Promise<void> {
  await exec(sql`update list_entries le set series_id=${winner} where le.series_id=${loser}
    and not exists (select 1 from list_entries x where x.user_id=le.user_id and x.series_id=${winner})`);
  await exec(sql`delete from list_entries where series_id=${loser}`);
  await exec(sql`update profile_favorites f set series_id=${winner} where f.series_id=${loser}
    and not exists (select 1 from profile_favorites x where x.user_id=f.user_id and x.series_id=${winner})`);
  await exec(sql`delete from profile_favorites where series_id=${loser}`);
  await exec(sql`update tier_list_items i set series_id=${winner} where i.series_id=${loser}
    and not exists (select 1 from tier_list_items x where x.tier_list_id=i.tier_list_id and x.series_id=${winner})`);
  await exec(sql`delete from tier_list_items where series_id=${loser}`);
  await exec(sql`update series w set
      cover_url=coalesce(w.cover_url,l.cover_url),
      first_published_at=coalesce(w.first_published_at,l.first_published_at),
      has_ebook=w.has_ebook or l.has_ebook, has_audio=w.has_audio or l.has_audio,
      has_ku=w.has_ku or l.has_ku, updated_at=now()
    from series l where w.id=${winner} and l.id=${loser}`);
  await exec(sql`insert into series_tropes (series_id, trope_id, source, confidence)
    select ${winner}, trope_id, source, confidence from series_tropes where series_id=${loser}
    on conflict (series_id, trope_id) do nothing`);
  await exec(sql`insert into source_links (series_id, source, url, external_id, is_affiliate)
    select ${winner}, source, url, external_id, is_affiliate from source_links where series_id=${loser}
    on conflict (series_id, source) do nothing`);
  await exec(sql`delete from series where id=${loser}`);
}

// Full upsert of a book (title, synopsis, cover, links, rating) — for build/add.
export async function upsertBook(seriesId: number, position: number, b: GrBook): Promise<void> {
  const [row] = await exec(sql`
    insert into books (series_id, title, position, description, cover_url, first_published_at, goodreads_id)
    values (${seriesId}, ${b.title}, ${position}, ${b.description}, ${b.coverUrl},
            ${b.firstPublishedAt}, ${b.grId})
    on conflict (goodreads_id) do update set
      series_id=excluded.series_id, title=excluded.title, position=excluded.position,
      description=excluded.description, cover_url=excluded.cover_url,
      first_published_at=excluded.first_published_at, updated_at=now()
    returning id`);
  if (!row) throw new Error(`book upsert returned no row for GR ${b.grId}`);
  const bookId = Number(row.id);
  const grUrl = `https://www.goodreads.com/book/show/${b.grId}`;
  await exec(sql`insert into book_links (book_id, source, url, external_id)
    values (${bookId}, 'goodreads', ${grUrl}, ${b.grId})
    on conflict (book_id, source) do update set url=excluded.url, external_id=excluded.external_id`);
  if (b.ratingValue != null) {
    await exec(sql`insert into book_ratings (book_id, source, value, votes)
      values (${bookId}, 'goodreads', ${b.ratingValue}, ${b.ratingVotes})
      on conflict (book_id, source) do update set value=excluded.value, votes=excluded.votes, fetched_at=now()`);
  }
}

/**
 * REFRESH a book: if it already exists (by goodreads_id) update ONLY its rating
 * (curated title/synopsis/cover/position are preserved); if it's new, insert it
 * in full. Returns whether it was "added" or "updated".
 */
export async function refreshBook(
  seriesId: number,
  position: number,
  b: GrBook,
): Promise<"added" | "updated"> {
  const [existing] = await exec(sql`select id from books where goodreads_id = ${b.grId}`);
  if (existing) {
    if (b.ratingValue != null) {
      const bookId = Number(existing.id);
      await exec(sql`insert into book_ratings (book_id, source, value, votes)
        values (${bookId}, 'goodreads', ${b.ratingValue}, ${b.ratingVotes})
        on conflict (book_id, source) do update set value=excluded.value, votes=excluded.votes, fetched_at=now()`);
    }
    return "updated";
  }
  await upsertBook(seriesId, position, b);
  return "added";
}

// Roll per-book GR ratings into a vote-weighted series rating; review count = max.
export async function rollUp(seriesId: number): Promise<void> {
  await exec(sql`
    insert into series_ratings (series_id, source, value, votes)
    select ${seriesId}, 'goodreads',
      round(sum(value * votes) / nullif(sum(votes), 0), 2), max(votes)
    from book_ratings br join books b on b.id = br.book_id
    where b.series_id = ${seriesId} and br.source = 'goodreads' and br.votes > 0
    on conflict (series_id, source) do update set value=excluded.value, votes=excluded.votes, fetched_at=now()`);
  await exec(sql`
    insert into series_popularity (series_id, source, value)
    select ${seriesId}, 'goodreads', max(votes)
    from book_ratings br join books b on b.id = br.book_id
    where b.series_id = ${seriesId} and br.source = 'goodreads'
    on conflict (series_id, source) do update set value=excluded.value, fetched_at=now()`);
}
