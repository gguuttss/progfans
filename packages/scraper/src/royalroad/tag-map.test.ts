import { describe, expect, it } from "vitest";
import { mapRoyalRoadTags } from "./tag-map";

describe("mapRoyalRoadTags", () => {
  it("maps known tags to tropes and drops unmapped ones", () => {
    const r = mapRoyalRoadTags([
      { slug: "litrpg" },
      { slug: "cultivation" },
      { slug: "supernatural" }, // intentionally dropped
    ]);
    expect(r.tropeSlugs).toContain("litrpg");
    expect(r.tropeSlugs).toContain("cultivation-xianxia");
    expect(r.tropeSlugs).not.toContain("supernatural");
  });

  it("maps facets, with romance precedence central > subplot", () => {
    const r = mapRoyalRoadTags([
      { slug: "romance" }, // subplot
      { slug: "romance_main" }, // central
      { slug: "multiple_lead" },
    ]);
    expect(r.facets.romance).toBe("central");
    expect(r.facets.pov).toBe("multiple");
  });

  it("dedups tropes mapped from several RR tags", () => {
    const r = mapRoyalRoadTags([{ slug: "sci_fi" }, { slug: "space_opera" }, { slug: "mecha" }]);
    expect(r.tropeSlugs.filter((s) => s === "sci-fi-space")).toHaveLength(1);
  });
});
