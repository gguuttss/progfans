import { pgEnum } from "drizzle-orm/pg-core";

// Series-level facets (single-select dropdowns in the UI).
export const seriesStatus = pgEnum("series_status", [
  "ongoing",
  "completed",
  "hiatus",
  "dropped",
  "stub", // RR: chapters pulled because the series got published elsewhere (affiliate signal)
  "unknown",
]);
export const pov = pgEnum("pov", ["single", "multiple"]);
export const mcGender = pgEnum("mc_gender", ["male", "female", "nonbinary", "ensemble"]);
export const progressionPace = pgEnum("progression_pace", ["slow", "moderate", "fast"]);
export const romance = pgEnum("romance", ["none", "subplot", "central"]);

// Catalog inclusion state.
export const eligibilityStatus = pgEnum("eligibility_status", [
  "eligible",
  "below_threshold",
  "manual_include",
  "excluded",
]);

// Controlled trope taxonomy grouping.
export const tropeCategory = pgEnum("trope_category", [
  "power_system",
  "setting",
  "progression",
  "protagonist",
  "tone",
  "relationships",
  "content_warning",
]);

// Where a trope assignment / rating / link originated.
export const tropeSource = pgEnum("trope_source", [
  "royalroad",
  "goodreads",
  "admin",
  "user",
  "ai",
]);
export const ratingSource = pgEnum("rating_source", [
  "progfans",
  "royalroad",
  "goodreads",
  "audible",
]);
export const externalSource = pgEnum("external_source", [
  "royalroad",
  "amazon",
  "audible",
  "goodreads",
]);

// Personal tracking-list states.
export const listStatus = pgEnum("list_status", ["reading", "read", "plan", "dropped", "paused"]);
