import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getProfile, normalizeUsername, requireUser } from "@/lib/auth";
import { WelcomeForm } from "./WelcomeForm";

export const metadata: Metadata = { title: "Choose a username — ProgFans" };
export const dynamic = "force-dynamic";

export default async function WelcomePage() {
  const user = await requireUser();
  if (await getProfile(user.id)) redirect("/");

  // Pre-fill: username chosen at email signup, else a guess from their email.
  const fromMeta = (user.user_metadata?.username as string | undefined) ?? "";
  const fromEmail = normalizeUsername((user.email ?? "").split("@")[0] ?? "").value ?? "";
  const suggested = fromMeta || fromEmail;

  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4 py-12">
      <Link
        href="/"
        className="mb-8 self-center font-display text-2xl font-extrabold tracking-tight text-ink"
      >
        prog<span className="text-gold">fans</span>
      </Link>

      <div className="rounded-xl border border-line bg-card p-6">
        <h1 className="font-display text-xl font-bold">Pick a username</h1>
        <p className="mt-1 mb-5 text-sm text-muted">
          This is how you&apos;ll show up on ProgFans. You can keep the suggestion or change it.
        </p>
        <WelcomeForm defaultUsername={suggested} />
      </div>
    </div>
  );
}
