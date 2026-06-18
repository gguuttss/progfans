"use client";

import Link from "next/link";
import { useActionState } from "react";
import { GoogleButton } from "@/components/GoogleButton";
import { signUp, type SignupState } from "./actions";

const EMPTY: SignupState = {};

export default function SignupPage() {
  const [state, formAction, pending] = useActionState(signUp, EMPTY);

  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4 py-12">
      <Link
        href="/"
        className="mb-8 self-center font-display text-2xl font-extrabold tracking-tight text-ink"
      >
        prog<span className="text-gold">fans</span>
      </Link>

      {state.sent ? (
        <CheckEmail email={state.email} />
      ) : (
        <SignupCard state={state} formAction={formAction} pending={pending} />
      )}

      {!state.sent && (
        <p className="mt-6 text-center text-sm text-muted">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-gold underline-offset-2 hover:underline">
            Log in
          </Link>
        </p>
      )}
    </div>
  );
}

function CheckEmail({ email }: { email?: string }) {
  return (
    <div className="rounded-xl border border-line bg-card p-6 text-center">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-gold/15 text-gold">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="2" />
          <path d="m4 7 8 6 8-6" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
        </svg>
      </div>
      <h1 className="font-display text-xl font-bold">Check your email</h1>
      <p className="mt-2 text-sm text-muted">
        We sent a confirmation link{email ? " to " : ""}
        {email && <span className="font-medium text-ink">{email}</span>}. Click it to activate your
        account and finish setting up your profile.
      </p>
      <p className="mt-4 text-xs text-muted">
        Didn&apos;t get it? Check your spam folder, or{" "}
        <Link href="/signup" className="font-medium text-gold hover:underline">
          try again
        </Link>
        .
      </p>
      <Link
        href="/login"
        className="mt-5 inline-block text-sm font-medium text-gold underline-offset-2 hover:underline"
      >
        Back to log in
      </Link>
    </div>
  );
}

function SignupCard({
  state,
  formAction,
  pending,
}: {
  state: SignupState;
  formAction: (formData: FormData) => void;
  pending: boolean;
}) {
  return (
    <>
      <div className="rounded-xl border border-line bg-card p-6">
        <h1 className="mb-5 font-display text-xl font-bold">Create your account</h1>

        <GoogleButton label="Sign up with Google" />

        <div className="my-4 flex items-center gap-3 text-xs text-muted">
          <span className="h-px flex-1 bg-line" />
          or
          <span className="h-px flex-1 bg-line" />
        </div>

        <form action={formAction} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted">Username</span>
            <input
              type="text"
              name="username"
              required
              minLength={3}
              maxLength={20}
              pattern="[A-Za-z0-9_]+"
              autoComplete="username"
              placeholder="e.g. dungeon_diver"
              className="rounded-md border border-line bg-paper px-3 py-2 text-ink outline-none focus:border-gold"
            />
            <span className="text-xs text-muted">
              3–20 chars · letters, numbers, underscore · must be unique
            </span>
          </label>
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
              minLength={8}
              autoComplete="new-password"
              className="rounded-md border border-line bg-paper px-3 py-2 text-ink outline-none focus:border-gold"
            />
          </label>

          {state.error && <p className="text-sm text-rose-600">{state.error}</p>}

          <button
            type="submit"
            disabled={pending}
            className="mt-1 rounded-md bg-ink px-3 py-2 text-sm font-medium text-paper transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {pending ? "…" : "Create account"}
          </button>
        </form>
      </div>
    </>
  );
}
