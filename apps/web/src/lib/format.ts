import type { Rarity } from "@progfans/db/rating";

export const fmtInt = (n: number | null | undefined): string =>
  n == null ? "—" : n.toLocaleString("en-US");

export const fmtCompact = (n: number | null | undefined): string =>
  n == null
    ? "—"
    : Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(n);

export const fmtRating = (n: number | null | undefined): string => (n == null ? "—" : n.toFixed(2));

export const fmtDate = (d: string | null | undefined): string =>
  d
    ? new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })
    : "—";

export function fmtBirthday(date: string | null, precision: string | null): string | null {
  if (!date) return null;
  const d = new Date(date);
  if (precision === "year") return String(d.getUTCFullYear());
  const opts: Intl.DateTimeFormatOptions =
    precision === "month"
      ? { year: "numeric", month: "long", timeZone: "UTC" }
      : { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" };
  return d.toLocaleDateString("en-US", opts);
}

export function fmtRelative(d: string): string {
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  if (days < 30) return `${days}d ago`;
  const mo = Math.floor(days / 30);
  if (mo < 12) return `${mo}mo ago`;
  return `${Math.floor(mo / 12)}y ago`;
}

// "stub" means the author pulled chapters because the series got published —
// readers care that it's *published*, so label it that way.
export const STATUS_LABEL: Record<string, string> = {
  ongoing: "Ongoing",
  completed: "Completed",
  hiatus: "Hiatus",
  dropped: "Dropped",
  stub: "Published",
  unknown: "Unknown",
};

export const FACET_LABEL: Record<string, string> = {
  // romance
  none: "No romance",
  subplot: "Romance subplot",
  central: "Romance central",
  // pov
  single: "Single POV",
  multiple: "Multiple POV",
  // mc gender
  male: "Male lead",
  female: "Female lead",
  nonbinary: "Non-binary lead",
  ensemble: "Ensemble cast",
};

export const RARITY_LABEL: Record<Rarity, string> = {
  common: "Common",
  uncommon: "Uncommon",
  rare: "Rare",
  epic: "Epic",
  legendary: "Legendary",
};

export const TROPE_CATEGORY_LABEL: Record<string, string> = {
  power_system: "Power system",
  setting: "Setting",
  progression: "Progression",
  protagonist: "Protagonist",
  tone: "Tone",
  relationships: "Relationships",
  content_warning: "Content warnings",
};
