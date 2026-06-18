import { BrowseFilters } from "@/components/BrowseFilters";
import { Pagination } from "@/components/Pagination";
import { SeriesCard } from "@/components/SeriesCard";
import { SiteHeader } from "@/components/SiteHeader";
import { SortControl } from "@/components/SortControl";
import { getUser } from "@/lib/auth";
import {
  CATALOG_PAGE_SIZE,
  type CatalogSort,
  getCatalog,
  getCatalogCount,
  getTropeOptions,
} from "@/lib/queries";

export const dynamic = "force-dynamic";

type SP = Record<string, string | string[] | undefined>;
const asArray = (v: string | string[] | undefined): string[] =>
  v == null ? [] : Array.isArray(v) ? v : [v];

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

export default async function BrowsePage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q : "";
  const tropes = asArray(sp.tropes);
  const excludeTropes = asArray(sp.xtropes);
  const statuses = asArray(sp.statuses);
  const sort: CatalogSort =
    typeof sp.sort === "string" && SORTS.has(sp.sort as CatalogSort)
      ? (sp.sort as CatalogSort)
      : "tier";
  const page = Math.max(1, Number(sp.page) || 1);

  const user = await getUser();
  const signedIn = Boolean(user);

  const params = { q, tropes, excludeTropes, statuses };
  const [items, total, tropeOptions] = await Promise.all([
    getCatalog({ ...params, sort, userId: user?.id, page }),
    getCatalogCount(params),
    getTropeOptions(),
  ]);
  const totalPages = Math.ceil(total / CATALOG_PAGE_SIZE);

  return (
    <div className="mx-auto max-w-6xl px-4 pb-8">
      <SiteHeader />

      <div className="grid gap-8 md:grid-cols-[250px_1fr]">
        <BrowseFilters
          tropeOptions={tropeOptions}
          tropes={tropes}
          excludeTropes={excludeTropes}
          statuses={statuses}
        />

        <section className="min-w-0">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-3">
              <h1 className="font-display text-2xl font-bold">Browse</h1>
              <span className="tnum font-mono text-sm text-muted">{total} series</span>
            </div>
            <SortControl />
          </div>

          {items.length === 0 ? (
            <p className="rounded-lg border border-dashed border-line p-8 text-center text-muted">
              No series match these filters. Try removing one.
            </p>
          ) : (
            <div className="space-y-3">
              {items.map((item) => (
                <SeriesCard key={item.slug} item={item} signedIn={signedIn} />
              ))}
            </div>
          )}

          <Pagination pathname="/browse" searchParams={sp} page={page} totalPages={totalPages} />
        </section>
      </div>
    </div>
  );
}
