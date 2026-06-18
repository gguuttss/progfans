import { ImageResponse } from "next/og";
import { getTierList } from "@/lib/queries";
import { fallbackImage, loadCovers, loadFonts, OG_SIZE, renderTierImage } from "@/lib/tier-image";

export const dynamic = "force-dynamic";
export const alt = "Tier list on ProgFans";
export const size = OG_SIZE;
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const fonts = await loadFonts();
  const opts = fonts.length ? { ...OG_SIZE, fonts } : OG_SIZE;
  try {
    const tier = await getTierList(slug);
    if (!tier) return new ImageResponse(fallbackImage(), opts);
    const covers = await loadCovers(tier);
    const { element } = renderTierImage(tier, covers, "og");
    return new ImageResponse(element, opts);
  } catch {
    return new ImageResponse(fallbackImage(), opts);
  }
}
