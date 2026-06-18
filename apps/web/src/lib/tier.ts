/**
 * Shared tier-list types and helpers. Safe to import from both client and
 * server (no DB, no "server-only"). The server action validates against the
 * limits here; the builder UI seeds itself from DEFAULT_TIERS / the palette.
 */

export type TierSeries = {
  id: number;
  slug: string;
  title: string;
  coverUrl: string | null;
};

/** One tier row as stored / rendered. `items` are series in display order. */
export type TierRowData = {
  label: string;
  color: string;
  items: TierSeries[];
};

/** A full tier list for the public view and as the editor's seed. */
export type TierListView = {
  id: number;
  slug: string;
  title: string;
  ownerId: string | null;
  ownerUsername: string | null;
  remixedFrom: number | null;
  remixedFromSlug: string | null;
  remixedFromTitle: string | null;
  createdAt: string;
  tiers: TierRowData[];
};

/** The serializable shape the builder POSTs to `saveTierList`. */
export type SaveTierPayload = {
  id?: number; // present when editing an existing owned list
  title: string;
  remixedFrom?: number | null;
  tiers: Array<{ label: string; color: string; items: number[] }>;
};

// Conventional S→F ramp, muted slightly to sit on the cool-stone paper.
export const DEFAULT_TIERS: Array<{ label: string; color: string }> = [
  { label: "S", color: "#e15b64" },
  { label: "A", color: "#ef8b50" },
  { label: "B", color: "#f0b132" },
  { label: "C", color: "#b6c44e" },
  { label: "D", color: "#5fb98e" },
  { label: "F", color: "#5b8fb0" },
];

/** Swatches offered when recoloring a tier. */
export const TIER_COLOR_PALETTE = [
  "#e15b64",
  "#ef8b50",
  "#f0b132",
  "#b6c44e",
  "#5fb98e",
  "#3e9db1",
  "#5b8fb0",
  "#8a5cd6",
  "#c9779e",
  "#8a8893",
];

export const TIER_LIMITS = {
  maxTiers: 12,
  maxItems: 120,
  maxLabel: 48,
  maxTitle: 80,
} as const;

const HEX_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

export function isValidHexColor(c: string): boolean {
  return HEX_RE.test(c);
}

/** Tidy a free-text title; falls back to a default. Caps at the title limit. */
export function normalizeTitle(raw: string): string {
  const t = raw.trim().replace(/\s+/g, " ").slice(0, TIER_LIMITS.maxTitle);
  return t || "Untitled tier list";
}

/** URL-safe slug fragment from a title (the random suffix is added server-side). */
export function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "tier-list"
  );
}
