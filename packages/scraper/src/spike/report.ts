// Spike checkpoint: parse every fixture and print a human-readable summary.
// Run: pnpm --filter @progfans/scraper exec tsx src/spike/report.ts
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { parseFiction } from "../royalroad/parse";

const dir = join(import.meta.dirname, "../../fixtures");
const files = readdirSync(dir).filter((f) => /^fiction-\d+\.html$/.test(f));

for (const file of files) {
  const f = parseFiction(readFileSync(join(dir, file), "utf8"));
  console.log("\n" + "─".repeat(72));
  console.log(`${f.title}  —  by ${f.author}  [${f.status}]`);
  console.log(`  id ${f.externalId} · ${f.url}`);
  console.log(
    `  rating ${f.ratingValue}/5 (${f.ratingCount.toLocaleString()} ratings) · ` +
      `${f.followers.toLocaleString()} followers · ${f.favorites.toLocaleString()} favorites`,
  );
  console.log(
    `  ${f.chapters ?? "?"} chapters · ${f.words?.toLocaleString() ?? "?"} words · ` +
      `${f.views.toLocaleString()} views · published ${f.datePublished?.slice(0, 10) ?? "?"}`,
  );
  console.log(`  cover: ${f.coverUrl}`);
  console.log(`  tags (${f.tags.length}): ${f.tags.map((t) => t.label).join(", ")}`);
  console.log(`  desc: ${f.description.slice(0, 120)}…`);
}
console.log("\n" + "─".repeat(72));
console.log(`Parsed ${files.length} fixtures with zero parser-health failures.`);
