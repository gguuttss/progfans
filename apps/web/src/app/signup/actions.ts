"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createProfile, normalizeUsername, usernameAvailable } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type SignupState = { error?: string; message?: string };

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

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    // Stash the username so it survives email confirmation (used on /welcome).
    options: { data: { username } },
  });
  if (error) return { error: error.message };

  if (data.session && data.user) {
    // No email confirmation required — create the profile immediately.
    const { error: pErr } = await createProfile(data.user.id, username!);
    if (pErr) redirect("/welcome"); // lost a race for the username; choose again
    revalidatePath("/", "layout");
    redirect("/");
  }

  return { message: "Check your email to confirm your account, then log in." };
}
