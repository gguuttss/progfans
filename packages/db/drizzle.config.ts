import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

// Loaded from the monorepo root .env (cwd is packages/db when drizzle-kit runs).
config({ path: "../../.env" });

const url = process.env.DIRECT_URL;
if (!url) throw new Error("DIRECT_URL is not set (see .env)");

export default defineConfig({
  schema: "./src/schema/index.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url },
  casing: "snake_case",
  strict: true,
  verbose: true,
});
