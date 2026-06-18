import Link from "next/link";
import { SeriesCard } from "@/components/SeriesCard";
import { SiteHeader } from "@/components/SiteHeader";
import { TierListCard } from "@/components/TierListCard";
import { getUser } from "@/lib/auth";
import { getCatalog, getTierLists } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await getUser();
  const [featured, trending] = await Promise.all([
    getCatalog({ sort: "tier", userId: user?.id, pageSize: 6 }),
    getTierLists("trending", user?.id, 4),
  ]);
  const signedIn = Boolean(user);

  return (
    <div className="mx-auto max-w-6xl px-4 pb-8">
      <SiteHeader />

      <section className="py-10">
        <h1 className="max-w-3xl font-display text-5xl leading-[1.05] font-extrabold tracking-tight">
          Find your next <span className="text-gold">progression</span> obsession.
        </h1>
        <p className="mt-4 max-w-xl text-lg text-muted">
          The catalog for progression fantasy &amp; litRPG. Track your reads, find the next big
          thing, and flaunt your taste.
        </p>
        <div className="mt-6">
          <Link
            href="/browse"
            className="inline-block rounded bg-ink px-5 py-2.5 font-medium text-paper transition-opacity hover:opacity-90"
          >
            Browse the catalog
          </Link>
        </div>
      </section>

      <section className="mb-10">
        <div className="mb-4 flex items-baseline justify-between border-t border-line pt-6">
          <h2 className="font-mono text-xs tracking-wider text-muted uppercase">Highest rated</h2>
          <Link href="/browse" className="text-sm text-muted transition-colors hover:text-ink">
            All series →
          </Link>
        </div>
        <div className="grid gap-3 lg:grid-cols-2">
          {featured.map((item) => (
            <SeriesCard key={item.slug} item={item} signedIn={signedIn} />
          ))}
        </div>
      </section>

      {trending.length > 0 && (
        <section>
          <div className="mb-4 flex items-baseline justify-between border-t border-line pt-6">
            <h2 className="font-mono text-xs tracking-wider text-muted uppercase">
              Trending tier lists
            </h2>
            <Link href="/tier" className="text-sm text-muted transition-colors hover:text-ink">
              All tier lists →
            </Link>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {trending.map((l) => (
              <TierListCard key={l.id} list={l} signedIn={signedIn} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
