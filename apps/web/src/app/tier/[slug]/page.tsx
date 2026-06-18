import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/SiteHeader";
import { TierActions } from "@/components/TierActions";
import { TierLabelView } from "@/components/TierLabel";
import { VoteButton } from "@/components/VoteButton";
import { getUser } from "@/lib/auth";
import { fmtDate } from "@/lib/format";
import { getTierList, getTierVoteState } from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const t = await getTierList(slug);
  if (!t) return {};
  const ranked = t.tiers.reduce((n, r) => n + r.items.length, 0);
  const desc = `${t.ownerUsername ? `@${t.ownerUsername}'s ` : ""}progression-fantasy tier list — ${ranked} series ranked on ProgFans.`;
  return {
    title: `${t.title} — ProgFans`,
    description: desc,
    openGraph: { title: t.title, description: desc, type: "website" },
    twitter: { card: "summary_large_image", title: t.title, description: desc },
  };
}

export default async function TierPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const t = await getTierList(slug);
  if (!t) notFound();

  const user = await getUser();
  const isOwner = Boolean(user && t.ownerId && user.id === t.ownerId);
  const ranked = t.tiers.reduce((n, r) => n + r.items.length, 0);
  const vote = await getTierVoteState(t.id, user?.id);

  return (
    <div className="mx-auto max-w-6xl px-4 pb-12">
      <SiteHeader />

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="font-display text-3xl leading-tight font-extrabold break-words">
            {t.title}
          </h1>
          <p className="mt-1 text-sm text-muted">
            {t.ownerUsername ? (
              <Link
                href={`/user/${t.ownerUsername}`}
                className="text-gold underline-offset-2 hover:underline"
              >
                @{t.ownerUsername}
              </Link>
            ) : (
              "Anonymous"
            )}
            {" · "}
            {ranked} ranked · {fmtDate(t.createdAt)}
          </p>
          {t.remixedFromSlug && (
            <p className="mt-1 text-sm text-muted">
              Remixed from{" "}
              <Link
                href={`/tier/${t.remixedFromSlug}`}
                className="text-gold underline-offset-2 hover:underline"
              >
                {t.remixedFromTitle ?? "the original"}
              </Link>
            </p>
          )}
          <div className="mt-3">
            <VoteButton
              id={t.id}
              initialVotes={vote.votes}
              initialVoted={vote.voted}
              signedIn={Boolean(user)}
            />
          </div>
        </div>
        <TierActions id={t.id} slug={t.slug} title={t.title} isOwner={isOwner} />
      </div>

      <div className="space-y-2">
        {t.tiers.map((row, i) => (
          <div
            key={i}
            className="flex items-stretch overflow-hidden rounded-lg border border-line bg-card"
          >
            <div
              className="flex w-16 shrink-0 items-center justify-center px-1 py-2 sm:w-20"
              style={{ backgroundColor: row.color }}
            >
              <TierLabelView label={row.label} />
            </div>
            <div className="relative flex min-h-[5rem] flex-1 flex-wrap content-start gap-1.5 p-2">
              {row.items.map((s) => (
                <Link
                  key={s.id}
                  href={`/series/${s.slug}`}
                  title={s.title}
                  className="w-14 transition-transform hover:scale-105 sm:w-16"
                >
                  <div className="relative aspect-[2/3] overflow-hidden rounded border border-line bg-line">
                    {s.coverUrl ? (
                      <Image
                        src={s.coverUrl}
                        alt={s.title}
                        fill
                        sizes="64px"
                        className="object-cover"
                        unoptimized
                      />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center p-1 text-center text-[9px] leading-tight text-muted">
                        {s.title}
                      </span>
                    )}
                  </div>
                </Link>
              ))}
              {row.items.length === 0 && (
                <span className="absolute inset-0 flex items-center justify-center font-mono text-xs text-muted">
                  —
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 rounded-lg border border-line bg-card/60 p-5 text-center">
        <p className="font-display text-lg font-bold">Think you can rank these better?</p>
        <p className="mt-1 text-sm text-muted">
          Remix this list or build your own from your tracked shelf.
        </p>
        <div className="mt-3 flex justify-center gap-2">
          <Link
            href={`/tier/new?remix=${t.slug}`}
            className="rounded-md bg-gold px-4 py-2 text-sm font-medium text-paper transition-opacity hover:opacity-90"
          >
            Remix this list
          </Link>
          <Link
            href="/tier/new"
            className="rounded-md border border-line px-4 py-2 text-sm font-medium text-ink transition-colors hover:border-gold"
          >
            Start fresh
          </Link>
        </div>
      </div>
    </div>
  );
}
