import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { AddToListButton } from "./AddToListButton";
import { CardDescription } from "./CardDescription";
import { fmtCompact, fmtRating } from "@/lib/format";
import type { CatalogItem } from "@/lib/queries";
import { GradeBadge } from "./GradeBadge";
import { TropeChip } from "./TropeChip";

// The ProgFans "pf" mark, matching the logo's black-p / gold-f wordmark.
function PfMark() {
  return (
    <span
      className="font-display text-[13px] leading-none font-extrabold text-ink"
      aria-label="ProgFans"
    >
      p<span className="text-gold">f</span>
    </span>
  );
}

function Rating({ icon, value, votes }: { icon: ReactNode; value: string; votes: number }) {
  return (
    <span className="inline-flex items-center gap-1">
      {icon}
      <span className="font-semibold text-ink">{value}</span>
      <span className="text-muted">· {fmtCompact(votes)}</span>
    </span>
  );
}

export function SeriesCard({ item, signedIn }: { item: CatalogItem; signedIn: boolean }) {
  return (
    <div className="group relative flex min-w-0 flex-col gap-3 rounded-lg border border-line bg-card p-3 transition-colors hover:border-gold/60">
      {/* Full-card link sits beneath; interactive bits opt back in below. */}
      <Link
        href={`/series/${item.slug}`}
        aria-label={item.title}
        className="absolute inset-0 z-0 rounded-lg"
      />

      {/* Row 1 — cover (height-constrained) + title/author/badge/description.
          The cover stretches to the text block's height; its width follows the
          2:3 aspect. The synopsis shows 4 lines, then scrolls. */}
      <div className="pointer-events-none relative z-10 flex gap-4">
        <div className="relative h-[7.5rem] aspect-[2/3] shrink-0 overflow-hidden rounded bg-line">
          {item.coverUrl && (
            <Image
              src={item.coverUrl}
              alt=""
              fill
              sizes="80px"
              className="object-cover"
              unoptimized
            />
          )}
        </div>

        <div className="pointer-events-none flex min-w-0 flex-1 flex-col">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="font-display text-lg leading-tight font-bold break-words text-ink group-hover:text-gold">
                {item.title}
              </h3>
              <p className="truncate text-sm text-muted">{item.authors || "Unknown author"}</p>
            </div>
            <GradeBadge grade={item.grade} score={item.score} className="shrink-0" />
          </div>

          {item.description && (
            <div className="mt-2">
              <CardDescription text={item.description} href={`/series/${item.slug}`} />
            </div>
          )}
        </div>
      </div>

      {/* Row 2 — per-source ratings, full width, left-aligned */}
      {(item.progfans || item.rr || item.gr) && (
        <div className="pointer-events-none relative z-10 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-xs">
          {item.progfans && (
            <Rating
              icon={<PfMark />}
              value={item.progfans.value.toFixed(1)}
              votes={item.progfans.votes}
            />
          )}
          {item.rr && (
            <Rating
              icon={<Image src="/royalroad-logo.png" alt="Royal Road" width={14} height={14} />}
              value={fmtRating(item.rr.value)}
              votes={item.rr.votes}
            />
          )}
          {item.gr && (
            <Rating
              icon={<Image src="/goodreads-logo.png" alt="Goodreads" width={14} height={14} />}
              value={fmtRating(item.gr.value)}
              votes={item.gr.votes}
            />
          )}
        </div>
      )}

      {/* Row 3 — tags + the square add/edit button, vertically centered */}
      <div className="pointer-events-none relative z-10 flex items-center justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-1">
          {item.tropes.slice(0, 6).map((t) => (
            <TropeChip key={t}>{t}</TropeChip>
          ))}
          {item.tropes.length > 6 && (
            <span className="text-xs text-muted">+{item.tropes.length - 6}</span>
          )}
        </div>
        <div className="pointer-events-auto shrink-0">
          <AddToListButton
            seriesId={item.id}
            signedIn={signedIn}
            initialStatus={item.myStatus}
            initialScore={item.myScore}
            initialNotes={item.myNotes}
            icon
          />
        </div>
      </div>
    </div>
  );
}
