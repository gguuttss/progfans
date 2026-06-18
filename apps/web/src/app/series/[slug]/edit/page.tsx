import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SeriesEditor } from "@/components/SeriesEditor";
import { SiteHeader } from "@/components/SiteHeader";
import { requireProfile } from "@/lib/auth";
import { getSeries, getSeriesEditState, getTropeOptions } from "@/lib/queries";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Edit series — ProgFans" };

export default async function EditSeriesPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { profile } = await requireProfile(); // must be signed in (redirects otherwise)

  const series = await getSeries(slug);
  if (!series) notFound();
  const [initial, tropeOptions] = await Promise.all([
    getSeriesEditState(series.id),
    getTropeOptions(),
  ]);
  if (!initial) notFound();

  return (
    <div className="mx-auto max-w-3xl px-4 pb-12">
      <SiteHeader />
      <h1 className="font-display text-2xl leading-tight font-extrabold">Edit “{series.title}”</h1>
      <p className="mt-1 mb-6 text-sm text-muted">
        {profile.isAdmin
          ? "You’re an admin — your changes go live immediately."
          : "Suggest changes — they’ll be reviewed by an admin before going live."}
      </p>
      <SeriesEditor
        seriesId={series.id}
        slug={slug}
        initial={initial}
        tropeOptions={tropeOptions}
        isAdmin={profile.isAdmin}
      />
    </div>
  );
}
