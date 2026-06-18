"use server";

import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getUser } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { uploadToBucket } from "@/lib/storage";

export type ProfileFormState = { error?: string; ok?: boolean };

const revalidateProfile = () => revalidatePath("/user/[username]", "page");

export async function saveProfile(
  _prev: ProfileFormState,
  formData: FormData,
): Promise<ProfileFormState> {
  const user = await getUser();
  if (!user) return { error: "Not signed in." };

  const str = (k: string, max: number) => {
    const v = String(formData.get(k) ?? "").trim();
    return v ? v.slice(0, max) : null;
  };

  // Birthday is built from year (+ optional month/day) so users can share only
  // as much as they want.
  const pad = (n: string) => n.padStart(2, "0");
  const year = String(formData.get("birthdayYear") ?? "").trim();
  const month = String(formData.get("birthdayMonth") ?? "").trim();
  const day = String(formData.get("birthdayDay") ?? "").trim();
  let birthday: string | null = null;
  let birthdayPrecision: string | null = null;
  if (/^\d{4}$/.test(year)) {
    if (/^\d{1,2}$/.test(month)) {
      if (/^\d{1,2}$/.test(day)) {
        birthday = `${year}-${pad(month)}-${pad(day)}`;
        birthdayPrecision = "day";
      } else {
        birthday = `${year}-${pad(month)}-01`;
        birthdayPrecision = "month";
      }
    } else {
      birthday = `${year}-01-01`;
      birthdayPrecision = "year";
    }
  }

  await db
    .update(schema.profiles)
    .set({
      bio: str("bio", 1000),
      location: str("location", 80),
      gender: str("gender", 30),
      birthday,
      birthdayPrecision,
    })
    .where(eq(schema.profiles.id, user.id));

  revalidateProfile();
  return { ok: true };
}

export async function uploadAvatar(formData: FormData): Promise<{ url?: string; error?: string }> {
  const user = await getUser();
  if (!user) return { error: "Not signed in." };

  const file = formData.get("avatar");
  if (!(file instanceof File) || file.size === 0) return { error: "No file selected." };
  if (file.size > 4 * 1024 * 1024) return { error: "Image too large (max 4 MB)." };

  const type = file.type || "image/jpeg";
  const ext = type === "image/png" ? "png" : type === "image/webp" ? "webp" : "jpg";
  const url = await uploadToBucket("avatars", `${user.id}.${ext}`, await file.arrayBuffer(), type);

  await db.update(schema.profiles).set({ avatarUrl: url }).where(eq(schema.profiles.id, user.id));
  revalidateProfile();
  return { url };
}

export async function addFavorite(seriesId: number): Promise<{ ok: boolean; error?: string }> {
  const user = await getUser();
  if (!user) return { ok: false };

  const [row] = await db.execute<Record<string, unknown>>(
    sql`select count(*)::int as n from profile_favorites where user_id = ${user.id}`,
  );
  if (Number(row?.n ?? 0) >= 10) return { ok: false, error: "You can have at most 10 favourites." };

  await db
    .insert(schema.profileFavorites)
    .values({ userId: user.id, seriesId, position: Number(row?.n ?? 0) })
    .onConflictDoNothing();
  revalidateProfile();
  return { ok: true };
}

export async function removeFavorite(seriesId: number): Promise<{ ok: boolean }> {
  const user = await getUser();
  if (!user) return { ok: false };
  await db
    .delete(schema.profileFavorites)
    .where(
      and(
        eq(schema.profileFavorites.userId, user.id),
        eq(schema.profileFavorites.seriesId, seriesId),
      ),
    );
  revalidateProfile();
  return { ok: true };
}
