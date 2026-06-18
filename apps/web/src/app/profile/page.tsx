import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";

export const dynamic = "force-dynamic";

// The profile lives at the public /user/<username>; /profile forwards there.
export default async function ProfileRedirect() {
  const { profile } = await requireProfile();
  redirect(`/user/${profile.username}`);
}
