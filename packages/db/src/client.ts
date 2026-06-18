import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set — load the root .env before importing the db client.");
}

// `prepare: false` is required for Supabase's transaction-mode pooler; harmless on
// the direct connection used by migrations/scraper.
const queryClient = postgres(connectionString, { prepare: false });

export const db = drizzle(queryClient, { schema, casing: "snake_case" });
export { schema };
