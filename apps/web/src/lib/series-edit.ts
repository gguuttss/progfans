// Shared shapes + validation for the suggest-an-edit / moderation flow.
// Safe to import from client and server.

export const SERIES_STATUSES = ["ongoing", "completed", "hiatus", "dropped", "stub", "unknown"];
export const POV_OPTIONS = ["single", "multiple"];
export const MC_GENDER_OPTIONS = ["male", "female", "nonbinary", "ensemble"];
export const ROMANCE_OPTIONS = ["none", "subplot", "central"];
export const LINK_SOURCES = ["goodreads", "royalroad", "amazon", "audible"] as const;
export type LinkSource = (typeof LINK_SOURCES)[number];
export const BOOK_LINK_SOURCES = ["goodreads", "amazon", "audible"] as const;
export type BookLinkSource = (typeof BOOK_LINK_SOURCES)[number];

export const STATUS_LABELS: Record<string, string> = {
  ongoing: "Ongoing",
  completed: "Completed",
  hiatus: "On hiatus",
  dropped: "Dropped",
  stub: "Published off-site",
  unknown: "Unknown",
};

export type BookEdit = {
  id: number;
  title: string;
  position: number | null;
  description: string | null;
  links: Record<BookLinkSource, string>;
};

export type SeriesEditPayload = {
  title: string;
  description: string | null;
  status: string;
  pov: string | null;
  mcGender: string | null;
  romance: string | null;
  formats: { web: boolean; ebook: boolean; ku: boolean; audio: boolean };
  tropes: string[]; // trope slugs
  links: Record<LinkSource, string>; // url or "" for none
  books: BookEdit[];
};

export type BookRequestPayload = {
  title: string;
  author: string;
  url: string;
};

export const EMPTY_LINKS: Record<LinkSource, string> = {
  goodreads: "",
  royalroad: "",
  amazon: "",
  audible: "",
};

const enumOrNull = (v: unknown, allowed: string[]): string | null =>
  typeof v === "string" && allowed.includes(v) ? v : null;

const cleanUrl = (v: unknown): string => {
  const s = typeof v === "string" ? v.trim() : "";
  return /^https?:\/\/.+/i.test(s) ? s.slice(0, 600) : "";
};

/** Validate + clamp an incoming edit payload (untrusted) to safe values. */
export function sanitizeEdit(raw: Partial<SeriesEditPayload>): SeriesEditPayload {
  const f = raw.formats ?? { web: false, ebook: false, ku: false, audio: false };
  const links = (raw.links ?? {}) as Record<string, unknown>;
  return {
    title: (typeof raw.title === "string" ? raw.title : "").trim().slice(0, 300) || "Untitled",
    description:
      typeof raw.description === "string" && raw.description.trim()
        ? raw.description.trim().slice(0, 8000)
        : null,
    status: SERIES_STATUSES.includes(raw.status as string) ? (raw.status as string) : "unknown",
    pov: enumOrNull(raw.pov, POV_OPTIONS),
    mcGender: enumOrNull(raw.mcGender, MC_GENDER_OPTIONS),
    romance: enumOrNull(raw.romance, ROMANCE_OPTIONS),
    formats: {
      web: Boolean(f.web),
      ebook: Boolean(f.ebook),
      ku: Boolean(f.ku),
      audio: Boolean(f.audio),
    },
    tropes: Array.isArray(raw.tropes)
      ? [
          ...new Set(raw.tropes.filter((t) => typeof t === "string").map((t) => t.slice(0, 80))),
        ].slice(0, 60)
      : [],
    links: {
      goodreads: cleanUrl(links.goodreads),
      royalroad: cleanUrl(links.royalroad),
      amazon: cleanUrl(links.amazon),
      audible: cleanUrl(links.audible),
    },
    books: Array.isArray(raw.books)
      ? raw.books
          .map((b) => {
            const bl = (b.links ?? {}) as Record<string, unknown>;
            const pos = Number(b.position);
            return {
              id: Number(b.id),
              title: (typeof b.title === "string" ? b.title : "").trim().slice(0, 300),
              position: Number.isFinite(pos) ? Math.trunc(pos) : null,
              description:
                typeof b.description === "string" && b.description.trim()
                  ? b.description.trim().slice(0, 8000)
                  : null,
              links: {
                goodreads: cleanUrl(bl.goodreads),
                amazon: cleanUrl(bl.amazon),
                audible: cleanUrl(bl.audible),
              },
            };
          })
          .filter((b) => Number.isInteger(b.id))
      : [],
  };
}
