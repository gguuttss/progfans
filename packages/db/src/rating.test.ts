import { describe, expect, it } from "vitest";
import { bayesianScore, rarityFromRating, rarityFromScore } from "./rating";

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
