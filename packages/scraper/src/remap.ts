// Re-canonicalize every stored RR raw record (no network) — used to backfill
// taxonomy/facet mappings onto existing series after the mapping changes.
import "./env";
import { eq } from "drizzle-orm";
import { client, db, schema } from "./db";
import { canonicalize } from "./royalroad/canonicalize";
import type { RoyalRoadFiction } from "./royalroad/parse";

async function main() {
  const rows = await db
    .select({ payload: schema.rawRecords.payload })
    .from(schema.rawRecords)
    .where(eq(schema.rawRecords.source, "royalroad"));

  console.log(`Re-canonicalizing ${rows.length} raw records...`);
  let n = 0;
  for (const r of rows) {
    await canonicalize(r.payload as RoyalRoadFiction);
    n++;
  }
  console.log(`Done: ${n} series re-canonicalized.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => client.end());
