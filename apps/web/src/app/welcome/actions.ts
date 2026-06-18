"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createProfile, getProfile, requireUser } from "@/lib/auth";

export type WelcomeState = { error?: string };

export async function chooseUsername(
  _prev: WelcomeState,
  formData: FormData,
): Promise<WelcomeState> {
  const user = await requireUser();
  if (await getProfile(user.id)) redirect("/"); // already done

  const { error } = await createProfile(user.id, String(formData.get("username") ?? ""));
  if (error) return { error };

  revalidatePath("/", "layout");
  redirect("/");
}
