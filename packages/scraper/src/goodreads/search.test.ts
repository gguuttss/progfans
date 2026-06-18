import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  authorSimilar,
  isGrDenylisted,
  looksLikeFanfic,
  parseSearchResults,
  pickFirstBook,
} from "./search";

const html = readFileSync(join(import.meta.dirname, "../../fixtures/gr-search-mol.html"), "utf8");

describe("goodreads search", () => {
  const results = parseSearchResults(html);

  it("parses results with rating + votes + url", () => {
    expect(results.length).toBeGreaterThanOrEqual(10);
    const first = results[0]!;
    expect(first.title).toMatch(/Mother of Learning/);
    expect(first.rating).toBeCloseTo(4.43, 2);
    expect(first.votes).toBe(14452);
    expect(first.url).toContain("/book/show/");
  });

  it("picks the first book by title (ignoring the pen-name author)", () => {
    const hit = pickFirstBook(results, "Mother of Learning");
    expect(hit?.title).toBe("Mother of Learning: ARC 1");
    expect(hit?.rating).toBeCloseTo(4.43, 2);
  });

  it("returns null when nothing matches the title", () => {
    expect(pickFirstBook(results, "Some Completely Unrelated Book")).toBeNull();
  });

  it("rejects loose prefix/substring false matches", () => {
    const fakes = [
      {
        title: "Lost and Found Sisters (Wildstone, #1)",
        author: "x",
        rating: 4,
        votes: 14057,
        url: "",
      },
      {
        title: "The 108 Skills of Natural Born Leaders",
        author: "x",
        rating: 3.4,
        votes: 20,
        url: "",
      },
      {
        title: "Nova War (The Shoal Sequence, #2)",
        author: "x",
        rating: 3.83,
        votes: 2139,
        url: "",
      },
    ];
    expect(pickFirstBook(fakes, "Lost and Found")).toBeNull();
    expect(pickFirstBook(fakes, "The 108")).toBeNull();
    expect(pickFirstBook(fakes, "Nova Wars")).toBeNull();
  });

  it("matches an exact core title ignoring volume markers, requiring votes", () => {
    const hits = [
      { title: "A Practical Guide to Evil I", author: "x", rating: 4.4, votes: 718, url: "" },
      { title: "Throne of Time", author: "x", rating: 0, votes: 0, url: "" },
    ];
    expect(pickFirstBook(hits, "A Practical Guide to Evil")?.votes).toBe(718);
    expect(pickFirstBook(hits, "Throne of Time")).toBeNull(); // zero votes -> rejected
  });

  it("rejects same-title-different-franchise via the series marker", () => {
    const collisions = [
      { title: "Changeling (Sweep, #8)", author: "x", rating: 4.18, votes: 11121, url: "" },
      {
        title: "Power Overwhelming (Charlotte Powers, #5)",
        author: "x",
        rating: 3.6,
        votes: 8,
        url: "",
      },
    ];
    expect(pickFirstBook(collisions, "Changeling")).toBeNull();
    expect(pickFirstBook(collisions, "Power Overwhelming")).toBeNull();

    // Same-named series marker IS our franchise -> keep.
    const ours = [
      {
        title: "Beware of Chicken (Beware of Chicken, #1)",
        author: "x",
        rating: 4.46,
        votes: 14704,
        url: "",
      },
    ];
    expect(pickFirstBook(ours, "Beware Of Chicken")?.votes).toBe(14704);
  });

  it("matches authors fuzzily but rejects genuinely different names", () => {
    expect(authorSimilar("Maxime J. Durand (Void Herald)", "Maxime J. Durand")).toBe(true);
    expect(authorSimilar("Travis Baldree", "Travis Balgree")).toBe(true); // typo
    expect(authorSimilar("nobody103", "Domagoj Kurmaić")).toBe(false); // nickname vs real name
  });

  it("demands an author signal for low-vote matches, trusts high-vote on title alone", () => {
    const lowMismatch = [
      {
        title: "Power Overwhelming",
        author: "Some Random Author",
        rating: 4.12,
        votes: 8,
        url: "",
      },
    ];
    expect(pickFirstBook(lowMismatch, "Power Overwhelming", "rrNickname")).toBeNull();

    const lowAuthorMatch = [
      { title: "Tiny Indie Series", author: "Jane Author", rating: 4, votes: 6, url: "" },
    ];
    expect(pickFirstBook(lowAuthorMatch, "Tiny Indie Series", "Jane Author")?.votes).toBe(6);

    const highVote = [
      {
        title: "Mother of Learning: ARC 1",
        author: "Domagoj Kurmaić",
        rating: 4.43,
        votes: 14452,
        url: "",
      },
    ];
    expect(pickFirstBook(highVote, "Mother of Learning", "nobody103")?.votes).toBe(14452);
  });

  it("flags fanfiction titles to skip", () => {
    expect(looksLikeFanfic("Lost and Found (Warhammer 40k SI)")).toBe(true);
    expect(looksLikeFanfic("Just Deserts: Revised Edition (MHA, OC)")).toBe(true);
    expect(looksLikeFanfic("The Devil of Cintra (The Witcher x Youjo Senki)")).toBe(true);
    expect(looksLikeFanfic("Mother of Learning")).toBe(false);
    expect(looksLikeFanfic("Beware Of Chicken")).toBe(false);
  });

  it("suppresses denylisted false matches (annotations ignored)", () => {
    expect(isGrDenylisted("To The Far Shore")).toBe(true);
    expect(isGrDenylisted("To the Far Shore [LitRPG]")).toBe(true);
    expect(isGrDenylisted("Mistakes Were Made [Remorseful Demon King Reincarnation]")).toBe(true);
    expect(isGrDenylisted("Post-Human")).toBe(true);
    expect(isGrDenylisted("Mother of Learning")).toBe(false);
  });
});
