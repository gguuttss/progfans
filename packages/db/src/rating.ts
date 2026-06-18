/**
 * Rating math shared by the app and any ranking logic.
 *
 * Ratings are on a 5-point scale (Royal Road / Goodreads). A raw mean is shown
 * to readers, but ranking and the "rarity" badge use a Bayesian-weighted score
 * so a 4.9 with 10 votes doesn't outrank a 4.6 with 10,000.
 */

export type Rarity = "common" | "uncommon" | "rare" | "epic" | "legendary";

const PRIOR_VOTES = 500; // strength of the pull toward the genre mean
const PRIOR_MEAN = 4.3; // approximate progression-fantasy average (5-pt scale)

/** IMDb-style weighted score: pulls low-vote ratings toward the genre mean. */
export function bayesianScore(
  rating: number,
  votes: number,
  opts: { priorVotes?: number; priorMean?: number } = {},
): number {
  const m = opts.priorVotes ?? PRIOR_VOTES;
  const c = opts.priorMean ?? PRIOR_MEAN;
  if (votes <= 0) return c;
  return (votes * rating + m * c) / (votes + m);
}

// Thresholds tuned for the progression-fantasy 5-pt distribution (most quality
// works sit 4.2–4.8). Loot-rarity language: common → legendary.
const RARITY_CUTOFFS: [number, Rarity][] = [
  [4.65, "legendary"],
  [4.5, "epic"],
  [4.35, "rare"],
  [4.15, "uncommon"],
  [0, "common"],
];

export function rarityFromScore(score: number): Rarity {
  for (const [min, rarity] of RARITY_CUTOFFS) {
    if (score >= min) return rarity;
  }
  return "common";
}

/** Convenience: weighted score → rarity, straight from a rating + vote count. */
export function rarityFromRating(rating: number, votes: number): Rarity {
  return rarityFromScore(bayesianScore(rating, votes));
}

/**
 * Minimum vote counts for a source's rating to be trusted. Below these, the
 * rating is disregarded entirely (treated as if the source has no rating) —
 * a hard cutoff in place of Bayesian smoothing.
 */
export const MIN_RATING_VOTES = { royalroad: 100, goodreads: 250 } as const;

/**
 * Rarity from a raw mean, gated by a minimum vote count. No Bayesian pull —
 * either the sample is big enough to trust the raw rating, or it doesn't count.
 */
export function rarityFromMean(
  rating: number | null | undefined,
  votes: number | null | undefined,
  minVotes: number,
): Rarity {
  if (rating == null || votes == null || votes < minVotes) return "common";
  return rarityFromScore(rating);
}

/* ────────────────────────────────────────────────────────────────────────
 * progfans score — a 0–100 quality grade combining Royal Road, Goodreads,
 * and progfans's own ratings into a letter grade. See scoreSeries below.
 * ──────────────────────────────────────────────────────────────────────── */

export type Grade = "S+" | "S" | "A" | "B" | "C" | "D" | "F" | "?";

/** Min ratings for a platform's *average* to count toward the grade. */
export const SCORE_MIN_VOTES = { royalroad: 100, goodreads: 250, progfans: 10 } as const;
/** Each platform's rating scale (RR/GR are 5-point; progfans list scores are 1–10). */
export const SCORE_SCALE = { royalroad: 5, goodreads: 5, progfans: 10 } as const;

export type ScorePlatform = keyof typeof SCORE_MIN_VOTES;
export type PlatformStat = { mean: number; count: number };
export type SeriesStats = Partial<Record<ScorePlatform, PlatformStat | null>>;
export type MaxCounts = Record<ScorePlatform, number>;

const SCORE_PLATFORMS: ScorePlatform[] = ["royalroad", "goodreads", "progfans"];

const RATING_MAX = 30; // points from one platform's average (before normalizing)
// Volume points per platform (max 10 total). Royal Road's rating *count* is
// intentionally worth 0 — a published book shouldn't be penalized for not being
// on RR. RR's rating average still counts toward the 90-point rating part.
export const VOLUME_WEIGHT: Record<ScorePlatform, number> = {
  royalroad: 0,
  goodreads: 5,
  progfans: 5,
};

// Progression-fantasy ratings cluster in a narrow high band, so a raw mean/5
// would bunch everything at the top. Instead we stretch each platform's own
// ~p5→p95 range across 0–30. Calibrated 2026-06 to the live distribution
// (RR n=1353, GR n=1232); progfans is a placeholder until it has ≥10-vote series.
export const RATING_FLOOR: Record<ScorePlatform, number> = {
  royalroad: 4.18,
  goodreads: 3.82,
  progfans: 6,
};
export const RATING_CAP: Record<ScorePlatform, number> = {
  royalroad: 4.78,
  goodreads: 4.52,
  progfans: 9,
};

function ratingPoints(mean: number, platform: ScorePlatform): number {
  const floor = RATING_FLOOR[platform];
  const cap = RATING_CAP[platform];
  const t = Math.max(0, Math.min(1, (mean - floor) / (cap - floor)));
  return t * RATING_MAX;
}

