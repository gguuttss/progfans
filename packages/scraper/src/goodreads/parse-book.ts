// Parsers for Goodreads book + series pages (validated against the spike).

// Traversing untyped Goodreads apolloState JSON.
// biome-ignore lint/suspicious/noExplicitAny: untyped apolloState JSON
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

export function nextData(html: string): Any {
  const m = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
  if (!m?.[1]) return null;
  try {
    return JSON.parse(m[1]);
  } catch {
    return null; // truncated/half-rendered page — caller retries
  }
}

const stripHtml = (s?: string): string =>
  (s ?? "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .trim();

export type GrBook = {
  grId: string;
  title: string;
  description: string | null;
  coverUrl: string | null;
  ratingValue: number | null;
  ratingVotes: number;
  firstPublishedAt: string | null; // ISO yyyy-mm-dd
  seriesGrId: string | null;
  seriesName: string | null;
  seriesUrl: string | null;
  position: string | null; // "1", "10", "1-3"…
};

/** Parse a Goodreads book page from its __NEXT_DATA__ apolloState. */
export function parseBookPage(html: string): GrBook | null {
  const apollo = nextData(html)?.props?.pageProps?.apolloState as Record<string, Any> | undefined;
  if (!apollo) return null;
  const book = Object.values(apollo).find(
    (v: Any) => v?.__typename === "Book" && (v.bookSeries || v.title),
  ) as Any;
  if (!book) return null;

  const work = book.work?.__ref ? apollo[book.work.__ref] : null;
  const stats = work?.stats ?? {};
  const bs = book.bookSeries?.[0];
  const seriesObj = bs?.series?.__ref ? apollo[bs.series.__ref] : null;

  const stripped = book['description({"stripped":true})'];
  const description =
    (typeof stripped === "string" ? stripped : stripHtml(book.description)) || null;

  let firstPublishedAt: string | null = null;
  const pub = book.details?.publicationTime;
  if (typeof pub === "number") firstPublishedAt = new Date(pub).toISOString().slice(0, 10);

  const grId = String(book.legacyId ?? book.webUrl?.match(/\/book\/show\/(\d+)/)?.[1] ?? "");

  return {
    grId,
    title: book.title ?? book.titleComplete ?? "",
    description,
    coverUrl: book.imageUrl ?? null,
    ratingValue: typeof stats.averageRating === "number" ? stats.averageRating : null,
    ratingVotes: typeof stats.ratingsCount === "number" ? stats.ratingsCount : 0,
    firstPublishedAt,
    seriesGrId: seriesObj?.id ?? null,
    seriesName: seriesObj?.title ?? null,
    seriesUrl: seriesObj?.webUrl ?? null,
    position: bs?.userPosition ?? null,
  };
}

export type SeriesItem = { grId: string; position: number };

/**
 * Parse a Goodreads series page (legacy HTML). Returns the REAL numbered books
 * (label "Book N") and every item id (incl. box-set collections + spin-offs,
 * used to find which of our series belong to this GR series).
 */
export function parseSeriesPage(html: string): { realBooks: SeriesItem[]; allItemIds: string[] } {
  const blocks = html.split(/listWithDividers__item/).slice(1);
  const realBooks: SeriesItem[] = [];
  const allItemIds: string[] = [];
  for (const b of blocks) {
    const id = b.match(/\/book\/show\/(\d+)/)?.[1];
    if (!id) continue;
    allItemIds.push(id);
    const label = (b.match(/<h3[^>]*>([\s\S]*?)<\/h3>/)?.[1] ?? "").replace(/<[^>]+>/g, "").trim();
    const m = label.match(/^Book\s+(\d+)$/i); // integer = real book; ranges/other skipped
    if (m) realBooks.push({ grId: id, position: Number(m[1]) });
  }
  return { realBooks, allItemIds };
}
