import { describe, expect, it } from "vitest";
import {
  bayesianScore,
  percentRanks,
  rarityFromRating,
  rarityFromScore,
  tierGradeFromScore,
  tierScore,
} from "./rating";

describe("bayesianScore", () => {
  it("pulls low-vote ratings toward the genre mean", () => {
    const fewVotes = bayesianScore(4.9, 10);
    const manyVotes = bayesianScore(4.9, 50000);
    expect(fewVotes).toBeLessThan(manyVotes);
    expect(fewVotes).toBeLessThan(4.5); // 10 votes barely moves off the 4.3 prior
    expect(manyVotes).toBeGreaterThan(4.85);
  });

  it("returns the prior mean for zero votes", () => {
    expect(bayesianScore(5, 0)).toBe(4.3);
  });
});

describe("rarity", () => {
  it("buckets scores into loot tiers", () => {
    expect(rarityFromScore(4.8)).toBe("legendary");
    expect(rarityFromScore(4.55)).toBe("epic");
    expect(rarityFromScore(4.4)).toBe("rare");
    expect(rarityFromScore(4.2)).toBe("uncommon");
    expect(rarityFromScore(3.9)).toBe("common");
  });

  it("treats a high rating with few votes as not-legendary (confidence-aware)", () => {
    expect(rarityFromRating(4.9, 8)).not.toBe("legendary");
    expect(rarityFromRating(4.83, 16990)).toBe("legendary"); // Mother of Learning
  });
});

describe("percentRanks", () => {
  it("maps worst→0 and best→1", () => {
    expect(percentRanks([10, 20, 30, 40])).toEqual([0, 1 / 3, 2 / 3, 1]);
  });
  it("gives ties the lower (strictly-below) rank", () => {
    expect(percentRanks([10, 10, 20])).toEqual([0, 0, 1]);
  });
  it("handles empty and singleton populations", () => {
    expect(percentRanks([])).toEqual([]);
    expect(percentRanks([42])).toEqual([1]);
  });
});

describe("tierScore", () => {
  const P = (grRating: number, grVolume: number, rrRating: number, rrVolume: number) => ({
    grRating,
    grVolume,
    rrRating,
    rrVolume,
  });

  it("is null when neither platform qualifies", () => {
    expect(
      tierScore({ grRating: null, grVolume: null, rrRating: null, rrVolume: null }),
    ).toBeNull();
  });

  it("caps a perfect full-data series at 100 (70/15/10/5)", () => {
    expect(tierScore(P(1, 1, 1, 1))).toBeCloseTo(100);
  });

  it("weights the strongest category most", () => {
    // sorted desc [0.9, 0.5, 0.5, 0.1] · [70,15,10,5] = 63 + 7.5 + 5 + 0.5
    expect(tierScore(P(0.5, 0.5, 0.9, 0.1))).toBeCloseTo(76);
  });

  it("uses 85/15 with no Royal Road data (max 100)", () => {
    expect(tierScore({ grRating: 1, grVolume: 1, rrRating: null, rrVolume: null })).toBeCloseTo(
      100,
    );
    expect(tierScore({ grRating: 1, grVolume: 0, rrRating: null, rrVolume: null })).toBeCloseTo(85);
  });

  it("caps a no-Goodreads series at 95 (niche penalty)", () => {
    expect(tierScore({ grRating: null, grVolume: null, rrRating: 1, rrVolume: 1 })).toBeCloseTo(95);
  });
});

describe("tierGradeFromScore", () => {
  it("maps scores to letters at the fixed cutoffs", () => {
    expect(tierGradeFromScore(null)).toBe("?");
    expect(tierGradeFromScore(95)).toBe("S+");
    expect(tierGradeFromScore(90)).toBe("S+");
    expect(tierGradeFromScore(89)).toBe("S");
    expect(tierGradeFromScore(85)).toBe("S");
    expect(tierGradeFromScore(80)).toBe("A");
    expect(tierGradeFromScore(75)).toBe("A");
    expect(tierGradeFromScore(60)).toBe("B");
    expect(tierGradeFromScore(45)).toBe("C");
    expect(tierGradeFromScore(25)).toBe("D");
    expect(tierGradeFromScore(24)).toBe("F");
    expect(tierGradeFromScore(0)).toBe("F");
  });
});
