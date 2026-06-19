import { ImageResponse } from "next/og";
import { loadFonts, OG_SIZE } from "@/lib/tier-image";

export const size = OG_SIZE; // 1200 × 630
export const contentType = "image/png";
export const alt = "ProgFans — discover progression fantasy & litRPG";

const INK = "#1b1a23";
const PAPER = "#edecf1";
const GOLD = "#cd9a3c";
const MUTED = "#9b97a6";

export default async function Image() {
  const fonts = await loadFonts();

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: INK,
        color: PAPER,
        fontFamily: "Hanken Grotesk",
        padding: 80,
      }}
    >
      <div
        style={{
          display: "flex",
          fontFamily: "Bricolage Grotesque",
          fontWeight: 800,
          fontSize: 120,
          letterSpacing: -3,
        }}
      >
        <span>prog</span>
        <span style={{ color: GOLD }}>fans</span>
      </div>
      <div style={{ display: "flex", fontSize: 42, marginTop: 22 }}>
        Discover progression fantasy &amp; litRPG
      </div>
      <div style={{ display: "flex", fontSize: 26, color: MUTED, marginTop: 18 }}>
        Ratings from Royal Road &amp; Goodreads · tier lists · tracking
      </div>
    </div>,
    { ...OG_SIZE, ...(fonts.length ? { fonts } : {}) },
  );
}
