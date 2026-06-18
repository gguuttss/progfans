import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { postVerifyDestination } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// Email-confirmation target. The link carries a `token_hash` we verify with
// verifyOtp — no code_verifier cookie required, so signing up on one device and
// confirming on another (e.g. desktop → phone) works. The "Confirm signup" email
// template must point here (see the dashboard template using {{ .TokenHash }}).
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") ?? "/";

  if (tokenHash && type) {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error && data.user) {
      const dest = await postVerifyDestination(data.user, next);
      return NextResponse.redirect(`${origin}${dest}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=confirm`);
}
