// Self-host cover images: download external covers (Royal Road / Goodreads
// CDNs) into our Supabase Storage bucket and rewrite series.cover_url.
// Run: pnpm --filter @progfans/scraper host:covers
import "../env";
import { and, eq, isNotNull, notLike } from "drizzle-orm";
import { client, db, schema } from "../db";
import { hostCover } from "./host";

const CONCURRENCY = 8;

async function main() {
  const rows = await db
    .select({ id: schema.series.id, cover: schema.series.coverUrl })
    .from(schema.series)
    .where(
      and(
        isNotNull(schema.series.coverUrl),
        notLike(schema.series.coverUrl, "%/storage/v1/object/public/covers/%"),
      ),
    );

  console.log(`Hosting ${rows.length} external covers (concurrency ${CONCURRENCY})...`);
  let ok = 0;
  let fail = 0;

  for (let i = 0; i < rows.length; i += CONCURRENCY) {
    await Promise.all(
      rows.slice(i, i + CONCURRENCY).map(async (r) => {
        try {
          const url = await hostCover(r.id, r.cover!);
          await db.update(schema.series).set({ coverUrl: url }).where(eq(schema.series.id, r.id));
          ok++;
        } catch (e) {
          fail++;
          if (fail <= 15) console.warn(`  ✗ series ${r.id}: ${(e as Error).message}`);
        }
      }),
    );
    if (i % (CONCURRENCY * 25) === 0)
      console.log(`  ${ok + fail}/${rows.length} (ok=${ok}, fail=${fail})`);
  }

  console.log(`\nDone. hosted=${ok}, failed=${fail}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => client.end());
