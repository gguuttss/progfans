"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createProfile, normalizeUsername, usernameAvailable } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type SignupState = { error?: string; sent?: boolean; email?: string };

export async function signUp(_prev: SignupState, formData: FormData): Promise<SignupState> {
  if (!isSupabaseConfigured) return { error: "Auth isn't configured yet." };

  const { value: username, error: uErr } = normalizeUsername(
    String(formData.get("username") ?? ""),
  );
  if (uErr) return { error: uErr };
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { error: "Email and password are required." };
  if (password.length < 8) return { error: "Password must be at least 8 characters." };
  if (!(await usernameAvailable(username!))) return { error: "That username is taken." };

  // Build the site origin so the confirmation link comes back to /auth/callback,
  // which creates the session and routes new users to /welcome to pick a username.
  const h = await headers();
  const host = h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const origin = `${proto}://${host}`;

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      // Stash the username so it survives email confirmation (used on /welcome).
      data: { username },
      emailRedirectTo: `${origin}/auth/callback`,
    },
  });
  if (error) {
    // A 5xx here usually means the confirmation email failed to send (SMTP/config).
    const status = (error as { status?: number }).status ?? 0;
    if (status >= 500) {
      return { error: "Couldn't send the confirmation email. Please try again shortly." };
    }
    return { error: error.message };
  }

  if (data.session && data.user) {
    // No email confirmation required — create the profile immediately.
    const { error: pErr } = await createProfile(data.user.id, username!);
    if (pErr) redirect("/welcome"); // lost a race for the username; choose again
    revalidatePath("/", "layout");
    redirect("/");
  }

  // Confirmation required — the page swaps to a "check your email" view.
  return { sent: true, email };
}
