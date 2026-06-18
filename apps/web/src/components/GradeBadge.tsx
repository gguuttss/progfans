import type { Grade } from "@progfans/db/rating";

// Loot-rarity spectrum mapped onto letter tiers; S+ gets a rainbow gradient and
// "?" = not enough ratings yet.
const STYLES: Record<Grade, string> = {
  "S+": "border-transparent bg-[linear-gradient(135deg,#f43f5e,#f59e0b,#22c55e,#3b82f6,#a855f7)] text-white",
  S: "text-legendary border-legendary/40 bg-legendary/10",
  A: "text-epic border-epic/40 bg-epic/10",
  B: "text-rare border-rare/40 bg-rare/10",
  C: "text-uncommon border-uncommon/40 bg-uncommon/10",
  D: "text-common border-common/40 bg-common/10",
  F: "text-rose-600 border-rose-600/40 bg-rose-600/10",
  "?": "text-muted border-line bg-line/50",
};

export function GradeBadge({
  grade,
  score,
  className = "",
}: {
  grade: Grade;
  score: number;
  className?: string;
}) {
  return (
    <span
      title="ProgFans tier score"
      className={`inline-flex min-w-[2.75rem] flex-col items-center justify-center rounded-lg border px-2 py-1 font-mono leading-none ${STYLES[grade]} ${className}`}
    >
      <span className="text-lg font-extrabold">{grade}</span>
      {grade !== "?" && (
        <span className="mt-0.5 text-[10px] font-medium opacity-80">{score}/100</span>
      )}
    </span>
  );
}
