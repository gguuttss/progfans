"use client";

import Link from "next/link";
import { useActionState } from "react";
import { GoogleButton } from "@/components/GoogleButton";
import { type AuthState, signIn } from "./actions";

const EMPTY: AuthState = {};

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(signIn, EMPTY);

  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4 py-12">
      <Link
        href="/"
        className="mb-8 self-center font-display text-2xl font-extrabold tracking-tight text-ink"
      >
        prog<span className="text-gold">fans</span>
      </Link>

      <div className="rounded-xl border border-line bg-card p-6">
        <h1 className="mb-5 font-display text-xl font-bold">Log in</h1>

        <GoogleButton />

        <div className="my-4 flex items-center gap-3 text-xs text-muted">
          <span className="h-px flex-1 bg-line" />
          or
          <span className="h-px flex-1 bg-line" />
        </div>

        <form action={formAction} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted">Email</span>
            <input
              type="email"
              name="email"
              required
              autoComplete="email"
              className="rounded-md border border-line bg-paper px-3 py-2 text-ink outline-none focus:border-gold"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted">Password</span>
            <input
              type="password"
              name="password"
              required
              autoComplete="current-password"
              className="rounded-md border border-line bg-paper px-3 py-2 text-ink outline-none focus:border-gold"
            />
          </label>

          {state.error && <p className="text-sm text-rose-600">{state.error}</p>}

          <button
            type="submit"
            disabled={pending}
            className="mt-1 rounded-md bg-ink px-3 py-2 text-sm font-medium text-paper transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {pending ? "…" : "Log in"}
          </button>
        </form>
      </div>

      <p className="mt-6 text-center text-sm text-muted">
        Don&apos;t have an account?{" "}
        <Link href="/signup" className="font-medium text-gold underline-offset-2 hover:underline">
          Sign up
        </Link>
      </p>
    </div>
  );
}
