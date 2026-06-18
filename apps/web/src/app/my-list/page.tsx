import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";

export const dynamic = "force-dynamic";

// The list lives at the public /list/<username>; /my-list just forwards there.
export default async function MyListRedirect() {
  const { profile } = await requireProfile();
  redirect(`/list/${profile.username}`);
}
