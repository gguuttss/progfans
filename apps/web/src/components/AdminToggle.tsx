"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { setUserAdmin } from "@/app/actions/moderation";

/** Owner-only control: grant or revoke a user's admin rights. */
export function AdminToggle({ userId, isAdmin }: { userId: string; isAdmin: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  const toggle = () =>
    start(async () => {
      await setUserAdmin(userId, !isAdmin);
      router.refresh();
    });

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      className={
        isAdmin
          ? "rounded-md border border-rose-300 px-3 py-1.5 text-sm font-medium text-rose-600 transition-colors hover:bg-rose-50 disabled:opacity-50"
          : "rounded-md bg-ink px-3 py-1.5 text-sm font-medium text-paper transition-opacity hover:opacity-90 disabled:opacity-50"
      }
    >
      {pending ? "…" : isAdmin ? "Remove admin" : "Make admin"}
    </button>
  );
}
