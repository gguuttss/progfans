// Export series (+ their books + current tropes) into chunk files for sub-agent
// title/synopsis rewriting and re-tagging. Also writes taxonomy.json (the trope
// vocabulary the agents pick from). Each chunk is JSON:
//   [{ id, title, description, tropes:[slug], books:[{id,title,description}] }]
// Run: pnpm --filter @progfans/scraper export:rewrite [--chunk 25] [--ids 1,2,3]
import "../env";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { sql } from "drizzle-orm";
import { client, db } from "../db";

const OUT_DIR = new URL("./data/", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const arg = (name: string): string | undefined => {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
};

async function main() {
  const chunkSize = Number(arg("--chunk") ?? 25);
  const idsArg = arg("--ids");
  const ids = idsArg ? idsArg.split(",").map((s) => Number(s.trim())) : null;
  const filter = ids && ids.length ? sql`and s.id in ${ids}` : sql``;

  const tx = await db.execute<Record<string, unknown>>(
    sql`select slug, name, category from tropes order by category, name`,
  );

  const rows = await db.execute<Record<string, unknown>>(sql`
    select s.id, s.title, s.description,
      coalesce((
        select json_agg(t.slug order by t.slug)
        from series_tropes st join tropes t on t.id = st.trope_id
        where st.series_id = s.id
      ), '[]'::json) as tropes,
      coalesce((
        select json_agg(json_build_object('id', b.id, 'title', b.title, 'description', b.description)
                        order by b.position nulls last, b.id)
        from books b where b.series_id = s.id
      ), '[]'::json) as books
    from series s
    where s.description is not null and length(s.description) >= 20 ${filter}
    order by s.id`);

  rmSync(OUT_DIR, { recursive: true, force: true });
  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(`${OUT_DIR}taxonomy.json`, JSON.stringify(tx, null, 0));

  let n = 0;
  for (let i = 0; i < rows.length; i += chunkSize) {
    writeFileSync(
      `${OUT_DIR}chunk-${String(n).padStart(3, "0")}.json`,
      JSON.stringify(rows.slice(i, i + chunkSize), null, 0),
    );
    n++;
  }
  console.log(
    `exported ${rows.length} series into ${n} chunk(s) of ${chunkSize}; ` +
      `taxonomy = ${tx.length} tropes; dir = ${OUT_DIR}`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => client.end());
