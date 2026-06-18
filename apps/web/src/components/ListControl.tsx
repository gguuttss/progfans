"use client";

import Link from "next/link";
import { useTransition } from "react";
import { setEntry } from "@/app/actions/tracking";
import { LIST_STATUS_LABEL, LIST_STATUSES, type ListStatusValue } from "@/lib/list";

type Props = {
  seriesId: number;
  signedIn: boolean;
  initialStatus: string | null;
  initialScore: number | null;
  compact?: boolean;
};

export function ListControl({
  seriesId,
  signedIn,
  initialStatus,
  initialScore,
  compact = false,
}: Props) {
  const [pending, startTransition] = useTransition();

  if (!signedIn) {
    if (compact) return null;
    return (
      <Link
        href="/login"
        className="block rounded-md border border-line bg-card px-3 py-2 text-center text-sm font-medium text-ink transition-colors hover:border-gold"
      >
        Sign in to track
      </Link>
    );
  }

  const status = (initialStatus as ListStatusValue | null) ?? null;
  const score = initialScore;

  const onStatus = (next: string) => {
    const value = next === "" ? null : (next as ListStatusValue);
    startTransition(async () => {
      await setEntry(seriesId, value, value === null ? null : score);
    });
  };

  const onScore = (next: string) => {
    if (!status) return;
    const value = next === "" ? null : Number(next);
    startTransition(async () => {
      await setEntry(seriesId, status, value);
    });
  };

  const select =
    "rounded-md border border-line bg-card text-ink outline-none focus:border-gold disabled:opacity-50";

  if (compact) {
    return (
      <div className={`flex items-center gap-1.5 ${pending ? "opacity-60" : ""}`}>
        <select
          aria-label="My status"
          value={status ?? ""}
          onChange={(e) => onStatus(e.target.value)}
          disabled={pending}
          className={`${select} px-2 py-1 text-xs ${status ? "border-gold/50" : ""}`}
        >
          <option value="">+ Track</option>
          {LIST_STATUSES.map((s) => (
            <option key={s} value={s}>
              {LIST_STATUS_LABEL[s]}
            </option>
          ))}
        </select>
        {status && (
          <select
            aria-label="My score"
            value={score ?? ""}
            onChange={(e) => onScore(e.target.value)}
            disabled={pending}
            className={`${select} px-2 py-1 text-xs`}
          >
            <option value="">–</option>
            {Array.from({ length: 10 }, (_, i) => 10 - i).map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        )}
      </div>
    );
  }

  return (
    <div className={`flex flex-col gap-2 ${pending ? "opacity-60" : ""}`}>
      <label className="flex flex-col gap-1 text-xs">
        <span className="font-mono tracking-wider text-muted uppercase">My status</span>
        <select
          value={status ?? ""}
          onChange={(e) => onStatus(e.target.value)}
          disabled={pending}
          className={`${select} px-3 py-2 text-sm`}
        >
          <option value="">Not tracked</option>
          {LIST_STATUSES.map((s) => (
            <option key={s} value={s}>
              {LIST_STATUS_LABEL[s]}
            </option>
          ))}
        </select>
      </label>

      {status && (
        <label className="flex flex-col gap-1 text-xs">
          <span className="font-mono tracking-wider text-muted uppercase">My score</span>
          <select
            value={score ?? ""}
            onChange={(e) => onScore(e.target.value)}
            disabled={pending}
            className={`${select} px-3 py-2 text-sm`}
          >
            <option value="">No score</option>
            {Array.from({ length: 10 }, (_, i) => 10 - i).map((n) => (
              <option key={n} value={n}>
                {n} / 10
              </option>
            ))}
          </select>
        </label>
      )}
    </div>
  );
}
