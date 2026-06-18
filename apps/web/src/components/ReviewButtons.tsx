"use client";

import { useTransition } from "react";
import { reviewChange } from "@/app/actions/moderation";

export function ReviewButtons({ id }: { id: number }) {
  const [pending, start] = useTransition();
  return (
    <div className="flex gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() => start(() => reviewChange(id, "approve"))}
        className="rounded-md bg-emerald-600 px-4 py-1.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        Approve
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => start(() => reviewChange(id, "reject"))}
        className="rounded-md border border-line px-4 py-1.5 text-sm font-medium text-muted transition-colors hover:border-rose-600 hover:text-rose-600 disabled:opacity-60"
      >
        Reject
      </button>
    </div>
  );
}
