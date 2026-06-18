import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { TierListCard } from "@/components/TierListCard";
import { getUser } from "@/lib/auth";
import { getTierLists, type TierSort } from "@/lib/queries";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Tier lists — ProgFans" };

function SortTab({ active, href, children }: { active: boolean; href: string; children: string }) {
  return (
    <Link
      href={href}
      className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
        active ? "bg-ink text-paper" : "border border-line text-muted hover:text-ink"
      }`}
    >
      {children}
    </Link>
  );
}

export default async function TierListsPage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string }>;
}) {
  const { sort } = await searchParams;
  const active: TierSort = sort === "top" ? "top" : sort === "new" ? "new" : "trending";

  const user = await getUser();
  const lists = await getTierLists(active, user?.id);
  const signedIn = Boolean(user);

  return (
    <div className="mx-auto max-w-6xl px-4 pb-12">
      <SiteHeader />

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-3xl font-extrabold">Tier lists</h1>
        <Link
          href="/tier/new"
          className="inline-flex items-center gap-1.5 rounded-md bg-gold px-4 py-2 text-sm font-medium text-paper transition-opacity hover:opacity-90"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Make your own
        </Link>
      </div>

      <div className="mb-6 flex gap-2">
        <SortTab active={active === "trending"} href="/tier?sort=trending">
          Trending
        </SortTab>
        <SortTab active={active === "top"} href="/tier?sort=top">
          Top
        </SortTab>
        <SortTab active={active === "new"} href="/tier?sort=new">
          Newest
        </SortTab>
      </div>

      {lists.length === 0 ? (
        <div className="rounded-lg border border-line bg-card/60 p-8 text-center">
          <p className="font-display text-lg font-bold">No tier lists yet.</p>
          <p className="mt-1 text-sm text-muted">Be the first to rank your favourites.</p>
          <Link
            href="/tier/new"
            className="mt-4 inline-block rounded-md bg-gold px-4 py-2 text-sm font-medium text-paper transition-opacity hover:opacity-90"
          >
            Build a tier list
          </Link>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {lists.map((l) => (
            <TierListCard key={l.id} list={l} signedIn={signedIn} />
          ))}
        </div>
      )}
    </div>
  );
}
