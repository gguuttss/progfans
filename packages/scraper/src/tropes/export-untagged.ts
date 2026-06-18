// Export non-RR books that have a synopsis but no tropes yet, split into
// chunk files for parallel sub-agent tagging. Each chunk is JSON:
//   [{ "id": 123, "title": "...", "synopsis": "..." }, ...]
// Run: pnpm --filter @progfans/scraper export:untagged [chunkSize]
import "../env";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { sql } from "drizzle-orm";
import { client, db } from "./../db";

const OUT_DIR = new URL("./data/", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");

async function main() {
  const chunkSize = Number(process.argv[2] ?? 40);

  const rows = await db.execute<{ id: number; title: string; synopsis: string }>(sql`
    select s.id, s.title, left(s.description, 700) as synopsis
    from series s
    where not exists (select 1 from source_links r where r.series_id = s.id and r.source = 'royalroad')
      and s.description is not null and length(s.description) >= 40
      and not exists (select 1 from series_tropes t where t.series_id = s.id)
    order by s.id`);

  rmSync(OUT_DIR, { recursive: true, force: true });
  mkdirSync(OUT_DIR, { recursive: true });

  let n = 0;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const file = `${OUT_DIR}chunk-${String(n).padStart(3, "0")}.json`;
    writeFileSync(file, JSON.stringify(chunk, null, 0));
    n++;
  }

  console.log(
    `exported ${rows.length} untagged books into ${n} chunks of ${chunkSize} in ${OUT_DIR}`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => client.end());
