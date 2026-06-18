import type { Metadata } from "next";
import Link from "next/link";
import { Pagination } from "@/components/Pagination";
import { SeriesCard } from "@/components/SeriesCard";
import { SiteHeader } from "@/components/SiteHeader";
import { SortControl } from "@/components/SortControl";
import { getUser } from "@/lib/auth";
import { CATALOG_PAGE_SIZE, type CatalogSort, getCatalog, getCatalogCount } from "@/lib/queries";

export const metadata: Metadata = { title: "Search — ProgFans" };
export const dynamic = "force-dynamic";

type SP = Record<string, string | string[] | undefined>;

const SORTS = new Set<CatalogSort>([
  "tier",
  "rating_rr",
  "rating_gr",
  "rating_pf",
  "reviews_rr",
  "reviews_gr",
  "reviews_pf",
  "my_score",
]);

export default async function SearchPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const page = Math.max(1, Number(sp.page) || 1);

  const user = await getUser();
  const signedIn = Boolean(user);

  let sort: CatalogSort =
    typeof sp.sort === "string" && SORTS.has(sp.sort as CatalogSort)
      ? (sp.sort as CatalogSort)
      : "tier";
  if (sort === "my_score" && !signedIn) sort = "tier";

  // Search by name only — no trope/status filters here, just sorting.
  const [items, total] = q
    ? await Promise.all([getCatalog({ q, sort, userId: user?.id, page }), getCatalogCount({ q })])
    : [[], 0];
  const totalPages = Math.ceil(total / CATALOG_PAGE_SIZE);

  return (
    <div className="mx-auto max-w-6xl px-4 pb-8">
      <SiteHeader />

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-bold">
          {q ? (
            <>
              {total} result{total === 1 ? "" : "s"} for “{q}”
            </>
          ) : (
            "Search"
          )}
        </h1>
        {q && total > 0 && <SortControl />}
      </div>

      {!q ? (
        <p className="text-muted">Type a title in the search bar above.</p>
      ) : items.length === 0 ? (
        <div className="rounded-lg border border-dashed border-line p-8 text-center">
          <p className="text-muted">No series, books, or authors match “{q}”.</p>
          <p className="mt-2 text-sm text-muted">Can’t find your book?</p>
          <Link
            href={`/request?q=${encodeURIComponent(q)}`}
            className="mt-3 inline-block rounded-md bg-gold px-4 py-2 text-sm font-medium text-paper transition-opacity hover:opacity-90"
          >
            Request it to be added →
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <SeriesCard key={item.slug} item={item} signedIn={signedIn} />
          ))}
        </div>
      )}

      <Pagination pathname="/search" searchParams={sp} page={page} totalPages={totalPages} />
    </div>
  );
}
