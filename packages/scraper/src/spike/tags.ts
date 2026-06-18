import "../env";
import { sql } from "drizzle-orm";
import { client, db } from "../db";

const rows = await db.execute(sql`
  select tag->>'slug' as slug, tag->>'label' as label, count(*)::int as n
  from raw_records, jsonb_array_elements(payload->'tags') as tag
  where source = 'royalroad'
  group by 1, 2
  order by n desc, label`);

console.log(`distinct RR tags across the catalog: ${rows.length}\n`);
for (const r of rows) {
  console.log(`  ${String(r.n).padStart(3)}  ${String(r.slug).padEnd(28)} ${r.label}`);
}
await client.end();
