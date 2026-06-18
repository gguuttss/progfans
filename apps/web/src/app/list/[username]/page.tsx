import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AddToListButton } from "@/components/AddToListButton";
import { SiteHeader } from "@/components/SiteHeader";
import { getProfileByUsername, getUser } from "@/lib/auth";
import { LIST_STATUS_LABEL, type ListStatusValue } from "@/lib/list";
import { getUserList, type UserListItem } from "@/lib/queries";

export const dynamic = "force-dynamic";

const SECTION_ORDER: ListStatusValue[] = ["reading", "read", "paused", "dropped", "plan"];

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string }>;
}): Promise<Metadata> {
  const { username } = await params;
  return { title: `@${username} — ProgFans` };
}

export default async function ListPage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const owner = await getProfileByUsername(username);
  if (!owner) notFound();

  const viewer = await getUser();
  const isOwner = viewer?.id === owner.id;
  const items = await getUserList(owner.id, viewer?.id);

  const byStatus = new Map<string, UserListItem[]>();
  for (const it of items) {
    const list = byStatus.get(it.listStatus) ?? [];
    list.push(it);
    byStatus.set(it.listStatus, list);
  }

  return (
    <div className="mx-auto max-w-6xl px-4 pb-8">
      <SiteHeader />

      <div className="flex items-baseline gap-2">
        <h1 className="font-display text-3xl font-extrabold">
          {isOwner ? "My list" : `@${owner.username}`}
        </h1>
        {isOwner && <span className="font-mono text-sm text-muted">@{owner.username}</span>}
      </div>
      <p className="mt-1 text-muted">
        {items.length === 0
          ? isOwner
            ? "Nothing tracked yet."
            : "This list is empty."
          : `${items.length} series tracked.`}
      </p>

      {items.length === 0 && isOwner && (
        <p className="mt-6 text-sm text-muted">
          Find something on{" "}
          <Link href="/browse" className="text-gold underline-offset-2 hover:underline">
            Browse
          </Link>{" "}
          and add it to start your list.
        </p>
      )}

      {items.length > 0 && (
        <div className="mt-8 space-y-10">
          {SECTION_ORDER.filter((s) => byStatus.has(s)).map((s) => (
            <section key={s}>
              <h2 className="mb-3 font-mono text-xs tracking-wider text-muted uppercase">
                {LIST_STATUS_LABEL[s]} · {byStatus.get(s)!.length}
              </h2>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {byStatus.get(s)!.map((it) => (
                  <div
                    key={it.slug}
                    className="group relative flex items-center gap-3 rounded-lg border border-line bg-card p-2 transition-colors hover:border-gold"
                  >
                    <Link
                      href={`/series/${it.slug}`}
                      aria-label={it.title}
                      className="absolute inset-0 z-0 rounded-lg"
                    />
                    <div className="pointer-events-none relative z-10 h-[60px] w-[40px] shrink-0 overflow-hidden rounded bg-line">
                      {it.coverUrl && (
                        <Image
                          src={it.coverUrl}
                          alt=""
                          fill
                          sizes="40px"
                          className="object-cover"
                          unoptimized
                        />
                      )}
                    </div>
                    <div className="pointer-events-none relative z-10 min-w-0 flex-1">
                      <div className="truncate font-medium text-ink group-hover:text-gold">
                        {it.title}
                      </div>
                      <div className="truncate text-xs text-muted">{it.authors}</div>
                    </div>
                    <div className="relative z-10 flex shrink-0 items-center gap-2">
                      {it.ownerScore != null && (
                        <span className="tnum font-mono text-sm font-bold text-ink">
                          {it.ownerScore}
                          <span className="text-muted">/10</span>
                        </span>
                      )}
                      <div className="pointer-events-auto">
                        <AddToListButton
                          seriesId={it.id}
                          signedIn={Boolean(viewer)}
                          initialStatus={it.viewerStatus}
                          initialScore={it.viewerScore}
                          initialNotes={it.viewerNotes}
                          icon
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
