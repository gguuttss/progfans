import { ImageResponse } from "next/og";
import { loadFonts } from "@/lib/tier-image";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

// The "pf" mark, rendered in the brand display font on a rounded ink square.
export default async function Icon() {
  const fonts = await loadFonts();
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#1b1a23",
        borderRadius: 7,
        fontFamily: "Bricolage Grotesque",
        fontWeight: 800,
        fontSize: 21,
        letterSpacing: -1,
      }}
    >
      <span style={{ color: "#edecf1" }}>p</span>
      <span style={{ color: "#b07d2b" }}>f</span>
    </div>,
    { ...size, ...(fonts.length ? { fonts } : {}) },
  );
}
