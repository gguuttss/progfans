// Idempotent trope seeder: `pnpm --filter @progfans/db seed`
import { config } from "dotenv";
config({ path: "../../.env" });

import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { tropes } from "../schema/catalog";
import { TROPE_SEED } from "./tropes";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set (see .env)");

const client = postgres(url, { prepare: false });
const db = drizzle(client, { casing: "snake_case" });

async function main() {
  await db
    .insert(tropes)
    .values(TROPE_SEED)
    .onConflictDoUpdate({
      target: tropes.slug,
      set: {
        name: sql`excluded.name`,
        category: sql`excluded.category`,
        description: sql`excluded.description`,
      },
    });

  const [row] = await db.select({ count: sql<number>`count(*)::int` }).from(tropes);
  console.log(`✅ Seeded ${TROPE_SEED.length} tropes. Total in DB: ${row?.count}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => client.end());
