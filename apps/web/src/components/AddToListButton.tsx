"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { setEntry } from "@/app/actions/tracking";
import {
  LIST_STATUS_LABEL,
  LIST_STATUS_STYLE,
  LIST_STATUSES,
  type ListStatusValue,
  SCORELESS_STATUSES,
} from "@/lib/list";

type Entry = { status: ListStatusValue | null; score: number | null; notes: string | null };

type Props = {
  seriesId: number;
  signedIn: boolean;
  initialStatus: string | null;
  initialScore: number | null;
  initialNotes: string | null;
  /** Square icon-only button (for cards) vs. full-width labeled button. */
  icon?: boolean;
  className?: string;
};

const PencilIcon = (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path
      d="M4 20h4L18.5 9.5a2.12 2.12 0 0 0-3-3L5 17v3z"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinejoin="round"
    />
  </svg>
);

export function AddToListButton({
  seriesId,
  signedIn,
  initialStatus,
  initialScore,
  initialNotes,
  icon = false,
  className = "",
}: Props) {
  const [entry, setLocal] = useState<Entry>({
    status: (initialStatus as ListStatusValue | null) ?? null,
    score: initialScore,
    notes: initialNotes,
  });
  const [open, setOpen] = useState(false);

  const iconBase =
    "flex h-9 w-9 shrink-0 items-center justify-center rounded-md transition-opacity hover:opacity-90";

  if (!signedIn) {
    return icon ? (
      <Link
        href="/login"
        aria-label="Add to list"
        className={`${iconBase} border border-line bg-card text-lg font-bold text-ink hover:border-gold ${className}`}
      >
        +
      </Link>
    ) : (
      <Link
        href="/login"
        className={`block rounded-md border border-line bg-card px-3 py-2 text-center text-sm font-medium text-ink transition-colors hover:border-gold ${className}`}
      >
        + Add to list
      </Link>
    );
  }

  const onList = entry.status != null;
  const colorClass = onList
    ? LIST_STATUS_STYLE[entry.status as ListStatusValue]
    : "border border-line bg-card text-ink hover:border-gold";

  return (
    <>
      {icon ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={
            onList
              ? `Edit list status (${LIST_STATUS_LABEL[entry.status as ListStatusValue]})`
              : "Add to list"
          }
          title={onList ? LIST_STATUS_LABEL[entry.status as ListStatusValue] : "Add to list"}
          className={`${iconBase} ${colorClass} ${className}`}
        >
          {onList ? PencilIcon : <span className="text-lg font-bold leading-none">+</span>}
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={`block w-full rounded-md px-3 py-2 text-center text-sm font-medium transition-opacity hover:opacity-90 ${colorClass} ${className}`}
        >
          {onList ? LIST_STATUS_LABEL[entry.status as ListStatusValue] : "+ Add to list"}
        </button>
      )}
      {open && (
        <ListModal
          seriesId={seriesId}
          initial={entry}
          onClose={() => setOpen(false)}
          onSaved={(e) => setLocal(e)}
        />
      )}
    </>
  );
}

function ListModal({
  seriesId,
  initial,
  onClose,
  onSaved,
}: {
  seriesId: number;
  initial: Entry;
  onClose: () => void;
  onSaved: (e: Entry) => void;
}) {
  const [status, setStatus] = useState<ListStatusValue>(initial.status ?? "plan");
  const [score, setScore] = useState<number | null>(initial.score);
  const [notes, setNotes] = useState(initial.notes ?? "");
  const [pending, start] = useTransition();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const scoreless = SCORELESS_STATUSES.includes(status);

  const save = () =>
    start(async () => {
      const s = scoreless ? null : score;
      const res = await setEntry(seriesId, status, s, notes);
      if (res.ok) {
        onSaved({ status, score: s, notes: notes.trim() || null });
        onClose();
      }
    });

  const remove = () =>
    start(async () => {
      const res = await setEntry(seriesId, null, null, null);
      if (res.ok) {
        onSaved({ status: null, score: null, notes: null });
        onClose();
      }
    });

  if (!mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div className="absolute inset-0 bg-ink/40 backdrop-blur-[1px]" />
      <div
        className="relative w-full max-w-sm rounded-xl border border-line bg-card p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-display text-lg font-bold">Add to your list</h3>

        <div className="mt-4">
          <div className="mb-1.5 font-mono text-xs tracking-wider text-muted uppercase">Status</div>
          <div className="grid grid-cols-2 gap-2">
            {LIST_STATUSES.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStatus(s)}
                className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  status === s
                    ? LIST_STATUS_STYLE[s]
                    : "border border-line text-ink hover:border-gold"
                }`}
              >
                {LIST_STATUS_LABEL[s]}
              </button>
            ))}
          </div>
        </div>

        {!scoreless && (
          <div className="mt-4">
            <div className="mb-1.5 font-mono text-xs tracking-wider text-muted uppercase">
              Score
            </div>
            <select
              value={score ?? ""}
              onChange={(e) => setScore(e.target.value === "" ? null : Number(e.target.value))}
              className="w-full rounded-md border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-gold"
            >
              <option value="">No score</option>
              {Array.from({ length: 10 }, (_, i) => 10 - i).map((n) => (
                <option key={n} value={n}>
                  {n} / 10
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="mt-4">
          <div className="mb-1.5 font-mono text-xs tracking-wider text-muted uppercase">Notes</div>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            maxLength={2000}
            placeholder="Private notes…"
            className="w-full resize-none rounded-md border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-gold"
          />
        </div>

        <div className="mt-5 flex items-center gap-2">
          <button
            type="button"
            onClick={save}
            disabled={pending}
            className="flex-1 rounded-md bg-ink px-3 py-2 text-sm font-medium text-paper transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {pending ? "…" : "Save"}
          </button>
          {initial.status && (
            <button
              type="button"
              onClick={remove}
              disabled={pending}
              className="rounded-md border border-rose-300 px-3 py-2 text-sm font-medium text-rose-600 transition-colors hover:bg-rose-50 disabled:opacity-50"
            >
              Remove
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-line px-3 py-2 text-sm font-medium text-muted transition-colors hover:text-ink"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
