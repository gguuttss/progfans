"use client";

import { useTransition } from "react";
import { markBookAdded } from "@/app/actions/moderation";

export function MarkAddedButton({ id }: { id: number }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => start(() => markBookAdded(id))}
      className="rounded-md bg-ink px-4 py-1.5 text-sm font-medium text-paper transition-opacity hover:opacity-90 disabled:opacity-60"
    >
      {pending ? "…" : "Mark as added"}
    </button>
  );
}
