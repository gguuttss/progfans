import type { Metadata } from "next";
import { SiteHeader } from "@/components/SiteHeader";
import { TierBuilder } from "@/components/TierBuilder";
import { getProfile, getUser } from "@/lib/auth";
import { getTierList, getTrackedSeries } from "@/lib/queries";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Build a tier list — ProgFans" };

export default async function NewTierPage({
  searchParams,
}: {
  searchParams: Promise<{ remix?: string }>;
}) {
  const { remix } = await searchParams;

  const user = await getUser();
  const profile = user ? await getProfile(user.id) : null;
  const signedIn = Boolean(profile);

  const [tracked, seed] = await Promise.all([
    profile ? getTrackedSeries(profile.id) : Promise.resolve([]),
    remix ? getTierList(remix) : Promise.resolve(null),
  ]);

  return (
    <div className="mx-auto max-w-6xl px-4 pb-12">
      <SiteHeader />
      <div className="mb-6">
        <h1 className="font-display text-3xl font-extrabold">
          {seed ? "Remix a tier list" : "Build a tier list"}
        </h1>
        <p className="mt-1 text-muted">
          Drag covers into tiers. {signedIn ? "Your tracked series are below." : ""} Share it
          anywhere — anyone can view and remix.
        </p>
      </div>
      <TierBuilder mode="new" signedIn={signedIn} tracked={tracked} seed={seed} />
    </div>
  );
}
