import * as schema from "@progfans/db/schema";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";

type Database = PostgresJsDatabase<typeof schema>;

let instance: Database | null = null;

// Lazy: importing this module must not require DATABASE_URL (so the build,
// which imports route modules, doesn't fail). The connection is created on
// first query, at request time. `prepare: false` is required by the pooler.
function getDb(): Database {
  if (!instance) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) throw new Error("DATABASE_URL is not set");
    // `prepare: false` is required by the transaction pooler. `idle_timeout`
    // is the key production setting — it releases connections when idle so they
    // don't accumulate (the bug we hit was the default idle_timeout: 0, never
    // releasing). `max: 10` allows a page's queries to run in parallel; the
    // pooler multiplexes across instances. If serverless fan-out ever pressures
    // the pooler limit, lower `max` or raise the Supabase tier.
    instance = drizzle(postgres(connectionString, { prepare: false, max: 10, idle_timeout: 20 }), {
      schema,
      casing: "snake_case",
    });
  }
  return instance;
}

export const db = new Proxy({} as Database, {
  get(_target, prop) {
    return Reflect.get(getDb(), prop);
  },
});

export { schema };
