"use client";

import { useActionState } from "react";
import { chooseUsername, type WelcomeState } from "./actions";

const EMPTY: WelcomeState = {};

export function WelcomeForm({ defaultUsername }: { defaultUsername: string }) {
  const [state, formAction, pending] = useActionState(chooseUsername, EMPTY);

  return (
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
          defaultValue={defaultUsername}
          placeholder="e.g. dungeon_diver"
          className="rounded-md border border-line bg-paper px-3 py-2 text-ink outline-none focus:border-gold"
        />
        <span className="text-xs text-muted">
          3–20 chars · letters, numbers, underscore · must be unique
        </span>
      </label>

      {state.error && <p className="text-sm text-rose-600">{state.error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="mt-1 rounded-md bg-ink px-3 py-2 text-sm font-medium text-paper transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {pending ? "…" : "Continue"}
      </button>
    </form>
  );
}
