"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { deleteTierList } from "@/app/actions/tier";

const BASE =
  "inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors";
const NEUTRAL = `${BASE} border-line text-ink hover:border-gold`;
const GOLD = `${BASE} border-gold bg-gold text-paper hover:opacity-90`;
const BLACK = `${BASE} border-ink bg-ink text-paper hover:opacity-90`;
const RED = `${BASE} border-rose-600 bg-rose-600 text-white hover:opacity-90`;

export function TierActions({
  id,
  slug,
  title,
  isOwner,
}: {
  id: number;
  slug: string;
  title: string;
  isOwner: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [deleting, startDelete] = useTransition();

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/tier/${slug}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // ignore (e.g. insecure context)
    }
  };

  return (
    <div className="flex flex-col gap-2 sm:items-end">
      {/* Primary actions */}
      <div className="flex flex-wrap gap-2 sm:justify-end">
        <Link href={`/tier/new?remix=${slug}`} className={GOLD}>
          <RemixIcon /> Remix
        </Link>
        {isOwner && (
          <>
            <Link href={`/tier/${slug}/edit`} className={BLACK}>
              <PencilIcon /> Edit
            </Link>
            <button type="button" onClick={() => setConfirming(true)} className={RED}>
              <TrashIcon /> Delete
            </button>
          </>
        )}
      </div>

      {/* Share actions */}
      <div className="flex flex-wrap gap-2 sm:justify-end">
        <button type="button" onClick={copy} className={NEUTRAL}>
          <LinkIcon /> {copied ? "Link copied!" : "Copy link"}
        </button>
        <a href={`/tier/${slug}/share`} download={`progfans-tier-${slug}.png`} className={NEUTRAL}>
          <DownloadIcon /> Download image
        </a>
      </div>

      {confirming && (
        <DeleteModal
          title={title}
          deleting={deleting}
          onCancel={() => setConfirming(false)}
          onConfirm={() => startDelete(() => deleteTierList(id))}
        />
      )}
    </div>
  );
}

function DeleteModal({
  title,
  deleting,
  onCancel,
  onConfirm,
}: {
  title: string;
  deleting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onCancel();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCancel]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4"
      role="dialog"
      aria-modal="true"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-sm rounded-xl border border-line bg-paper p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-display text-lg font-bold text-ink">Delete this tier list?</h2>
        <p className="mt-1.5 text-sm text-muted">
          “{title}” will be permanently removed. This can’t be undone.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onCancel} className={NEUTRAL}>
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={deleting}
            className={`${RED} disabled:opacity-60`}
          >
            <TrashIcon /> {deleting ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

// ── Icons (Feather-style, 16px, inherit color) ──────────────────────────────

const iconProps = {
  width: 16,
  height: 16,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

function LinkIcon() {
  return (
    <svg {...iconProps}>
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg {...iconProps}>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

function RemixIcon() {
  return (
    <svg {...iconProps}>
      <polyline points="16 3 21 3 21 8" />
      <line x1="4" y1="20" x2="21" y2="3" />
      <polyline points="21 16 21 21 16 21" />
      <line x1="15" y1="15" x2="21" y2="21" />
      <line x1="4" y1="4" x2="9" y2="9" />
    </svg>
  );
}

function PencilIcon() {
  return (
    <svg {...iconProps}>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg {...iconProps}>
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  );
}