// Cutoffs calibrated 2026-06 to the live score distribution for a pleasing tier
// curve (~3% S+, ~7% S, ~12% A, ~23% B, ~25% C, ~17% D, ~13% F). Easy to retune.
const GRADE_BANDS: [number, Grade][] = [
  [92, "S+"],
  [86, "S"],
  [74, "A"],
  [60, "B"],
  [45, "C"],
  [28, "D"],
  [0, "F"],
];

export function gradeFromScore(score: number): Grade {
  for (const [min, grade] of GRADE_BANDS) if (score >= min) return grade;
  return "F";
}

/**
 * Combine per-platform ratings into a 0–100 score + letter grade.
 *
 * - Rating (max 90): each platform crossing its vote threshold contributes
 *   `(mean / scale) * 30`; the sum is normalized by the share of platforms that
 *   qualified — so a single trusted platform can still reach the top.
 * - Volume (max 10): every platform's rating *count* contributes, log-scaled
 *   against the catalog max, so an absence costs points but one outlier doesn't
 *   flatten everyone.
 *
 * Returns grade `?` when no platform crosses its rating threshold.
 */
export function scoreSeries(stats: SeriesStats, max: MaxCounts): { score: number; grade: Grade } {
  let ratingSum = 0;
  let qualifying = 0;
  let volume = 0;

  for (const p of SCORE_PLATFORMS) {
    const stat = stats[p];
    const count = stat?.count ?? 0;

    if (stat && count >= SCORE_MIN_VOTES[p]) {
      ratingSum += ratingPoints(stat.mean, p);
      qualifying++;
    }

    const weight = VOLUME_WEIGHT[p];
    const m = max[p] ?? 0;
    if (weight > 0 && m > 0 && count > 0) {
      volume += (Math.log(count + 1) / Math.log(m + 1)) * weight;
    }
  }

  if (qualifying === 0) return { score: 0, grade: "?" };
  const score = (ratingSum * 3) / qualifying + volume;
  return { score, grade: gradeFromScore(score) };
}

/* ────────────────────────────────────────────────────────────────────────
 * Percentile-based tier score (2026-06 rework).
 *
 * Four categories — Goodreads rating, Goodreads #ratings, Royal Road rating,
 * Royal Road #ratings — each scored as the series' percentile within that
 * category's qualifying population. A platform only counts when it clears its
 * MIN_RATING_VOTES threshold; below that it's treated as having no data.
 *
 * The score weights the series' OWN categories best→worst, so a series is judged
 * mostly by its strongest signal (popularity can offset a lukewarm average):
 *   - GR ✓ and RR ✓:  70 / 15 / 10 / 5
 *   - RR missing:      85 / 15            (two GR categories; max 100)
 *   - GR missing:      80 / 15 / 2.5 / 2.5 (RR gets 80/15; GR forced to 0th
 *                                          percentile → max 95, niche penalty)
 * Returns null when neither platform qualifies (badge "?").
 * ──────────────────────────────────────────────────────────────────────── */

/**
 * percent_rank for each value: the fraction of the population scoring strictly
 * below it, `#{below} / (n - 1)`, in [0, 1]. Ties share the lower rank. Output
 * is index-aligned to the input. A single-element population maps to 1.
 */
export function percentRanks(values: number[]): number[] {
  const n = values.length;
  if (n === 0) return [];
  if (n === 1) return [1];
  const sorted = [...values].sort((a, b) => a - b);
  return values.map((v) => {
    let lo = 0;
    let hi = n;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if ((sorted[mid] as number) < v) lo = mid + 1;
      else hi = mid;
    }
    return lo / (n - 1);
  });
}

/** A series' percentile (0–1) in each category, or null where it doesn't qualify. */
export type TierPercentiles = {
  grRating: number | null;
  grVolume: number | null;
  rrRating: number | null;
  rrVolume: number | null;
};

/** Combine category percentiles into a 0–100 tier score; null if untiered. */
export function tierScore(p: TierPercentiles): number | null {
  const gr: [number, number] | null =
    p.grRating != null && p.grVolume != null ? [p.grRating, p.grVolume] : null;
  const rr: [number, number] | null =
    p.rrRating != null && p.rrVolume != null ? [p.rrRating, p.rrVolume] : null;
  if (!gr && !rr) return null;

  let values: number[];
  let weights: number[];
  if (gr && rr) {
    values = [gr[0], gr[1], rr[0], rr[1]];
    weights = [70, 15, 10, 5];
  } else if (gr) {
    values = [gr[0], gr[1]];
    weights = [85, 15];
  } else {
    const r = rr as [number, number];
    values = [r[0], r[1], 0, 0]; // GR forced to 0th percentile
    weights = [80, 15, 2.5, 2.5];
  }
  values.sort((a, b) => b - a); // biggest weight to the strongest category
  return values.reduce((sum, v, i) => sum + v * (weights[i] ?? 0), 0);
}

// Fixed tier-score cutoffs (calibrated 2026-06 to the live distribution).
const TIER_GRADE_BANDS: [number, Grade][] = [
  [90, "S+"],
  [85, "S"],
  [75, "A"],
  [60, "B"],
  [45, "C"],
  [25, "D"],
  [0, "F"],
];

/** Letter grade for a tier score; null/undefined (untiered) → "?". */
export function tierGradeFromScore(score: number | null | undefined): Grade {
  if (score == null) return "?";
  for (const [min, grade] of TIER_GRADE_BANDS) if (score >= min) return grade;
  return "F";
}
