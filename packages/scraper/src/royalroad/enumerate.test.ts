import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseListPage } from "./enumerate";

const html = readFileSync(join(import.meta.dirname, "../../fixtures/best-rated.html"), "utf8");

describe("parseListPage", () => {
  const items = parseListPage(html);

  it("parses list items with followers + rating", () => {
    expect(items.length).toBeGreaterThanOrEqual(15);

    const mol = items.find((i) => i.externalId === "21220");
    expect(mol?.title).toBe("Mother of Learning");
    expect(mol?.followers).toBe(32003);
    expect(mol?.ratingValue).toBeCloseTo(4.83, 2);
  });

  it("every parsed item has an id and a follower count", () => {
    for (const item of items) {
      expect(item.externalId).toMatch(/^\d+$/);
      expect(item.followers).toBeGreaterThan(0);
    }
  });
});
