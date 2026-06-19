import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { AddToListButton } from "@/components/AddToListButton";
import { BookBlurb } from "@/components/BookBlurb";
import { FavoriteStar } from "@/components/FavoriteStar";
import { GradeBadge } from "@/components/GradeBadge";
import { SiteHeader } from "@/components/SiteHeader";
import { TropeChip } from "@/components/TropeChip";
import { getProfile, getUser } from "@/lib/auth";
import { FACET_LABEL, fmtCompact, fmtInt, fmtRating, TROPE_CATEGORY_LABEL } from "@/lib/format";
import {
  getSeries,
  getUserListEntry,
  isFavorite,
  type SeriesBook,
  type SeriesDetail,
} from "@/lib/queries";

const CATEGORY_ORDER = [
  "power_system",
  "setting",
  "progression",
  "protagonist",
  "tone",
  "relationships",
  "content_warning",
];

// Publication status — clear labels + a dot, with a tooltip so it's obvious the
// word describes the series' status (esp. "unknown").
const STATUS_UNKNOWN = { label: "Status unknown", dot: "bg-muted" };
const STATUS_META: Record<string, { label: string; dot: string }> = {
  ongoing: { label: "Ongoing", dot: "bg-blue-500" },
  completed: { label: "Completed", dot: "bg-emerald-500" },
  hiatus: { label: "On hiatus", dot: "bg-amber-500" },
  dropped: { label: "Dropped", dot: "bg-rose-500" },
  stub: { label: "Published off-site", dot: "bg-violet-500" },
  unknown: STATUS_UNKNOWN,
};

const VENUE_ORDER = ["progfans", "royalroad", "goodreads", "audible"] as const;
const VENUE_LABEL: Record<string, string> = {
  progfans: "ProgFans",
  royalroad: "Royal Road",
  goodreads: "Goodreads",
  audible: "Audible",
};

function PfMark() {
  return (
    <span
      className="font-display text-sm leading-none font-extrabold text-ink"
      aria-label="ProgFans"
    >
      p<span className="text-gold">f</span>
    </span>
  );
}

function VenueIcon({ source }: { source: string }) {
  if (source === "progfans") return <PfMark />;
  const src =
    source === "royalroad"
      ? "/royalroad-logo.png"
      : source === "goodreads"
        ? "/goodreads-logo.png"
        : "/audible-logo.png";
  return <Image src={src} alt={VENUE_LABEL[source] ?? source} width={16} height={16} />;
}

const amazonSearch = (q: string) =>
  `https://www.amazon.com/s?k=${encodeURIComponent(q)}&i=stripbooks`;
const audibleSearch = (q: string) =>
  `https://www.audible.com/search?keywords=${encodeURIComponent(q)}`;

