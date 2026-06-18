import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FavoritesEditor } from "@/components/FavoritesEditor";
import { ProfileEditor } from "@/components/ProfileEditor";
import { SiteHeader } from "@/components/SiteHeader";
import { StatsBar } from "@/components/StatsBar";
import { getUser } from "@/lib/auth";
import { fmtBirthday, fmtDate, fmtRelative } from "@/lib/format";
import { LIST_STATUS_LABEL, type ListStatusValue } from "@/lib/list";
import { getFavorites, getFullProfile, getListStats, getRecentActivity } from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string }>;
}): Promise<Metadata> {
  const { username } = await params;
  return { title: `@${username} — ProgFans` };
}

const SectionTitle = ({ children }: { children: React.ReactNode }) => (
  <h2 className="mb-3 font-mono text-xs tracking-wider text-muted uppercase">{children}</h2>
);

export default async function ProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const profile = await getFullProfile(username);
  if (!profile) notFound();

  const viewer = await getUser();
  const isOwner = viewer?.id === profile.id;

  const [stats, activity, favorites] = await Promise.all([
    getListStats(profile.id),
    getRecentActivity(profile.id, 5),
    getFavorites(profile.id),
  ]);

  const birthday = fmtBirthday(profile.birthday, profile.birthdayPrecision);
  const meta = [
    profile.location,
    profile.gender,
    birthday ? `Born ${birthday}` : null,
    `Joined ${fmtDate(profile.createdAt)}`,
  ].filter(Boolean) as string[];

  return (
    <div className="mx-auto max-w-6xl px-4 pb-8">
      <SiteHeader />

      {/* Identity */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-full border border-line bg-line">
          {profile.avatarUrl ? (
            <Image
              src={profile.avatarUrl}
              alt=""
              fill
              sizes="96px"
              className="object-cover"
              unoptimized
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center font-display text-3xl font-extrabold text-muted">
              {profile.username.charAt(0).toUpperCase()}
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <h1 className="flex min-w-0 flex-wrap items-center gap-2 font-display text-3xl leading-tight font-extrabold break-words">
              @{profile.username}
              {(profile.isOwner || profile.isAdmin) && (
                <span className="rounded-full border border-gold bg-gold/10 px-2 py-0.5 font-mono text-[11px] font-medium tracking-wider text-gold uppercase">
                  {profile.isOwner ? "Owner" : "Admin"}
                </span>
              )}
            </h1>
            {isOwner && <ProfileEditor profile={profile} />}
          </div>

          {profile.bio && (
            <p className="mt-2 leading-relaxed whitespace-pre-line text-ink/90">{profile.bio}</p>
          )}

          <p className="mt-2 text-sm text-muted">{meta.join(" · ")}</p>
        </div>
      </div>

      {/* Favourites */}
      {(favorites.length > 0 || isOwner) && (
        <section className="mt-8">
          <SectionTitle>Favourites</SectionTitle>
          <FavoritesEditor favorites={favorites} isOwner={isOwner} />
        </section>
      )}

      {/* Stats */}
      <section className="mt-8">
        <div className="mb-3 flex items-baseline justify-between">
          <SectionTitle>Stats</SectionTitle>
          <Link
            href={`/list/${profile.username}`}
            className="text-sm text-gold underline-offset-2 hover:underline"
          >
            View list →
          </Link>
        </div>
        {stats.total > 0 ? (
          <StatsBar stats={stats} />
        ) : (
          <p className="text-sm text-muted">No series tracked yet.</p>
        )}
      </section>

      {/* Recent activity */}
      {activity.length > 0 && (
        <section className="mt-8">
          <SectionTitle>Last updates</SectionTitle>
          <div className="divide-y divide-line rounded-lg border border-line">
            {activity.map((a) => (
              <Link
                key={a.slug}
                href={`/series/${a.slug}`}
                className="flex items-center gap-3 px-3 py-2 text-sm transition-colors hover:bg-line/40"
              >
                <div className="relative h-11 w-8 shrink-0 overflow-hidden rounded bg-line">
                  {a.coverUrl && (
                    <Image
                      src={a.coverUrl}
                      alt=""
                      fill
                      sizes="32px"
                      className="object-cover"
                      unoptimized
                    />
                  )}
                </div>
                <span className="min-w-0 flex-1 truncate font-medium text-ink">{a.title}</span>
                <span className="shrink-0 text-muted">
                  {LIST_STATUS_LABEL[a.status as ListStatusValue] ?? a.status}
                  {a.score != null ? ` · ${a.score}/10` : ""}
                </span>
                <span className="hidden w-16 shrink-0 text-right font-mono text-xs text-muted sm:block">
                  {fmtRelative(a.updatedAt)}
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
