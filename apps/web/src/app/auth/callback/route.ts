import { NextResponse } from "next/server";
import { postVerifyDestination } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// OAuth (Google) redirect target. Supabase sends the user here with a `code` we
// exchange for a session. This is the PKCE flow — correct for OAuth, which is
// always same-device. Email confirmation uses /auth/confirm (token-hash) instead
// so it works cross-device.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (code) {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error && data.user) {
      const dest = await postVerifyDestination(data.user, next);
      return NextResponse.redirect(`${origin}${dest}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=oauth`);
}
