// Side-effect module: load the monorepo-root .env BEFORE anything reads it.
// Import this first in every entrypoint.
import { config } from "dotenv";

config({ path: "../../.env" });
