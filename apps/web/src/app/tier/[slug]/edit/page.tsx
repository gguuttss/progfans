import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { SiteHeader } from "@/components/SiteHeader";
import { TierBuilder } from "@/components/TierBuilder";
import { requireProfile } from "@/lib/auth";
import { getTierList, getTrackedSeries } from "@/lib/queries";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Edit tier list — ProgFans" };

export default async function EditTierPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { user } = await requireProfile();

  const list = await getTierList(slug);
  if (!list) notFound();
  if (list.ownerId !== user.id) redirect(`/tier/${slug}`);

  const tracked = await getTrackedSeries(user.id);

  return (
    <div className="mx-auto max-w-6xl px-4 pb-12">
      <SiteHeader />
      <div className="mb-6">
        <h1 className="font-display text-3xl font-extrabold">Edit tier list</h1>
        <p className="mt-1 text-muted">Drag to re-rank, then save your changes.</p>
      </div>
      <TierBuilder mode="edit" signedIn tracked={tracked} seed={list} listId={list.id} />
    </div>
  );
}
