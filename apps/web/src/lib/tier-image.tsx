import type { TierListView } from "./tier";

// Server-side rendering helpers for tier-list images (OG card + downloadable
// PNG). Covers are pre-fetched into data URIs so Satori never does its own
// remote fetch — that keeps a single unreachable cover from crashing the route.

// Palettes mirror the site's light/dark CSS tokens.
const LIGHT = {
  PAPER: "#edecf1",
  CARD: "#fbfbfd",
  INK: "#1b1a23",
  MUTED: "#67646f",
  GOLD: "#b07d2b",
  LINE: "#dedce6",
};
const DARK = {
  PAPER: "#15141b",
  CARD: "#1f1e28",
  INK: "#ecebf1",
  MUTED: "#9b97a6",
  GOLD: "#cd9a3c",
  LINE: "#322f3d",
};

export const OG_SIZE = { width: 1200, height: 630 } as const;

const DISPLAY = "Bricolage Grotesque"; // headings / labels (matches the site)
const BODY = "Hanken Grotesk"; // body text

type FontDef = { name: string; data: Buffer; weight: 400 | 700 | 800; style: "normal" };
let fontsPromise: Promise<FontDef[]> | null = null;

// Static `new URL(..., import.meta.url)` so Next traces and bundles the files
// for production. We read them with fs (the Node runtime's fetch can't do
// file:// URLs).
const FONT_URLS = {
  display800: new URL("./fonts/BricolageGrotesque-800.ttf", import.meta.url),
  body400: new URL("./fonts/HankenGrotesk-400.ttf", import.meta.url),
  body700: new URL("./fonts/HankenGrotesk-700.ttf", import.meta.url),
};

/** Load the site's fonts for ImageResponse (cached). Falls back to [] on error. */
export function loadFonts(): Promise<FontDef[]> {
  if (!fontsPromise) {
    fontsPromise = (async () => {
      try {
        const { readFile } = await import("node:fs/promises");
        const { fileURLToPath } = await import("node:url");
        const [bric, hk, hkb] = await Promise.all([
          readFile(fileURLToPath(FONT_URLS.display800)),
          readFile(fileURLToPath(FONT_URLS.body400)),
          readFile(fileURLToPath(FONT_URLS.body700)),
        ]);
        return [
          { name: DISPLAY, data: bric, weight: 800, style: "normal" },
          { name: BODY, data: hk, weight: 400, style: "normal" },
          { name: BODY, data: hkb, weight: 700, style: "normal" },
        ];
      } catch {
        return [];
      }
    })();
  }
  return fontsPromise;
}

/**
 * Detect image format from magic bytes. Our covers are all saved as `<id>.png`
 * and served as image/png regardless of their real format (many are actually
 * JPEG), so the Content-Type header can't be trusted — resvg would crash trying
 * to decode a JPEG as PNG. Returns null for formats resvg can't render.
 */
function sniffMime(b: Buffer): string | null {
  if (b.length < 4) return null;
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image/png";
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) return "image/gif";
  return null; // webp/avif/unknown — skip rather than crash the stream
}

