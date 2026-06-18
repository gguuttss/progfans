import * as cheerio from "cheerio";

/** Normalized record parsed from a Royal Road fiction page. */
export type RoyalRoadFiction = {
  externalId: string;
  url: string;
  title: string;
  author: string;
  coverUrl: string | null;
  description: string;
  status: "ongoing" | "completed" | "hiatus" | "dropped" | "stub" | "unknown";
  tags: { slug: string; label: string }[];
  ratingValue: number | null; // out of 5
  ratingCount: number;
  followers: number;
  favorites: number;
  views: number;
  pages: number | null;
  words: number | null;
  chapters: number | null;
  datePublished: string | null; // ISO date
};

const RR_STATUS: Record<string, RoyalRoadFiction["status"]> = {
  ONGOING: "ongoing",
  COMPLETED: "completed",
  HIATUS: "hiatus",
  INACTIVE: "hiatus", // RR auto-flag for long-stale fictions (vs author-declared HIATUS)
  DROPPED: "dropped",
  STUB: "stub",
};

const toInt = (s: string | undefined): number => {
  if (!s) return 0;
  const n = parseInt(s.replace(/[^\d]/g, ""), 10);
  return Number.isNaN(n) ? 0 : n;
};

/** Recursively find the first JSON-LD node carrying an aggregateRating. */
function findBookNode(node: unknown): Record<string, unknown> | null {
  if (Array.isArray(node)) {
    for (const item of node) {
      const found = findBookNode(item);
      if (found) return found;
    }
    return null;
  }
  if (node && typeof node === "object") {
    const obj = node as Record<string, unknown>;
    if (obj.aggregateRating || obj["@type"] === "Book") return obj;
    if (obj["@graph"]) return findBookNode(obj["@graph"]);
  }
  return null;
}

export class FictionParseError extends Error {}

export function parseFiction(html: string, sourceUrl?: string): RoyalRoadFiction {
  const $ = cheerio.load(html);

  const ogUrl = $('meta[property="og:url"]').attr("content") ?? sourceUrl ?? "";
  const url = ogUrl || sourceUrl || "";
  const externalId = (url.match(/\/fiction\/(\d+)/) ?? [])[1] ?? "";

  // JSON-LD is the cleanest source for title/author/rating/date.
  let ld: Record<string, unknown> | null = null;
  const ldRaw = $('script[type="application/ld+json"]').first().contents().text();
  if (ldRaw) {
    try {
      ld = findBookNode(JSON.parse(ldRaw));
    } catch {
      ld = null;
    }
  }
  const agg = (ld?.aggregateRating ?? {}) as Record<string, unknown>;
  const ldAuthor = (ld?.author ?? {}) as Record<string, unknown>;

  const title = (ld?.name as string) || $("h1.font-white").first().text().trim();
  const author =
    (ldAuthor.name as string) ||
    $(".fic-title a[href^='/profile/'], h4.font-white a").first().text().trim();

  const coverUrl = $('meta[property="og:image"]').attr("content") ?? null;

  const description = $("div.description").first().text().replace(/\s+/g, " ").trim();

  // Status: first label whose text is a known RR status (skips "Original").
  let status: RoyalRoadFiction["status"] = "unknown";
  $("span.label").each((_, el) => {
    const key = $(el).text().trim().toUpperCase();
    if (key in RR_STATUS && status === "unknown") status = RR_STATUS[key]!;
  });

  const tags = $("a.fiction-tag")
    .toArray()
    .map((el) => {
      const $el = $(el);
      const slug = ($el.attr("href")?.match(/tagsAdd=([^&]+)/) ?? [])[1] ?? "";
      return { slug: decodeURIComponent(slug), label: $el.text().trim() };
    })
    .filter((t) => t.slug);

  // Stats list: alternating "Label :" / value <li> entries.
  const statItems = $("li.bold.uppercase")
    .toArray()
    .map((el) => $(el).text().trim());
  const stats: Record<string, string> = {};
  for (let i = 0; i < statItems.length - 1; i++) {
    const label = statItems[i]!;
    if (label.endsWith(":")) {
      stats[label.replace(/\s*:\s*$/, "").toLowerCase()] = statItems[i + 1]!;
    }
  }

  const chaptersText = $('span.label:contains("Chapters")').first().text();
  const chapters = chaptersText ? toInt(chaptersText) : null;
  const words = (html.match(/from ([\d,]+) words/) ?? [])[1];

  const ratingValue = agg.ratingValue != null ? Number(agg.ratingValue) : null;

  const fiction: RoyalRoadFiction = {
    externalId,
    url,
    title,
    author,
    coverUrl,
    description,
    status,
    tags,
    ratingValue: Number.isFinite(ratingValue) ? ratingValue : null,
    ratingCount: agg.ratingCount != null ? toInt(String(agg.ratingCount)) : toInt(stats["ratings"]),
    followers: toInt(stats["followers"]),
    favorites: toInt(stats["favorites"]),
    views: toInt(stats["total views"]),
    pages: stats["pages"] ? toInt(stats["pages"]) : null,
    words: words ? toInt(words) : null,
    chapters,
    datePublished: (ld?.datePublished as string) ?? null,
  };

  assertHealthy(fiction);
  return fiction;
}

/** Parser-health guard: throw loudly if required fields didn't parse. */
function assertHealthy(f: RoyalRoadFiction): void {
  const missing: string[] = [];
  if (!f.externalId) missing.push("externalId");
  if (!f.title) missing.push("title");
  if (!f.author) missing.push("author");
  if (!f.followers) missing.push("followers");
  if (f.ratingValue == null) missing.push("ratingValue");
  if (missing.length) {
    throw new FictionParseError(
      `Royal Road parser health check failed (layout changed?). Missing: ${missing.join(", ")}`,
    );
  }
}
