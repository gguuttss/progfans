import type { User } from "@supabase/supabase-js";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db, schema } from "./db";
import { isSupabaseConfigured } from "./supabase/config";
import { createSupabaseServerClient } from "./supabase/server";

export type Profile = {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  isAdmin: boolean;
  isOwner: boolean;
};

/** The authenticated user, or null (also null when Supabase isn't configured). */
export async function getUser(): Promise<User | null> {
  if (!isSupabaseConfigured) return null;
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  return data.user;
}

/** Redirect to /login unless signed in; returns the user otherwise. */
export async function requireUser(): Promise<User> {
  const user = await getUser();
  if (!user) redirect("/login");
  return user;
}

const PROFILE_COLS = {
  id: schema.profiles.id,
  username: schema.profiles.username,
  displayName: schema.profiles.displayName,
  avatarUrl: schema.profiles.avatarUrl,
  isAdmin: schema.profiles.isAdmin,
  isOwner: schema.profiles.isOwner,
} as const;

export async function getProfile(userId: string): Promise<Profile | null> {
  const [row] = await db
    .select(PROFILE_COLS)
    .from(schema.profiles)
    .where(eq(schema.profiles.id, userId))
    .limit(1);
  return row ?? null;
}

export async function getProfileByUsername(username: string): Promise<Profile | null> {
  const [row] = await db
    .select(PROFILE_COLS)
    .from(schema.profiles)
    .where(eq(schema.profiles.username, username.toLowerCase()))
    .limit(1);
  return row ?? null;
}

/**
 * Require a signed-in user *with* a chosen username. New OAuth/unfinished
 * signups have no profile yet → send them to pick one.
 */
export async function requireProfile(): Promise<{ user: User; profile: Profile }> {
  const user = await requireUser();
  const profile = await getProfile(user.id);
  if (!profile) redirect("/welcome");
  return { user, profile };
}

/** Require an admin; sends non-admins home. */
export async function requireAdmin(): Promise<{ user: User; profile: Profile }> {
  const ctx = await requireProfile();
  if (!ctx.profile.isAdmin) redirect("/");
  return ctx;
}

/** Require the site owner; sends everyone else home. */
export async function requireOwner(): Promise<{ user: User; profile: Profile }> {
  const ctx = await requireProfile();
  if (!ctx.profile.isOwner) redirect("/");
  return ctx;
}

const USERNAME_RE = /^[a-z0-9_]{3,20}$/;

/** Normalize + validate a username. Lowercase, 3–20 chars, [a-z0-9_]. */
export function normalizeUsername(raw: string): { value?: string; error?: string } {
  const value = raw.trim().toLowerCase();
  if (!value) return { error: "Pick a username." };
  if (!USERNAME_RE.test(value)) {
    return { error: "3–20 characters: lowercase letters, numbers, underscore." };
  }
  return { value };
}

export async function usernameAvailable(username: string): Promise<boolean> {
  const [row] = await db
    .select({ id: schema.profiles.id })
    .from(schema.profiles)
    .where(eq(schema.profiles.username, username))
    .limit(1);
  return !row;
}

/**
 * Create the profile row for a user with their chosen username. Returns an
 * error string if the username is taken (race-safe via the unique constraint).
 */
export async function createProfile(
  userId: string,
  rawUsername: string,
  displayName?: string | null,
): Promise<{ error?: string }> {
  const { value, error } = normalizeUsername(rawUsername);
  if (error) return { error };
  try {
    await db
      .insert(schema.profiles)
      .values({ id: userId, username: value!, displayName: displayName ?? null })
      .onConflictDoNothing({ target: schema.profiles.id }); // already has a profile → no-op
  } catch (e) {
    if ((e as { code?: string }).code === "23505") return { error: "That username is taken." };
    throw e;
  }
  // If the id conflict no-op'd, the user already had a profile — that's fine.
  // If the username collided with someone else's, the unique index threw above.
  return {};
}
