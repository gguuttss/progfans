import type { ReactNode } from "react";
import {
  BOOK_LINK_SOURCES,
  type LinkSource,
  LINK_SOURCES,
  type SeriesEditPayload,
  STATUS_LABELS,
} from "@/lib/series-edit";

const LINK_LABELS: Record<LinkSource, string> = {
  goodreads: "Goodreads",
  royalroad: "Royal Road",
  amazon: "Amazon",
  audible: "Audible",
};
const clip = (s: string | null, n = 90) => (!s ? "—" : s.length > n ? `${s.slice(0, n)}…` : s);
const cap = (s: string | null) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : "—");

function Row({ label, before, after }: { label: string; before: ReactNode; after: ReactNode }) {
  return (
    <div className="grid grid-cols-[7rem_1fr] gap-3 border-t border-line py-1.5 text-sm first:border-t-0">
      <div className="font-mono text-[10px] tracking-wider text-muted uppercase">{label}</div>
      <div className="min-w-0 break-words">
        <span className="text-rose-600 line-through opacity-80">{before}</span>
        <span className="px-1.5 text-muted">→</span>
        <span className="font-medium text-emerald-600">{after}</span>
      </div>
    </div>
  );
}

export function ChangeDiff({
  current,
  proposed,
}: {
  current: SeriesEditPayload;
  proposed: SeriesEditPayload;
}) {
  const rows: ReactNode[] = [];

  if (current.title !== proposed.title)
    rows.push(<Row key="t" label="Title" before={current.title} after={proposed.title} />);

  if ((current.description ?? "") !== (proposed.description ?? ""))
    rows.push(
      <Row
        key="d"
        label="Synopsis"
        before={clip(current.description)}
        after={clip(proposed.description)}
      />,
    );

  if (current.status !== proposed.status)
    rows.push(
      <Row
        key="s"
        label="Status"
        before={STATUS_LABELS[current.status] ?? current.status}
        after={STATUS_LABELS[proposed.status] ?? proposed.status}
      />,
    );

  for (const [key, lbl] of [
    ["pov", "POV"],
    ["mcGender", "MC gender"],
    ["romance", "Romance"],
  ] as const) {
    if (current[key] !== proposed[key])
      rows.push(
        <Row key={key} label={lbl} before={cap(current[key])} after={cap(proposed[key])} />,
      );
  }

  const fmt = (f: SeriesEditPayload["formats"]) =>
    [f.web && "Web", f.ebook && "eBook", f.ku && "KU", f.audio && "Audio"]
      .filter(Boolean)
      .join(", ") || "—";
  if (fmt(current.formats) !== fmt(proposed.formats))
    rows.push(
      <Row key="f" label="Formats" before={fmt(current.formats)} after={fmt(proposed.formats)} />,
    );

  for (const src of LINK_SOURCES) {
    if ((current.links[src] ?? "") !== (proposed.links[src] ?? ""))
      rows.push(
        <Row
          key={src}
          label={LINK_LABELS[src]}
          before={clip(current.links[src] || null, 50)}
          after={clip(proposed.links[src] || null, 50)}
        />,
      );
  }

  const added = proposed.tropes.filter((t) => !current.tropes.includes(t));
  const removed = current.tropes.filter((t) => !proposed.tropes.includes(t));
  if (added.length || removed.length) {
    rows.push(
      <div key="tr" className="grid grid-cols-[7rem_1fr] gap-3 border-t border-line py-1.5 text-sm">
        <div className="font-mono text-[10px] tracking-wider text-muted uppercase">Tropes</div>
        <div className="flex flex-wrap gap-1">
          {added.map((t) => (
            <span
              key={`a${t}`}
              className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-xs text-emerald-700"
            >
              +{t}
            </span>
          ))}
          {removed.map((t) => (
            <span
              key={`r${t}`}
              className="rounded bg-rose-500/15 px-1.5 py-0.5 text-xs text-rose-700 line-through"
            >
              {t}
            </span>
          ))}
        </div>
      </div>,
    );
  }

  // Per-book changes.
  const curBooks = new Map(current.books.map((b) => [b.id, b]));
  for (const pb of proposed.books) {
    const cb = curBooks.get(pb.id);
    if (!cb) continue;
    const changes: string[] = [];
    if (cb.title !== pb.title) changes.push(`title → “${pb.title}”`);
    if (cb.position !== pb.position)
      changes.push(`# ${cb.position ?? "—"} → ${pb.position ?? "—"}`);
    if ((cb.description ?? "") !== (pb.description ?? "")) changes.push("synopsis edited");
    for (const src of BOOK_LINK_SOURCES)
      if ((cb.links[src] ?? "") !== (pb.links[src] ?? "")) changes.push(`${src} link changed`);
    if (changes.length)
      rows.push(
        <div
          key={`b${pb.id}`}
          className="grid grid-cols-[7rem_1fr] gap-3 border-t border-line py-1.5 text-sm"
        >
          <div className="font-mono text-[10px] tracking-wider text-muted uppercase">Book</div>
          <div className="min-w-0">
            <span className="font-medium text-ink">{cb.title}</span>
            <span className="text-muted"> — {changes.join("; ")}</span>
          </div>
        </div>,
      );
  }

  if (rows.length === 0)
    return <p className="text-sm text-muted">No effective changes (matches the current data).</p>;
  return <div>{rows}</div>;
}
