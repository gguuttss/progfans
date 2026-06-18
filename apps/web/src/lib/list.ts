// Shared list-status vocabulary (mirrors the `list_status` DB enum). Kept out of
// the "use server" actions file so client components can import it too.
export const LIST_STATUSES = ["plan", "reading", "paused", "read", "dropped"] as const;
export type ListStatusValue = (typeof LIST_STATUSES)[number];

export const LIST_STATUS_LABEL: Record<ListStatusValue, string> = {
  plan: "Plan to read",
  reading: "Reading",
  paused: "On hold",
  read: "Completed",
  dropped: "Dropped",
};

// Solid button colors for the "on my list" state.
export const LIST_STATUS_STYLE: Record<ListStatusValue, string> = {
  plan: "bg-stone-500 text-white",
  reading: "bg-blue-600 text-white",
  paused: "bg-amber-500 text-white",
  read: "bg-emerald-600 text-white",
  dropped: "bg-rose-600 text-white",
};

// "Plan to read" means you haven't read it yet, so no score.
export const SCORELESS_STATUSES: ListStatusValue[] = ["plan"];
