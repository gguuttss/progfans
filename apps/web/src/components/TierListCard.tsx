import Image from "next/image";
import Link from "next/link";
import { VoteButton } from "@/components/VoteButton";
import { fmtDate } from "@/lib/format";
import type { TierListSummary } from "@/lib/queries";

export function TierListCard({ list, signedIn }: { list: TierListSummary; signedIn: boolean }) {
  return (
    <div className="group relative rounded-lg border border-line bg-card p-3 transition-colors hover:border-gold">
      <Link
        href={`/tier/${list.slug}`}
        aria-label={list.title}
        className="absolute inset-0 z-0 rounded-lg"
      />
      <div className="pointer-events-none relative z-10 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate font-display font-bold text-ink group-hover:text-gold">
            {list.title}
          </h2>
          <p className="mt-0.5 truncate text-xs text-muted">
            {list.ownerUsername ? `@${list.ownerUsername}` : "Anonymous"} · {list.ranked} ranked ·{" "}
            {fmtDate(list.createdAt)}
          </p>
        </div>
        <div className="pointer-events-auto shrink-0">
          <VoteButton
            id={list.id}
            initialVotes={list.votes}
            initialVoted={list.voted}
            signedIn={signedIn}
          />
        </div>
      </div>

      {list.covers.length > 0 && (
        <div className="pointer-events-none relative z-10 mt-3 flex gap-1 overflow-hidden">
          {list.covers.map((c, i) => (
            <div
              key={i}
              className="relative aspect-[2/3] w-10 shrink-0 overflow-hidden rounded border border-line bg-line"
            >
              <Image src={c} alt="" fill sizes="40px" className="object-cover" unoptimized />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
