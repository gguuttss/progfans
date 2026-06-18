"use client";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export function GoogleButton({ label = "Continue with Google" }: { label?: string }) {
  const signInWithGoogle = async () => {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      // The callback creates the session, then routes new users to pick a username.
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  };

  return (
    <button
      type="button"
      onClick={signInWithGoogle}
      className="flex w-full items-center justify-center gap-2 rounded-md border border-line bg-paper px-3 py-2 text-sm font-medium text-ink transition-colors hover:border-gold"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
        <path
          fill="#4285F4"
          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z"
        />
        <path
          fill="#34A853"
          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.26 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"
        />
        <path
          fill="#FBBC05"
          d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z"
        />
        <path
          fill="#EA4335"
          d="M12 4.75c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 1.4 14.97.4 12 .4A11 11 0 0 0 2.18 6.94L5.84 9.9C6.71 7.3 9.14 5.37 12 5.37z"
        />
      </svg>
      {label}
    </button>
  );
}