/** Fetch an image and inline it as a base64 data URI; null on any failure. */
export async function toDataUri(url: string | null): Promise<string | null> {
  if (!url) return null;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 5000);
    const res = await fetch(url, { signal: ctrl.signal });
    clearTimeout(timer);
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    const mime = sniffMime(buf);
    if (!mime) return null;
    return `data:${mime};base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

/** Pre-resolve every cover in the list (deduped) to a data URI. */
export async function loadCovers(tier: TierListView): Promise<Map<number, string>> {
  const uniq = [...new Map(tier.tiers.flatMap((r) => r.items).map((s) => [s.id, s])).values()];
  const out = new Map<number, string>();
  await Promise.all(
    uniq.map(async (s) => {
      const uri = await toDataUri(s.coverUrl);
      if (uri) out.set(s.id, uri);
    }),
  );
  return out;
}

type Mode = "og" | "full";

const W = 1200;
const PAD = 44;
const LABEL_W = 88;
const GAP = 8;
const TRACK_PAD = 8;
const ROW_GAP = 10;
const HEADER_H = 118;
const FOOTER_H = 36;

const labelSize = (label: string) =>
  label.length <= 2 ? 34 : label.length <= 5 ? 22 : label.length <= 9 ? 16 : 12;

/**
 * Build the tier-list image element. `og` = fixed 1200×630 summary (top tiers,
 * one row of covers each, "+N" overflow). `full` = every tier and cover, with a
 * height computed to fit.
 */
export function renderTierImage(
  tier: TierListView,
  covers: Map<number, string>,
  mode: Mode,
  dark = false,
) {
  const { PAPER, CARD, INK, MUTED, GOLD, LINE } = dark ? DARK : LIGHT;
  const coverW = mode === "og" ? 58 : 64;
  const coverH = Math.round(coverW * 1.5);
  const contentW = W - PAD * 2 - LABEL_W - TRACK_PAD * 2;
  const perRow = Math.max(1, Math.floor((contentW + GAP) / (coverW + GAP)));

  const allRows = tier.tiers.filter((r) => r.items.length > 0);
  const rows = mode === "og" ? allRows.slice(0, 5) : allRows;
  const ranked = tier.tiers.reduce((n, r) => n + r.items.length, 0);

  let height: number;
  if (mode === "og") {
    height = OG_SIZE.height;
  } else {
    const rowsH = rows.reduce((h, r) => {
      const lines = Math.max(1, Math.ceil(r.items.length / perRow));
      return h + TRACK_PAD * 2 + lines * coverH + (lines - 1) * GAP + ROW_GAP + 2;
    }, 0);
    height = PAD * 2 + HEADER_H + rowsH + FOOTER_H;
  }

  const element = (
    <div
      style={{
        width: W,
        height,
        display: "flex",
        flexDirection: "column",
        background: PAPER,
        color: INK,
        padding: PAD,
        fontFamily: BODY,
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
        <div style={{ display: "flex", fontFamily: DISPLAY, fontSize: 26, fontWeight: 800 }}>
          prog<span style={{ color: GOLD }}>fans</span>
        </div>
        <div style={{ display: "flex", fontSize: 22, color: MUTED }}>
          {tier.ownerUsername ? `@${tier.ownerUsername} · ` : ""}
          {ranked} ranked
        </div>
      </div>

      <div
        style={{
          display: "flex",
          fontFamily: DISPLAY,
          fontSize: 50,
          fontWeight: 800,
          lineHeight: 1.05,
          marginTop: 12,
          marginBottom: 16,
          maxWidth: W - PAD * 2,
          whiteSpace: "nowrap",
          overflow: "hidden",
        }}
      >
        {tier.title}
      </div>

      {/* Tiers */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: ROW_GAP,
          ...(mode === "og" ? { flex: 1 } : { flexShrink: 0 }),
        }}
      >
        {rows.map((row, i) => {
          const items = mode === "og" ? row.items.slice(0, perRow) : row.items;
          const hidden = row.items.length - items.length;
          return (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "stretch",
                border: `1px solid ${LINE}`,
                borderRadius: 12,
                overflow: "hidden",
                background: CARD,
                minHeight: coverH + TRACK_PAD * 2,
              }}
            >
              <div
                style={{
                  display: "flex",
                  width: LABEL_W,
                  alignItems: "center",
                  justifyContent: "center",
                  padding: 6,
                  background: row.color,
                  color: "white",
                  textAlign: "center",
                  lineHeight: 1.05,
                  wordBreak: "break-word",
                  fontFamily: DISPLAY,
                  fontWeight: 800,
                  fontSize: labelSize(row.label),
                }}
              >
                {row.label}
              </div>
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  alignContent: "flex-start",
                  gap: GAP,
                  padding: TRACK_PAD,
                }}
              >
                {items.map((s) => {
                  const uri = covers.get(s.id);
                  return uri ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      key={s.id}
                      src={uri}
                      width={coverW}
                      height={coverH}
                      style={{ objectFit: "cover", borderRadius: 4, border: `1px solid ${LINE}` }}
                      alt=""
                    />
                  ) : (
                    <div
                      key={s.id}
                      style={{
                        display: "flex",
                        width: coverW,
                        height: coverH,
                        borderRadius: 4,
                        background: LINE,
                      }}
                    />
                  );
                })}
                {hidden > 0 && (
                  <div
                    style={{
                      display: "flex",
                      width: coverW,
                      height: coverH,
                      borderRadius: 4,
                      background: LINE,
                      color: MUTED,
                      alignItems: "center",
                      justifyContent: "center",
                      fontFamily: BODY,
                      fontSize: 16,
                      fontWeight: 700,
                    }}
                  >
                    +{hidden}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ display: "flex", marginTop: 14, fontSize: 20, color: MUTED }}>
        progfans · build & share your own progression-fantasy tier list
      </div>
    </div>
  );

  return { element, width: W, height };
}

/** Simple branded fallback used when a list is missing or rendering fails. */
export function fallbackImage(dark = false) {
  const { PAPER, INK, GOLD } = dark ? DARK : LIGHT;
  return (
    <div
      style={{
        width: OG_SIZE.width,
        height: OG_SIZE.height,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: PAPER,
        color: INK,
        fontSize: 48,
        fontWeight: 800,
        fontFamily: DISPLAY,
      }}
    >
      prog<span style={{ color: GOLD }}>fans</span>
    </div>
  );
}
