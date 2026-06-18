import { LIST_STATUS_LABEL, type ListStatusValue } from "@/lib/list";
import type { ListStats } from "@/lib/queries";

const BAR_COLOR: Record<ListStatusValue, string> = {
  reading: "bg-blue-500",
  read: "bg-emerald-500",
  paused: "bg-amber-500",
  dropped: "bg-rose-500",
  plan: "bg-stone-400",
};
const ORDER: ListStatusValue[] = ["reading", "read", "paused", "dropped", "plan"];

export function StatsBar({ stats }: { stats: ListStats }) {
  const total = stats.total || 1;

  return (
    <div>
      <div className="flex h-3 overflow-hidden rounded-full bg-line">
        {ORDER.filter((s) => stats[s] > 0).map((s) => (
          <div
            key={s}
            className={BAR_COLOR[s]}
            style={{ width: `${(stats[s] / total) * 100}%` }}
            title={`${LIST_STATUS_LABEL[s]}: ${stats[s]}`}
          />
        ))}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1.5 sm:grid-cols-3">
        {ORDER.map((s) => (
          <div key={s} className="flex items-center justify-between gap-2 text-sm">
            <span className="flex items-center gap-1.5 text-muted">
              <span className={`h-2.5 w-2.5 rounded-sm ${BAR_COLOR[s]}`} />
              {LIST_STATUS_LABEL[s]}
            </span>
            <span className="tnum font-mono font-semibold text-ink">{stats[s]}</span>
          </div>
        ))}
        <div className="flex items-center justify-between gap-2 border-t border-line pt-1.5 text-sm sm:border-0 sm:pt-0">
          <span className="text-muted">Total</span>
          <span className="tnum font-mono font-semibold text-ink">{stats.total}</span>
        </div>
      </div>
    </div>
  );
}
