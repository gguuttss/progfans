import { NextResponse } from "next/server";
import { getProfile } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// OAuth (and magic-link) redirect target. Supabase sends the user here with a
// `code` we exchange for a session cookie. New users (no profile yet) go pick a
// username; returning users continue to `next`.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (code) {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error && data.user) {
      const profile = await getProfile(data.user.id);
      return NextResponse.redirect(`${origin}${profile ? next : "/welcome"}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=oauth`);
}
