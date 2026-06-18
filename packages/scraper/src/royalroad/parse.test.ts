import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseFiction } from "./parse";

const FIXTURE_IDS = ["21220", "36735", "21410", "54508", "107917", "65629"];

const fixture = (id: string) =>
  readFileSync(join(import.meta.dirname, "../../fixtures", `fiction-${id}.html`), "utf8");

describe("parseFiction — Mother of Learning (21220)", () => {
  const f = parseFiction(fixture("21220"));

  it("extracts core identity", () => {
    expect(f.externalId).toBe("21220");
    expect(f.title).toBe("Mother of Learning");
    expect(f.author).toBe("nobody103");
    expect(f.status).toBe("completed");
    expect(f.coverUrl).toContain("royalroadcdn.com");
    expect(f.datePublished).toBeTruthy();
  });

  it("extracts stats and rating", () => {
    expect(f.followers).toBe(32003);
    expect(f.ratingValue).toBeCloseTo(4.83, 2);
    expect(f.ratingCount).toBe(16990);
    expect(f.chapters).toBe(109);
    expect(f.words).toBe(806306);
  });

  it("extracts tags with slug + label", () => {
    expect(f.tags).toContainEqual({ slug: "loop", label: "Time Loop" });
    expect(f.tags.length).toBeGreaterThanOrEqual(5);
  });
});

describe("parseFiction — all fixtures parse cleanly", () => {
  it.each(FIXTURE_IDS)("fiction %s yields required fields", (id) => {
    const f = parseFiction(fixture(id));
    expect(f.externalId).toBe(id);
    expect(f.title.length).toBeGreaterThan(0);
    expect(f.author.length).toBeGreaterThan(0);
    expect(f.followers).toBeGreaterThan(0);
    expect(f.ratingValue).toBeGreaterThan(0);
    expect(f.ratingValue).toBeLessThanOrEqual(5);
  });
});
