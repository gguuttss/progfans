import { MIN_RATING_VOTES, percentRanks, tierScore } from "@progfans/db/rating";
import postgres from "postgres";

// Recompute the percentile-based tier score for every series and store it on
// series.tier_score. Run after a ratings refresh (scores only change when the
// underlying GR/RR ratings do). Prints the score distribution at the end.

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL not set");
const sql = postgres(url, { prepare: false });

type Row = {
  id: number;
  gr_value: number | null;
  gr_votes: number | null;
  rr_value: number | null;
  rr_votes: number | null;
};

const rows = (await sql`
  select s.id,
    gr.value::float8 as gr_value, gr.votes as gr_votes,
    rr.value::float8 as rr_value, rr.votes as rr_votes
  from series s
  left join series_ratings gr on gr.series_id = s.id and gr.source = 'goodreads'
  left join series_ratings rr on rr.series_id = s.id and rr.source = 'royalroad'
`) as unknown as Row[];

// Qualifying populations — each platform must clear its vote threshold.
const grQual = rows.filter(
  (r) => r.gr_value != null && (r.gr_votes ?? 0) >= MIN_RATING_VOTES.goodreads,
);
const rrQual = rows.filter(
  (r) => r.rr_value != null && (r.rr_votes ?? 0) >= MIN_RATING_VOTES.royalroad,
);

// series id -> percentile (0–1) within a category.
const pctMap = (pop: Row[], pick: (r: Row) => number): Map<number, number> => {
  const ranks = percentRanks(pop.map(pick));
  const m = new Map<number, number>();
  pop.forEach((r, i) => m.set(r.id, ranks[i] ?? 0));
  return m;
};
const grRating = pctMap(grQual, (r) => r.gr_value as number);
const grVolume = pctMap(grQual, (r) => r.gr_votes as number);
const rrRating = pctMap(rrQual, (r) => r.rr_value as number);
const rrVolume = pctMap(rrQual, (r) => r.rr_votes as number);

const updates = rows.map((r) => ({
  id: r.id,
  score: tierScore({
    grRating: grRating.get(r.id) ?? null,
    grVolume: grVolume.get(r.id) ?? null,
    rrRating: rrRating.get(r.id) ?? null,
    rrVolume: rrVolume.get(r.id) ?? null,
  }),
}));

const ids = updates.map((u) => u.id);
const scores = updates.map((u) => u.score);
await sql`
  update series s set tier_score = t.score
  from unnest(${ids}::bigint[], ${scores}::real[]) as t(id, score)
  where s.id = t.id`;

// ── Distribution summary ───────────────────────────────────────────────────
const scored = updates
  .map((u) => u.score)
  .filter((s): s is number => s != null)
  .sort((a, b) => a - b);
const untiered = updates.length - scored.length;
const at = (p: number): number =>
  scored[Math.min(scored.length - 1, Math.floor((p / 100) * scored.length))] ?? 0;

const buckets = Array.from({ length: 10 }, () => 0);
for (const s of scored) {
  const i = Math.min(9, Math.floor(s / 10));
  buckets[i] = (buckets[i] ?? 0) + 1;
}
const peak = Math.max(1, ...buckets);

console.log(`\nTiered: ${scored.length}   Untiered: ${untiered}   Total: ${updates.length}`);
console.log(
  `min ${at(0).toFixed(1)}  p10 ${at(10).toFixed(1)}  p25 ${at(25).toFixed(1)}  ` +
    `p50 ${at(50).toFixed(1)}  p75 ${at(75).toFixed(1)}  p90 ${at(90).toFixed(1)}  ` +
    `p95 ${at(95).toFixed(1)}  p99 ${at(99).toFixed(1)}  max ${(scored[scored.length - 1] ?? 0).toFixed(1)}`,
);
console.log("\nscore bucket  count");
buckets.forEach((c, i) => {
  const bar = "#".repeat(Math.round((c / peak) * 40));
  console.log(`${String(i * 10).padStart(3)}–${i * 10 + 10}  ${bar} ${c}`);
});

await sql.end();
