import * as cheerio from "cheerio";
import { parseIntComma } from "../royalroad/util";

export type GrResult = {
  title: string;
  author: string;
  rating: number | null;
  votes: number;
  url: string;
  cover?: string | null;
};

// Goodreads serves tiny cover thumbnails (e.g. ..._SX50_.jpg); strip the size
// modifier to get the full-resolution image.
const upscaleCover = (src: string | undefined): string | null =>
  src ? src.replace(/\._S[XY]\d+(_S[XY]\d+)?_(\.\w+)$/, "$2") : null;

/** Parse a Goodreads search OR Listopia results page (both use table.tableList). */
export function parseSearchResults(html: string): GrResult[] {
  const $ = cheerio.load(html);
  return $("table.tableList tr")
    .toArray()
    .map((el) => {
      const $el = $(el);
      const title = $el.find("a.bookTitle").text().trim().replace(/\s+/g, " ");
      const author = $el.find("a.authorName").first().text().trim();
      const mini = $el.find("span.minirating").text().trim().replace(/\s+/g, " ");
      const m = mini.match(/([\d.]+)\s*avg rating\s*[—-]\s*([\d,]+)\s*rating/);
      const href = ($el.find("a.bookTitle").attr("href") ?? "").split("?")[0] ?? "";
      return {
        title,
        author,
        rating: m ? Number(m[1]) : null,
        votes: m ? parseIntComma(m[2]) : 0,
        url: href ? `https://www.goodreads.com${href}` : "",
        cover: upscaleCover($el.find("img.bookCover, td.field.cover img, img").first().attr("src")),
      };
    })
    .filter((r) => r.title);
}

/** Strip Goodreads volume/series markers to a clean book title. */
export const cleanGrTitle = (title: string): string => stripVolume(title);

// Strip RR-style annotations like "[Slow Burn]" or "(STUBBED)" before matching.
const stripAnnotations = (s: string) => s.replace(/\[.*?\]|\(.*?\)/g, " ").trim();

// Strip Goodreads series/volume markers to recover the core book title:
//   "Mother of Learning: ARC 1"        -> "Mother of Learning"
//   "Lost and Found Sisters (Wildstone, #1)" -> "Lost and Found Sisters"
//   "A Practical Guide to Evil I"      -> "A Practical Guide to Evil"
const stripVolume = (s: string) =>
  s
    .replace(/\s*\(.*?\)\s*$/, "") // trailing "(Series, #N)"
    .replace(/\s*[:,]\s*(vol(ume)?|book|arc|part)\.?\s*[\divxlc]+\b.*$/i, "") // ": Vol 1" / ": Book 2"
    .replace(/\s+[IVX]+$/, "") // trailing roman numeral " I", " II"
    .trim();

const compact = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]/g, "");

// Fanfiction / crossovers aren't on Goodreads, so any title match is a false
// positive. Skip titles carrying SI/OC/crossover or well-known fandom markers.
const FANFIC =
  /\b(SI|OC|self[-\s]?insert|crossover|fanfic)\b|warhammer|\b40k\b|naruto|pok[eé]mon|\bMHA\b|my hero academia|\bworm\b|star wars|witcher|youjo senki|one piece|harry potter|westeros|warcraft|gamer si/i;

export const looksLikeFanfic = (title: string): boolean => FANFIC.test(title);

// Manually-curated false matches that slip past the heuristics — high-vote
// same-title collisions with unrelated published books. Add the RR series
// title here (annotations are ignored) to suppress Goodreads matching.
const GR_DENYLIST = new Set(["to the far shore"]);

export const isGrDenylisted = (title: string): boolean =>
  GR_DENYLIST.has(
    title
      .toLowerCase()
      .replace(/\[.*?\]|\(.*?\)/g, " ")
      .replace(/\s+/g, " ")
      .trim(),
  );

// Extract a Goodreads series name from a trailing "(Series, #N)" marker.
// Only triggers when a book number (#N) is present, so "(Light Novel)" is ignored.
function grSeriesName(title: string): string | null {
  const m = title.match(/\(([^)]*#\s*\d+[^)]*)\)\s*$/);
  if (!m) return null;
  return (m[1]!.split(/[,#]/)[0] ?? "").trim() || null;
}

const normName = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

function bigrams(s: string): Set<string> {
  const t = s.replace(/\s/g, "");
  const g = new Set<string>();
  for (let i = 0; i < t.length - 1; i++) g.add(t.slice(i, i + 2));
  return g;
}

function dice(a: string, b: string): number {
  const A = bigrams(a);
  const B = bigrams(b);
  if (A.size === 0 || B.size === 0) return 0;
  const inter = [...A].filter((x) => B.has(x)).length;
  return (2 * inter) / (A.size + B.size);
}

/**
 * Lenient author match: shared name token (surname), substring, or fuzzy
 * spelling. Returns false for genuinely different names (incl. nickname vs
 * real name) — that's intentional; it's only used as a low-vote tiebreaker.
 */
export function authorSimilar(ourAuthor: string, grAuthor: string): boolean {
  const a = normName(ourAuthor);
  const b = normName(grAuthor);
  if (!a || !b) return false;

  const at = new Set(a.split(" ").filter((w) => w.length >= 3));
  const bt = new Set(b.split(" ").filter((w) => w.length >= 3));
  for (const w of at) if (bt.has(w)) return true; // shared name word (surname)

  const an = a.replace(/\s/g, "");
  const bn = b.replace(/\s/g, "");
  if (an.length >= 4 && bn.length >= 4 && (an.includes(bn) || bn.includes(an))) return true;

  return dice(a, b) >= 0.6; // typos / minor variants
}

// Below this many GR votes, a same-title match is too likely a coincidence,
// so we additionally demand an author signal.
const VOTE_TRUST_THRESHOLD = 20;

/**
 * Strict title match. Many RR series aren't on Goodreads at all, so we require:
 *  - the GR core title (volume markers stripped) to EQUAL ours,
 *  - any GR series marker to belong to OUR franchise (kills same-title collisions
 *    like "Changeling (Sweep, #8)"),
 *  - real votes, and
 *  - for low-vote matches (< 20), a fuzzy author match (pen names differ, so
 *    popular books are trusted on title alone).
 * Returns the first/highest-ranked such result = the series' first book.
 */
export function pickFirstBook(
  results: GrResult[],
  ourTitle: string,
  ourAuthor = "",
): GrResult | null {
  const ours = compact(stripAnnotations(ourTitle));
  if (ours.length < 5) return null; // too short to disambiguate safely

  for (const r of results) {
    if (r.rating == null || r.votes < 1) continue;
    if (compact(stripVolume(r.title)) !== ours) continue;
    const series = grSeriesName(r.title);
    if (series && compact(series) !== ours) continue; // different franchise, same title
    if (r.votes < VOTE_TRUST_THRESHOLD && !authorSimilar(ourAuthor, r.author)) continue;
    return r;
  }
  return null;
}
