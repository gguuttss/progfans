import { ImageResponse } from "next/og";
import { getSeries } from "@/lib/queries";
import { loadFonts, OG_SIZE, toDataUri } from "@/lib/tier-image";

export const size = OG_SIZE; // 1200 × 630
export const contentType = "image/png";
export const alt = "Series on ProgFans";

const INK = "#1b1a23";
const PAPER = "#edecf1";
const GOLD = "#cd9a3c";
const MUTED = "#9b97a6";
const LINE = "#3a3747";

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const s = await getSeries(slug);
  const [fonts, cover] = await Promise.all([loadFonts(), s ? toDataUri(s.coverUrl) : null]);

  const title = s?.title ?? "ProgFans";
  const author = s?.authors?.[0];
  const grade = s && s.grade !== "?" ? s.grade : null;
  const titleSize = title.length > 42 ? 46 : title.length > 26 ? 56 : 66;

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        background: INK,
        padding: 56,
        fontFamily: "Hanken Grotesk",
        color: PAPER,
      }}
    >
      {cover ? (
        // biome-ignore lint/performance/noImgElement: Satori renders a plain <img>
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={cover}
          width={345}
          height={518}
          style={{ borderRadius: 14, objectFit: "cover", border: `1px solid ${LINE}` }}
          alt=""
        />
      ) : null}

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          marginLeft: cover ? 52 : 0,
          flex: 1,
        }}
      >
        <div
          style={{
            display: "flex",
            fontFamily: "Bricolage Grotesque",
            fontWeight: 800,
            fontSize: 30,
            letterSpacing: -1,
            marginBottom: 30,
          }}
        >
          <span>prog</span>
          <span style={{ color: GOLD }}>fans</span>
        </div>

        <div
          style={{
            display: "flex",
            fontFamily: "Bricolage Grotesque",
            fontWeight: 800,
            fontSize: titleSize,
            lineHeight: 1.05,
            letterSpacing: -1.5,
          }}
        >
          {title}
        </div>

        {author ? (
          <div style={{ display: "flex", fontSize: 30, color: MUTED, marginTop: 18 }}>
            by {author}
          </div>
        ) : null}

        {grade ? (
          <div style={{ display: "flex", alignItems: "center", gap: 18, marginTop: 38 }}>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                width: 100,
                height: 100,
                borderRadius: 18,
                border: `2px solid ${GOLD}`,
                background: "rgba(205,154,60,0.12)",
                color: GOLD,
              }}
            >
              <span
                style={{
                  display: "flex",
                  fontFamily: "Bricolage Grotesque",
                  fontWeight: 800,
                  fontSize: 46,
                  lineHeight: 1,
                }}
              >
                {grade}
              </span>
              {s && typeof s.score === "number" ? (
                <span style={{ display: "flex", fontSize: 16, marginTop: 4 }}>{s.score}/100</span>
              ) : null}
            </div>
            <span style={{ display: "flex", fontSize: 24, color: MUTED }}>ProgFans tier score</span>
          </div>
        ) : null}
      </div>
    </div>,
    { ...OG_SIZE, ...(fonts.length ? { fonts } : {}) },
  );
}
