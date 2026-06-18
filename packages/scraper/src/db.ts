import * as schema from "@progfans/db/schema";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

// Requires DATABASE_URL — import "./env" before this module.
const client = postgres(process.env.DATABASE_URL!, { prepare: false });
export const db = drizzle(client, { schema, casing: "snake_case" });
export { client, schema };
