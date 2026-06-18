/** Parse an integer that may contain thousands separators ("32,003" -> 32003). */
export const parseIntComma = (s: string | undefined | null): number => {
  if (!s) return 0;
  const n = parseInt(s.replace(/[^\d]/g, ""), 10);
  return Number.isNaN(n) ? 0 : n;
};

export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const slugify = (s: string): string =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80) || "untitled";