function ExternalIcon({ className }: { className?: string }) {
  return (
    <svg
      width="11"
      height="11"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <line x1="7" y1="17" x2="17" y2="7" />
      <polyline points="8 7 17 7 17 16" />
    </svg>
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const s = await getSeries(slug);
  if (!s) return {};
  const author = s.authors[0];
  const desc =
    s.description?.replace(/\s+/g, " ").slice(0, 160) ??
    `${s.title}${author ? ` by ${author}` : ""} — ratings, books, and where to read on ProgFans.`;
  return {
    title: `${s.title}${author ? ` by ${author}` : ""} — ProgFans`,
    description: desc,
    alternates: { canonical: `/series/${slug}` },
    openGraph: {
      type: "book",
      title: s.title,
      description: desc,
      url: `/series/${slug}`,
      // The OG image comes from ./opengraph-image (a branded card).
    },
  };
}

export default async function SeriesPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const s = await getSeries(slug);
  if (!s) notFound();

  const user = await getUser();
  const profile = user ? await getProfile(user.id) : null;
  const entry = user ? await getUserListEntry(user.id, s.id) : null;
  const fav = user ? await isFavorite(user.id, s.id) : false;
  const author = s.authors[0] ?? "";

  const primaryFormat = s.formats.web
    ? "Web serial"
    : s.formats.ebook
      ? "eBook"
      : s.formats.audio
        ? "Audiobook"
        : null;

  const stats = [
    s.lengthWords ? `${fmtInt(s.lengthWords)} words` : null,
    s.lengthChapters ? `${s.lengthChapters} chapters` : null,
    s.firstPublishedAt ? s.firstPublishedAt.slice(0, 4) : null,
  ].filter(Boolean);

  const linkFor = (source: string) => s.links.find((l) => l.source === source)?.url ?? null;
  const ratings = VENUE_ORDER.map((source) => s.ratings.find((x) => x.source === source)).filter(
    Boolean,
  ) as { source: string; value: number; votes: number }[];

  // Schema.org Book structured data (rich results). Only ProgFans's own user
  // scores feed the aggregateRating — never external ratings — per Google's
  // review-snippet guidelines.
  const pfRating = ratings.find((r) => r.source === "progfans");
  const bookLd = {
    "@context": "https://schema.org",
    "@type": "Book",
    name: s.title,
    url: `https://progfans.com/series/${slug}`,
    ...(author ? { author: { "@type": "Person", name: author } } : {}),
    ...(s.coverUrl ? { image: s.coverUrl } : {}),
    ...(s.description
      ? { description: s.description.replace(/\s+/g, " ").trim().slice(0, 600) }
      : {}),
    genre: ["Progression Fantasy", "LitRPG"],
    inLanguage: "en",
    ...(pfRating && pfRating.votes > 0
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: Math.round(pfRating.value * 100) / 100,
            ratingCount: pfRating.votes,
            bestRating: 10,
            worstRating: 1,
          },
        }
      : {}),
  };

  const jsonLd = [
    bookLd,
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "ProgFans", item: "https://progfans.com" },
        { "@type": "ListItem", position: 2, name: "Browse", item: "https://progfans.com/browse" },
        {
          "@type": "ListItem",
          position: 3,
          name: s.title,
          item: `https://progfans.com/series/${slug}`,
        },
      ],
    },
  ];

  const editButton = (
    <Link
      href={`/series/${slug}/edit`}
      className="mt-4 flex items-center justify-center gap-1.5 rounded-md border border-gold bg-gold/10 px-3 py-2 text-sm font-medium text-gold transition-colors hover:bg-gold hover:text-paper"
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
      </svg>
      {profile?.isAdmin ? "Edit series" : "Suggest an edit"}
    </Link>
  );

  return (
    <div className="mx-auto max-w-6xl px-4 pb-8">
      {/* biome-ignore lint/security/noDangerouslySetInnerHtml: static JSON-LD we build server-side */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <SiteHeader />

      <div className="flex flex-col gap-6 sm:flex-row">
        {/* Desktop sidebar — cover + actions + tags */}
        <aside className="hidden shrink-0 sm:block sm:w-[210px]">
          <Cover src={s.coverUrl} className="aspect-[2/3] w-full" />
          <div className="mt-3">
            <ActionBar seriesId={s.id} signedIn={Boolean(user)} entry={entry} fav={fav} />
          </div>
          <div className="mt-4">
            <Tags series={s} />
          </div>
          {editButton}
        </aside>

        <div className="min-w-0 flex-1">
          {/* Header — cover (mobile, left of title) + title block */}
          <div className="flex gap-4">
            <Cover src={s.coverUrl} className="aspect-[2/3] w-28 shrink-0 sm:hidden" />
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <h1 className="min-w-0 font-display text-2xl leading-tight font-extrabold break-words sm:text-3xl">
                  {s.title}
                </h1>
                <GradeBadge grade={s.grade} score={s.score} className="mt-0.5 shrink-0" />
              </div>
              <p className="mt-1 text-muted">
                {primaryFormat && <span className="text-ink">{primaryFormat} </span>}
                by {s.authors.length ? s.authors.join(", ") : "Unknown author"}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                <StatusPill status={s.status} />
                {stats.length > 0 && (
                  <span className="tnum font-mono text-sm text-muted">{stats.join(" · ")}</span>
                )}
              </div>
            </div>
          </div>

          {/* Ratings — ProgFans first, each links to its venue */}
          {ratings.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {ratings.map((r) => (
                <RatingCard
                  key={r.source}
                  source={r.source}
                  value={r.value}
                  votes={r.votes}
                  href={r.source === "progfans" ? null : linkFor(r.source)}
                />
              ))}
            </div>
          )}

          {/* Add-to-list + favourite — below the ratings on mobile only
              (desktop shows them under the cover in the sidebar). */}
          <div className="mt-4 sm:hidden">
            <ActionBar seriesId={s.id} signedIn={Boolean(user)} entry={entry} fav={fav} />
          </div>

          {s.description && (
            <p className="mt-5 max-w-3xl leading-relaxed whitespace-pre-line text-ink/90">
              {s.description}
            </p>
          )}

          {/* Tags on mobile, below the synopsis */}
          <div className="mt-6 sm:hidden">
            <Tags series={s} />
            {editButton}
          </div>

          {s.books.length > 0 && (
            <section className="mt-8">
              <h2 className="mb-3 font-display text-lg font-bold">
                Books{" "}
                <span className="font-mono text-sm font-normal text-muted">· {s.books.length}</span>
              </h2>
              <div className="space-y-2">
                {s.books.map((b) => (
                  <BookRow key={b.id} book={b} author={author} />
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

function Cover({ src, className }: { src: string | null; className: string }) {
  return (
    <div className={`relative overflow-hidden rounded-lg border border-line bg-line ${className}`}>
      {src && <Image src={src} alt="" fill sizes="210px" className="object-cover" unoptimized />}
    </div>
  );
}

function ActionBar({
  seriesId,
  signedIn,
  entry,
  fav,
}: {
  seriesId: number;
  signedIn: boolean;
  entry: { status: string; score: number | null; notes: string | null } | null;
  fav: boolean;
}) {
  return (
    <div className="flex max-w-sm gap-2">
      <div className="min-w-0 flex-1">
        <AddToListButton
          seriesId={seriesId}
          signedIn={signedIn}
          initialStatus={entry?.status ?? null}
          initialScore={entry?.score ?? null}
          initialNotes={entry?.notes ?? null}
        />
      </div>
      <FavoriteStar seriesId={seriesId} signedIn={signedIn} initialIsFavorite={fav} />
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const m = STATUS_META[status] ?? STATUS_UNKNOWN;
  return (
    <span
      title="Publication status of the series — whether it's finished, ongoing, on hiatus, or dropped"
      className="inline-flex items-center gap-1.5 rounded-full border border-line bg-card px-2.5 py-0.5 text-xs font-medium text-ink"
    >
      <span className={`h-2 w-2 rounded-full ${m.dot}`} />
      {m.label}
    </span>
  );
}

function Tags({ series: s }: { series: SeriesDetail }) {
  const facets = [
    s.mcGender && FACET_LABEL[s.mcGender],
    s.pov && FACET_LABEL[s.pov],
    s.romance && FACET_LABEL[s.romance],
  ].filter(Boolean) as string[];

  const byCategory = new Map<string, typeof s.tropes>();
  for (const t of s.tropes) {
    const list = byCategory.get(t.category) ?? [];
    list.push(t);
    byCategory.set(t.category, list);
  }

  if (facets.length === 0 && s.tropes.length === 0) return null;

  return (
    <div className="space-y-3">
      {facets.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {facets.map((f) => (
            <TropeChip key={f}>{f}</TropeChip>
          ))}
        </div>
      )}
      {CATEGORY_ORDER.filter((c) => byCategory.has(c)).map((category) => (
        <div key={category}>
          <div className="mb-1.5 font-mono text-[10px] tracking-wider text-muted uppercase">
            {TROPE_CATEGORY_LABEL[category] ?? category}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {byCategory.get(category)!.map((t) => (
              <Link key={t.slug} href={`/browse?tropes=${t.slug}`}>
                <TropeChip>{t.name}</TropeChip>
              </Link>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function RatingCard({
  source,
  value,
  votes,
  href,
}: {
  source: string;
  value: number;
  votes: number;
  href: string | null;
}) {
  const display = source === "progfans" ? value.toFixed(1) : fmtRating(value);
  const inner: ReactNode = (
    <>
      <div className="flex items-center gap-1.5">
        <VenueIcon source={source} />
        <span className="font-mono text-[10px] tracking-wider text-muted uppercase">
          {VENUE_LABEL[source] ?? source}
        </span>
        {href && (
          <ExternalIcon className="ml-auto text-muted transition-colors group-hover:text-gold" />
        )}
      </div>
      <div className="tnum mt-0.5 font-mono text-lg font-bold">{display}</div>
      <div className="tnum font-mono text-xs text-muted">{fmtCompact(votes)} ratings</div>
    </>
  );
  const base = "block w-[8.5rem] rounded-lg border border-line bg-card px-4 py-2";
  return href ? (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`group ${base} transition-colors hover:border-gold hover:bg-line/30`}
    >
      {inner}
    </a>
  ) : (
    <div className={base}>{inner}</div>
  );
}

function VenueButton({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="group inline-flex items-center gap-1.5 rounded-md border border-line px-2.5 py-1 text-xs font-medium text-ink transition-colors hover:border-gold hover:bg-line/30"
    >
      {children}
      <ExternalIcon className="text-muted transition-colors group-hover:text-gold" />
    </a>
  );
}

function BookRow({ book, author }: { book: SeriesBook; author: string }) {
  const q = `${book.title} ${author}`.trim();
  return (
    <div className="flex gap-3 rounded-lg border border-line bg-card p-3">
      <div className="relative aspect-[2/3] h-[78px] shrink-0 overflow-hidden rounded border border-line bg-line">
        {book.coverUrl && (
          <Image
            src={book.coverUrl}
            alt=""
            fill
            sizes="52px"
            className="object-cover"
            unoptimized
          />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <h3 className="min-w-0 font-medium text-ink">
            {book.position != null && <span className="text-muted">#{book.position} </span>}
            {book.title}
          </h3>
          {book.gr && (
            <span className="flex shrink-0 items-center gap-1 font-mono text-xs">
              <Image src="/goodreads-logo.png" alt="Goodreads" width={13} height={13} />
              <span className="font-bold text-ink">{fmtRating(book.gr.value)}</span>
              <span className="text-muted">· {fmtCompact(book.gr.votes)}</span>
            </span>
          )}
        </div>
        {book.description && <BookBlurb text={book.description} />}
        <div className="mt-2 flex flex-wrap gap-1.5">
          {book.goodreadsUrl && (
            <VenueButton href={book.goodreadsUrl}>
              <Image src="/goodreads-logo.png" alt="" width={13} height={13} /> Goodreads
            </VenueButton>
          )}
          <VenueButton href={amazonSearch(q)}>
            <Image src="/amazon-logo.png" alt="" width={13} height={13} /> Amazon
          </VenueButton>
          <VenueButton href={audibleSearch(q)}>
            <Image src="/audible-logo.png" alt="" width={13} height={13} /> Audible
          </VenueButton>
        </div>
      </div>
    </div>
  );
}
