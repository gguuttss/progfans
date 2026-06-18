"use server";

import { and, eq, inArray, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getProfile, getUser, requireProfile } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import {
  isValidHexColor,
  normalizeTitle,
  type SaveTierPayload,
  slugify,
  TIER_LIMITS,
} from "@/lib/tier";

export type SaveResult = { ok: boolean; slug?: string; error?: string };

const NEUTRAL = "#8a8893";

function shortId(): string {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 7);
}

type CleanTier = { label: string; color: string; items: number[] };

/**
 * Validate + normalize the builder payload: keep only series that exist, dedupe
 * across the whole list (a series sits in one tier), and clamp labels/colors.
 * Returns null when there's nothing worth saving.
 */
async function cleanPayload(payload: SaveTierPayload): Promise<CleanTier[] | null> {
  const rawTiers = Array.isArray(payload.tiers) ? payload.tiers.slice(0, TIER_LIMITS.maxTiers) : [];

  const wanted = new Set<number>();
  for (const t of rawTiers) {
    for (const id of t.items ?? []) if (Number.isInteger(id)) wanted.add(Number(id));
  }

  const existing = new Set<number>();
  if (wanted.size > 0) {
    const rows = await db
      .select({ id: schema.series.id })
      .from(schema.series)
      .where(inArray(schema.series.id, [...wanted]));
    for (const r of rows) existing.add(Number(r.id));
  }

  const used = new Set<number>();
  let total = 0;
  const tiers: CleanTier[] = rawTiers.map((t, i) => {
    const label = (t.label ?? "").trim().slice(0, TIER_LIMITS.maxLabel) || `T${i + 1}`;
    const color = isValidHexColor(t.color ?? "") ? t.color : NEUTRAL;
    const items: number[] = [];
    for (const raw of t.items ?? []) {
      const id = Number(raw);
      if (!existing.has(id) || used.has(id) || total >= TIER_LIMITS.maxItems) continue;
      used.add(id);
      items.push(id);
      total++;
    }
    return { label, color, items };
  });

  if (total === 0) return null;
  return tiers;
}

/**
 * Create or update a tier list for the signed-in user. Anonymous callers are
 * redirected to /login (their draft survives client-side). Returns the slug to
 * navigate to on success.
 */
export async function saveTierList(payload: SaveTierPayload): Promise<SaveResult> {
  const { user } = await requireProfile();

  const title = normalizeTitle(payload.title ?? "");
  const tiers = await cleanPayload(payload);
  if (!tiers) return { ok: false, error: "Add at least one series to a tier." };

  // ── Update an existing, owned list (same slug) ──
  if (payload.id) {
    const [owned] = await db
      .select({ id: schema.tierLists.id, slug: schema.tierLists.slug })
      .from(schema.tierLists)
      .where(and(eq(schema.tierLists.id, payload.id), eq(schema.tierLists.ownerId, user.id)))
      .limit(1);
    if (!owned) return { ok: false, error: "That tier list isn't yours to edit." };

    await db.transaction(async (tx) => {
      await tx.update(schema.tierLists).set({ title }).where(eq(schema.tierLists.id, payload.id!));
      // Children cascade on delete; reinsert from scratch.
      await tx.delete(schema.tierListTiers).where(eq(schema.tierListTiers.tierListId, payload.id!));
      await insertTiers(tx, payload.id!, tiers);
    });

    revalidatePath(`/tier/${owned.slug}`);
    return { ok: true, slug: owned.slug };
  }

  // ── Create a new list (retry slug on the rare collision) ──
  const remixedFrom = payload.remixedFrom ?? null;
  for (let attempt = 0; attempt < 5; attempt++) {
    const slug = `${slugify(title)}-${shortId()}`;
    try {
      const newId = await db.transaction(async (tx) => {
        const [row] = await tx
          .insert(schema.tierLists)
          .values({ slug, ownerId: user.id, title, remixedFrom })
          .returning({ id: schema.tierLists.id });
        if (!row) throw new Error("insert failed");
        await insertTiers(tx, row.id, tiers);
        return row.id;
      });
      if (newId) return { ok: true, slug };
    } catch (e) {
      if ((e as { code?: string }).code === "23505") continue; // slug taken — retry
      throw e;
    }
  }
  return { ok: false, error: "Couldn't generate a unique link. Try again." };
}

// Insert tier rows then their items, preserving order via `position`.
async function insertTiers(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  tierListId: number,
  tiers: CleanTier[],
): Promise<void> {
  let position = 0;
  for (const t of tiers) {
    const [row] = await tx
      .insert(schema.tierListTiers)
      .values({ tierListId, label: t.label, color: t.color, position: position++ })
      .returning({ id: schema.tierListTiers.id });
    if (!row || t.items.length === 0) continue;
    await tx.insert(schema.tierListItems).values(
      t.items.map((seriesId, pos) => ({
        tierListId,
        tierId: row.id,
        seriesId,
        position: pos,
      })),
    );
  }
}

export type VoteResult = { ok: boolean; voted: boolean; votes: number; needsAuth?: boolean };

/** Toggle the signed-in user's upvote for a tier list. One vote per user. */
export async function voteTierList(id: number): Promise<VoteResult> {
  const count = async () => {
    const [c] = await db.execute<{ n: number }>(
      sql`select count(*)::int as n from tier_list_votes where tier_list_id = ${id}`,
    );
    return Number(c?.n ?? 0);
  };

  const user = await getUser();
  if (!user || !(await getProfile(user.id))) {
    return { ok: false, voted: false, votes: await count(), needsAuth: true };
  }

  const [existing] = await db
    .select({ id: schema.tierListVotes.userId })
    .from(schema.tierListVotes)
    .where(and(eq(schema.tierListVotes.tierListId, id), eq(schema.tierListVotes.userId, user.id)))
    .limit(1);

  if (existing) {
    await db
      .delete(schema.tierListVotes)
      .where(
        and(eq(schema.tierListVotes.tierListId, id), eq(schema.tierListVotes.userId, user.id)),
      );
  } else {
    await db
      .insert(schema.tierListVotes)
      .values({ tierListId: id, userId: user.id })
      .onConflictDoNothing();
  }

  revalidatePath("/tier");
  return { ok: true, voted: !existing, votes: await count() };
}

/** Delete an owned tier list and return home. */
export async function deleteTierList(id: number): Promise<void> {
  const { user } = await requireProfile();
  await db
    .delete(schema.tierLists)
    .where(and(eq(schema.tierLists.id, id), eq(schema.tierLists.ownerId, user.id)));
  redirect("/");
}
