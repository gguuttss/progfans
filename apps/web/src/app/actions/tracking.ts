"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getProfile, getUser } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { LIST_STATUSES, type ListStatusValue, SCORELESS_STATUSES } from "@/lib/list";

/**
 * Set (or clear) the signed-in user's list entry for a series. Passing
 * `status: null` removes the entry. Score is forced null for scoreless
 * statuses (e.g. "plan to read"). Returns `{ ok: false }` when not signed in.
 */
export async function setEntry(
  seriesId: number,
  status: ListStatusValue | null,
  score: number | null,
  notes: string | null = null,
): Promise<{ ok: boolean }> {
  const user = await getUser();
  if (!user) return { ok: false };

  // Must have completed onboarding (picked a username) before tracking.
  if (!(await getProfile(user.id))) redirect("/welcome");

  if (status !== null && !LIST_STATUSES.includes(status)) return { ok: false };

  const scoreless = status != null && SCORELESS_STATUSES.includes(status);
  const safeScore = !scoreless && score != null && score >= 1 && score <= 10 ? score : null;
  const safeNotes = notes?.trim() ? notes.trim().slice(0, 2000) : null;

  if (status === null) {
    await db
      .delete(schema.listEntries)
      .where(
        and(eq(schema.listEntries.userId, user.id), eq(schema.listEntries.seriesId, seriesId)),
      );
  } else {
    await db
      .insert(schema.listEntries)
      .values({ userId: user.id, seriesId, status, score: safeScore, notes: safeNotes })
      .onConflictDoUpdate({
        target: [schema.listEntries.userId, schema.listEntries.seriesId],
        set: { status, score: safeScore, notes: safeNotes, updatedAt: new Date() },
      });
  }

  revalidatePath("/list/[username]", "page");
  return { ok: true };
}
