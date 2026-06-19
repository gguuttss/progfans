import { cookies } from "next/headers";
import { ImageResponse } from "next/og";
import { getTierList } from "@/lib/queries";
import { loadCovers, loadFonts, renderTierImage } from "@/lib/tier-image";

export const dynamic = "force-dynamic";

/**
 * A full-size PNG of the whole tier list, served as a download so people can
 * post it directly to Reddit/Discord (where an image post lands better than a
 * bare link). Unlike the OG card this shows every tier and every cover.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const tier = await getTierList(slug);
  if (!tier) return new Response("Not found", { status: 404 });

  const dark = (await cookies()).get("theme")?.value === "dark";
  const [covers, fonts] = await Promise.all([loadCovers(tier), loadFonts()]);
  const { element, width, height } = renderTierImage(tier, covers, "full", dark);

  return new ImageResponse(element, {
    width,
    height,
    ...(fonts.length ? { fonts } : {}),
    headers: {
      "Content-Disposition": `attachment; filename="progfans-tier-${slug}.png"`,
      // The image reflects mutable data (title, tiers, covers) — never serve a
      // stale copy after an edit.
      "Cache-Control": "no-store, max-age=0",
    },
  });
}
