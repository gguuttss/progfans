// Self-host BOOK cover images (download external Goodreads/Amazon covers into
// our Supabase Storage bucket and rewrite books.cover_url), then point each
// multi-book series at its first book's now-hosted cover.
// Resumable: skips covers already on our storage. Run after refresh:gr.
// Run: pnpm --filter @progfans/scraper host:book-covers
import "../env";
import { sql } from "drizzle-orm";
import { client, db } from "../db";
import { hostCover } from "./host";

const CONCURRENCY = 8;
const HOSTED = "%/storage/v1/object/public/covers/%";

async function main() {
  // 1) Host every external book cover.
  const books = await db.execute<{ id: number; cover_url: string }>(sql`
    select id, cover_url from books
    where cover_url is not null and cover_url not like ${HOSTED}
    order by id`);

  console.log(`Hosting ${books.length} book covers (concurrency ${CONCURRENCY})...`);
  let ok = 0;
  let fail = 0;
  for (let i = 0; i < books.length; i += CONCURRENCY) {
    await Promise.all(
      books.slice(i, i + CONCURRENCY).map(async (b) => {
        try {
          const url = await hostCover(`book-${b.id}`, String(b.cover_url));
          await db.execute(sql`update books set cover_url = ${url} where id = ${b.id}`);
          ok++;
        } catch (e) {
          fail++;
          if (fail <= 15) console.warn(`  ✗ book ${b.id}: ${(e as Error).message}`);
        }
      }),
    );
    if (i % (CONCURRENCY * 25) === 0)
      console.log(`  ${ok + fail}/${books.length} (ok=${ok}, fail=${fail})`);
  }
  console.log(`book covers: hosted=${ok}, failed=${fail}`);

  // 2) Multi-book series → use the first (hosted) book's cover as the series cover.
  const updated = await db.execute(sql`
    update series s set cover_url = fb.cover_url, updated_at = now()
    from (
      select distinct on (series_id) series_id, cover_url
      from books
      where cover_url like ${HOSTED}
      order by series_id, position nulls last, id
    ) fb
    where fb.series_id = s.id
      and (select count(*) from books b where b.series_id = s.id) >= 2
      and s.cover_url is distinct from fb.cover_url
    returning s.id`);
  console.log(`series covers set to first book: ${updated.length}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => client.end());
