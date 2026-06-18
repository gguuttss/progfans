// Standalone connectivity check: `pnpm --filter @progfans/db exec tsx src/check.ts`
import { config } from "dotenv";
config({ path: "../../.env" });

import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set (see .env)");

const sql = postgres(url, { prepare: false });

try {
  const [row] = await sql`select version() as version`;
  console.log("✅ Connected to Postgres:");
  console.log("  ", row?.version);
} finally {
  await sql.end();
}
