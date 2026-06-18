import type { Metadata } from "next";
import { RequestForm } from "@/components/RequestForm";
import { SiteHeader } from "@/components/SiteHeader";
import { requireProfile } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Request a book — ProgFans" };

export default async function RequestPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await requireProfile(); // sign-in required to request
  const { q } = await searchParams;

  return (
    <div className="mx-auto max-w-xl px-4 pb-12">
      <SiteHeader />
      <h1 className="font-display text-2xl leading-tight font-extrabold">Request a book</h1>
      <p className="mt-1 mb-6 text-sm text-muted">
        Missing something? Tell us about it and an admin will add it to the catalog.
      </p>
      <RequestForm initialTitle={q?.slice(0, 200) ?? ""} />
    </div>
  );
}
