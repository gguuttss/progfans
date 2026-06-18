import postgres from "postgres";

// One-off migration: add the precomputed tier-score column.
// DDL needs the session connection (DIRECT_URL). max:1 keeps the SETs and the
// ALTER on the same connection; a short lock_timeout + retries lets the ALTER
// slip in between the live read traffic that holds the table lock.
const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!url) throw new Error("DIRECT_URL / DATABASE_URL not set");
const sql = postgres(url, { prepare: false, max: 1 });

await sql`set statement_timeout = '300s'`;
await sql`set lock_timeout = '15s'`;

for (let attempt = 1; attempt <= 6; attempt++) {
  try {
    await sql`alter table series add column if not exists tier_score real`;
    console.log("tier_score column ready");
    break;
  } catch (e) {
    const code = e?.code;
    if ((code === "55P03" || code === "57014") && attempt < 6) {
      console.log(`table busy (lock), retry ${attempt}/5…`);
      await new Promise((r) => setTimeout(r, 4000));
      continue;
    }
    throw e;
  }
}

await sql.end();
