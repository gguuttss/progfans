"use client";

import {
  closestCorners,
  type CollisionDetection,
  DndContext,
  type DragEndEvent,
  type DragStartEvent,
  DragOverlay,
  KeyboardSensor,
  MeasuringStrategy,
  pointerWithin,
  PointerSensor,
  TouchSensor,
  type UniqueIdentifier,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  rectSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import Image from "next/image";
import { TierLabelInput } from "@/components/TierLabel";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { saveTierList } from "@/app/actions/tier";
import {
  DEFAULT_TIERS,
  type SaveTierPayload,
  TIER_COLOR_PALETTE,
  TIER_LIMITS,
  type TierListView,
  type TierSeries,
} from "@/lib/tier";

const UNRANKED = "unranked";
const DRAFT_KEY = "progfans:tier-draft:v1";

type Row = { id: string; label: string; color: string };
type State = {
  title: string;
  rows: Row[];
  placement: Record<string, number[]>;
  items: Record<number, TierSeries>;
};

type Props = {
  mode: "new" | "edit";
  signedIn: boolean;
  tracked: TierSeries[];
  seed?: TierListView | null;
  listId?: number;
};

function buildInitial(props: Props): State {
  const items: Record<number, TierSeries> = {};
  for (const s of props.tracked) items[s.id] = s;
  if (props.seed) for (const t of props.seed.tiers) for (const s of t.items) items[s.id] = s;

  const placement: Record<string, number[]> = {};
  const placed = new Set<number>();
  let rows: Row[];

  if (props.seed && props.seed.tiers.length) {
    rows = props.seed.tiers.map((t, i) => ({ id: `row-${i}`, label: t.label, color: t.color }));
    props.seed.tiers.forEach((t, i) => {
      placement[`row-${i}`] = t.items.map((s) => s.id);
      for (const s of t.items) placed.add(s.id);
    });
  } else {
    rows = DEFAULT_TIERS.map((t, i) => ({ id: `row-${i}`, label: t.label, color: t.color }));
    for (const r of rows) placement[r.id] = [];
  }
  placement[UNRANKED] = props.tracked.map((s) => s.id).filter((id) => !placed.has(id));

  return { title: props.seed?.title ?? "", rows, placement, items };
}

// Drop where the cursor is. closestCorners/closestCenter resolve against the
// dragged element's rect, which (with a DragOverlay) stays in the tray and
// doesn't follow the pointer — so everything collapsed onto the middle row.
// pointerWithin uses the actual pointer; fall back to closestCorners for the
// keyboard sensor, which has no pointer.
const collisionDetection: CollisionDetection = (args) => {
  const pointer = pointerWithin(args);
  return pointer.length > 0 ? pointer : closestCorners(args);
};

// Hoisted so its identity is stable across renders — an inline object here makes
// dnd-kit re-run its measuring effect every render and loops under Always.
const MEASURING = { droppable: { strategy: MeasuringStrategy.Always } };

export function TierBuilder(props: Props) {
  const router = useRouter();
  const [state, setState] = useState<State>(() => buildInitial(props));
  const [activeId, setActiveId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, startSave] = useTransition();
  const rowSeq = useRef(state.rows.length);
  const isDraftMode = props.mode === "new" && !props.seed;

  // Restore an in-progress draft for a fresh /tier/new (survives the login
  // round-trip). Done in an effect to avoid an SSR hydration mismatch.
  useEffect(() => {
    if (!isDraftMode) return;
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const d = JSON.parse(raw) as State;
      if (d?.rows?.length && d.placement && d.items) {
        rowSeq.current = d.rows.length;
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setState(d);
      }
    } catch {
      // ignore a corrupt draft
    }
  }, [isDraftMode]);

  // Persist the draft as it changes.
  useEffect(() => {
    if (!isDraftMode) return;
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(state));
    } catch {
      // ignore quota errors
    }
  }, [state, isDraftMode]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 140, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const findContainer = (id: number, p: Record<string, number[]>): string | undefined =>
    Object.keys(p).find((k) => (p[k] ?? []).includes(id));

  function onDragStart(e: DragStartEvent) {
    setActiveId(Number(e.active.id));
  }

  // Commit the move only on drop. Doing it live in onDragOver would unmount and
  // remount the card (and re-request its cover) every time it crossed a tier —
  // the DragOverlay gives the live visual instead, with zero churn until release.
  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    setActiveId(null);
    if (!over) return;
    const activeIdN = Number(active.id);
    const overId = over.id as UniqueIdentifier;

    setState((prev) => {
      const from = findContainer(activeIdN, prev.placement);
      const to =
        typeof overId === "number" ? findContainer(overId, prev.placement) : String(overId);
      if (!from || !to) return prev;

      const sameContainer = from === to;
      const fromArr = [...(prev.placement[from] ?? [])];
      const toArr = sameContainer ? fromArr : [...(prev.placement[to] ?? [])];

      const oldIndex = fromArr.indexOf(activeIdN);
      if (oldIndex === -1) return prev;
      fromArr.splice(oldIndex, 1);

      // Insert before the item we dropped onto, or append when dropped on the
      // container itself / empty space.
      let insertAt = toArr.length;
      if (typeof overId === "number") {
        const overIndex = toArr.indexOf(overId);
        if (overIndex !== -1) insertAt = overIndex;
      }
      toArr.splice(insertAt, 0, activeIdN);

      if (sameContainer && oldIndex === insertAt) return prev; // no-op
      return { ...prev, placement: { ...prev.placement, [from]: fromArr, [to]: toArr } };
    });
  }

  // ── Row + item mutations ──
  const setTitle = (title: string) => setState((s) => ({ ...s, title }));

  const renameRow = (rowId: string, label: string) =>
    setState((s) => ({ ...s, rows: s.rows.map((r) => (r.id === rowId ? { ...r, label } : r)) }));

  const recolorRow = (rowId: string, color: string) =>
    setState((s) => ({ ...s, rows: s.rows.map((r) => (r.id === rowId ? { ...r, color } : r)) }));

  const moveRow = (rowId: string, dir: -1 | 1) =>
    setState((s) => {
      const i = s.rows.findIndex((r) => r.id === rowId);
      const j = i + dir;
      if (i === -1 || j < 0 || j >= s.rows.length) return s;
      return { ...s, rows: arrayMove(s.rows, i, j) };
    });

  const addRow = () =>
    setState((s) => {
      if (s.rows.length >= TIER_LIMITS.maxTiers) return s;
      const id = `row-${rowSeq.current++}`;
      const color = TIER_COLOR_PALETTE[s.rows.length % TIER_COLOR_PALETTE.length] ?? "#8a8893";
      return {
        ...s,
        rows: [...s.rows, { id, label: "New", color }],
        placement: { ...s.placement, [id]: [] },
      };
    });

  const removeRow = (rowId: string) =>
    setState((s) => {
      if (s.rows.length <= 1) return s;
      const moved = s.placement[rowId] ?? [];
      const placement: Record<string, number[]> = {
        ...s.placement,
        [UNRANKED]: [...moved, ...(s.placement[UNRANKED] ?? [])],
      };
      delete placement[rowId];
      return { ...s, rows: s.rows.filter((r) => r.id !== rowId), placement };
    });

  const removeItem = (seriesId: number) =>
    setState((s) => {
      const placement: Record<string, number[]> = {};
      for (const k of Object.keys(s.placement))
        placement[k] = (s.placement[k] ?? []).filter((id) => id !== seriesId);
      const items = { ...s.items };
      delete items[seriesId];
      return { ...s, placement, items };
    });

  const addSeries = (s: TierSeries) =>
    setState((prev) => {
      if (prev.items[s.id]) return prev; // already in the builder
      return {
        ...prev,
        items: { ...prev.items, [s.id]: s },
        placement: { ...prev.placement, [UNRANKED]: [s.id, ...(prev.placement[UNRANKED] ?? [])] },
      };
    });

  function onSave() {
    setError(null);
    const total = Object.entries(state.placement)
      .filter(([k]) => k !== UNRANKED)
      .reduce((n, [, arr]) => n + arr.length, 0);
    if (total === 0) {
      setError("Drag at least one series into a tier before saving.");
      return;
    }

    const payload: SaveTierPayload = {
      id: props.mode === "edit" ? props.listId : undefined,
      title: state.title,
      remixedFrom: props.mode === "new" ? (props.seed?.id ?? null) : undefined,
      tiers: state.rows.map((r) => ({
        label: r.label,
        color: r.color,
        items: state.placement[r.id] ?? [],
      })),
    };

    // Not signed in: stash the draft and send them to log in. The action would
    // redirect anyway; doing it here guarantees the draft is saved first.
    if (!props.signedIn) {
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify(state));
      } catch {
        // ignore
      }
      router.push("/login?next=/tier/new");
      return;
    }

    startSave(async () => {
      const res = await saveTierList(payload);
      if (res.ok && res.slug) {
        if (isDraftMode) {
          try {
            localStorage.removeItem(DRAFT_KEY);
          } catch {
            // ignore
          }
        }
        router.push(`/tier/${res.slug}`);
      } else {
        setError(res.error ?? "Couldn't save. Try again.");
      }
    });
  }

  const activeSeries = activeId != null ? state.items[activeId] : null;

  return (
    <div>
      {/* Title + save bar */}
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <label className="flex-1">
          <span className="mb-1 block font-mono text-xs tracking-wider text-muted uppercase">
            Tier list title
          </span>
          <input
            value={state.title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={TIER_LIMITS.maxTitle}
            placeholder="e.g. Best cultivation progression of all time"
            className="h-11 w-full rounded-md border border-line bg-card px-3 font-display text-lg font-bold outline-none focus:border-gold"
          />
        </label>
        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          className="h-11 shrink-0 rounded-md bg-gold px-6 font-medium text-paper transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {saving ? "Saving…" : props.mode === "edit" ? "Save changes" : "Save & share"}
        </button>
      </div>
      {error && <p className="mb-4 text-sm text-rose-600">{error}</p>}
      {!props.signedIn && (
        <p className="mb-4 text-xs text-muted">
          You can build freely — you’ll be asked to sign in when you save. Your list is kept in this
          browser meanwhile.
        </p>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={collisionDetection}
        measuring={MEASURING}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
      >
        {/* Tier rows */}
        <div className="space-y-2">
          {state.rows.map((row, i) => (
            <TierRow
              key={row.id}
              row={row}
              ids={state.placement[row.id] ?? []}
              items={state.items}
              isFirst={i === 0}
              isLast={i === state.rows.length - 1}
              canDelete={state.rows.length > 1}
              onRename={(v) => renameRow(row.id, v)}
              onRecolor={(c) => recolorRow(row.id, c)}
              onMove={(d) => moveRow(row.id, d)}
              onDelete={() => removeRow(row.id)}
              onRemoveItem={removeItem}
            />
          ))}
        </div>

        <button
          type="button"
          onClick={addRow}
          disabled={state.rows.length >= TIER_LIMITS.maxTiers}
          className="mt-2 w-full rounded-md border border-dashed border-line py-2 text-sm text-muted transition-colors hover:border-gold hover:text-ink disabled:opacity-50"
        >
          + Add tier
        </button>

        {/* Unranked tray */}
        <section className="mt-8 rounded-lg border border-line bg-card/60 p-3">
          <div className="mb-2 flex items-center justify-between gap-3">
            <h2 className="font-mono text-xs tracking-wider text-muted uppercase">
              Unranked {props.signedIn ? "· your shelf" : ""}
            </h2>
            <AddSeries existingIds={Object.keys(state.items).map(Number)} onAdd={addSeries} />
          </div>
          <Tray
            ids={state.placement[UNRANKED] ?? []}
            items={state.items}
            onRemoveItem={removeItem}
            emptyHint={
              props.signedIn
                ? "Nothing here — search above to add series."
                : "Search above to add series, then drag them into tiers."
            }
          />
        </section>

        <DragOverlay>{activeSeries ? <Cover series={activeSeries} dragging /> : null}</DragOverlay>
      </DndContext>
    </div>
  );
}

// ── Tier row ────────────────────────────────────────────────────────────────

function TierRow({
  row,
  ids,
  items,
  isFirst,
  isLast,
  canDelete,
  onRename,
  onRecolor,
  onMove,
  onDelete,
  onRemoveItem,
}: {
  row: Row;
  ids: number[];
  items: Record<number, TierSeries>;
  isFirst: boolean;
  isLast: boolean;
  canDelete: boolean;
  onRename: (v: string) => void;
  onRecolor: (c: string) => void;
  onMove: (dir: -1 | 1) => void;
  onDelete: () => void;
  onRemoveItem: (id: number) => void;
}) {
  const [palette, setPalette] = useState(false);
  const { setNodeRef, isOver } = useDroppable({ id: row.id });

  return (
    <div className="flex items-stretch overflow-hidden rounded-lg border border-line bg-card">
      {/* Label cell */}
      <div
        className="relative flex w-16 shrink-0 flex-col items-center justify-center px-1 py-2 sm:w-20"
        style={{ backgroundColor: row.color }}
      >
        <TierLabelInput value={row.label} onChange={onRename} maxLength={TIER_LIMITS.maxLabel} />
        {palette && (
          <div className="absolute top-full left-0 z-20 mt-1 grid grid-cols-5 gap-1 rounded-md border border-line bg-card p-1.5 shadow-lg">
            {TIER_COLOR_PALETTE.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => {
                  onRecolor(c);
                  setPalette(false);
                }}
                className="h-5 w-5 rounded-full border border-black/10"
                style={{ backgroundColor: c }}
                aria-label={`Use ${c}`}
              />
            ))}
          </div>
        )}
      </div>

      {/* Items track */}
      <div
        ref={setNodeRef}
        className={`relative flex min-h-[5rem] flex-1 flex-wrap content-start gap-1.5 p-2 transition-colors ${
          isOver ? "bg-line/50" : ""
        }`}
      >
        <SortableContext items={ids} strategy={rectSortingStrategy}>
          {ids.map((id) => {
            const s = items[id];
            return s ? (
              <SortableCover key={id} series={s} onRemove={() => onRemoveItem(id)} />
            ) : null;
          })}
        </SortableContext>
        {ids.length === 0 && (
          <span className="absolute inset-0 flex items-center justify-center font-mono text-xs text-muted">
            Drag here
          </span>
        )}
      </div>

      {/* Row controls */}
      <div className="flex shrink-0 flex-col items-center justify-center gap-1 border-l border-line px-1 text-muted">
        <button
          type="button"
          onClick={() => onMove(-1)}
          disabled={isFirst}
          aria-label="Move tier up"
          className="px-1 leading-none transition-colors hover:text-ink disabled:opacity-30"
        >
          ▲
        </button>
        <button
          type="button"
          onClick={() => setPalette((p) => !p)}
          aria-label="Recolor tier"
          className="leading-none transition-colors hover:text-ink"
        >
          <span
            className="block h-3.5 w-3.5 rounded-full border border-black/10"
            style={{ backgroundColor: row.color }}
          />
        </button>
        <button
          type="button"
          onClick={onDelete}
          disabled={!canDelete}
          aria-label="Delete tier"
          className="px-1 text-xs leading-none transition-colors hover:text-rose-600 disabled:opacity-30"
        >
          ✕
        </button>
        <button
          type="button"
          onClick={() => onMove(1)}
          disabled={isLast}
          aria-label="Move tier down"
          className="px-1 leading-none transition-colors hover:text-ink disabled:opacity-30"
        >
          ▼
        </button>
      </div>
    </div>
  );
}

// ── Unranked tray ───────────────────────────────────────────────────────────

function Tray({
  ids,
  items,
  onRemoveItem,
  emptyHint,
}: {
  ids: number[];
  items: Record<number, TierSeries>;
  onRemoveItem: (id: number) => void;
  emptyHint: string;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: UNRANKED });
  return (
    <div
      ref={setNodeRef}
      className={`flex min-h-[6rem] flex-wrap content-start gap-1.5 rounded-md p-1 transition-colors ${
        isOver ? "bg-line/50" : ""
      }`}
    >
      <SortableContext items={ids} strategy={rectSortingStrategy}>
        {ids.map((id) => {
          const s = items[id];
          return s ? <SortableCover key={id} series={s} onRemove={() => onRemoveItem(id)} /> : null;
        })}
      </SortableContext>
      {ids.length === 0 && <p className="px-1 py-6 text-sm text-muted">{emptyHint}</p>}
    </div>
  );
}

// ── Cards ───────────────────────────────────────────────────────────────────

function SortableCover({ series, onRemove }: { series: TierSeries; onRemove: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: series.id,
  });
  const style = { transform: CSS.Transform.toString(transform), transition };
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`group relative w-14 cursor-grab touch-none active:cursor-grabbing sm:w-16 ${
        isDragging ? "opacity-40" : ""
      }`}
    >
      <Cover series={series} />
      <button
        type="button"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={onRemove}
        aria-label={`Remove ${series.title}`}
        className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-rose-600 text-[10px] text-white opacity-0 transition-opacity group-hover:opacity-100"
      >
        ✕
      </button>
    </div>
  );
}

function Cover({ series, dragging }: { series: TierSeries; dragging?: boolean }) {
  return (
    <div
      title={series.title}
      className={`relative aspect-[2/3] w-14 overflow-hidden rounded border border-line bg-line sm:w-16 ${
        dragging ? "rotate-3 shadow-xl ring-2 ring-gold" : ""
      }`}
    >
      {series.coverUrl ? (
        <Image
          src={series.coverUrl}
          alt={series.title}
          fill
          sizes="64px"
          className="object-cover"
          unoptimized
        />
      ) : (
        <span className="flex h-full w-full items-center justify-center p-1 text-center text-[9px] leading-tight text-muted">
          {series.title}
        </span>
      )}
    </div>
  );
}

// ── Search-to-add ───────────────────────────────────────────────────────────

function AddSeries({
  existingIds,
  onAdd,
}: {
  existingIds: number[];
  onAdd: (s: TierSeries) => void;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<TierSeries[]>([]);
  const ref = useRef<HTMLDivElement>(null);
  const have = new Set(existingIds);

  useEffect(() => {
    const term = q.trim();
    if (!term) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setResults([]);
      return;
    }
    const id = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(term)}`);
        if (res.ok) setResults(await res.json());
      } catch {
        // ignore
      }
    }, 160);
    return () => clearTimeout(id);
  }, [q]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onFocus={() => setOpen(true)}
        placeholder="Add a series…"
        className="w-44 rounded-md border border-line bg-paper px-3 py-1.5 text-sm outline-none focus:border-gold sm:w-56"
      />
      {open && results.length > 0 && (
        <div className="absolute right-0 z-30 mt-1 max-h-80 w-64 overflow-y-auto rounded-md border border-line bg-card shadow-lg">
          {results.map((r) => {
            const added = have.has(r.id);
            return (
              <button
                key={r.id}
                type="button"
                disabled={added}
                onClick={() => {
                  onAdd(r);
                  setQ("");
                  setResults([]);
                }}
                className="flex w-full items-center gap-2 px-2 py-1.5 text-left transition-colors hover:bg-line/60 disabled:opacity-50"
              >
                <div className="relative h-9 w-6 shrink-0 overflow-hidden rounded bg-line">
                  {r.coverUrl && (
                    <Image
                      src={r.coverUrl}
                      alt=""
                      fill
                      sizes="24px"
                      className="object-cover"
                      unoptimized
                    />
                  )}
                </div>
                <span className="min-w-0 flex-1 truncate text-sm text-ink">{r.title}</span>
                {added && <span className="text-xs text-muted">added</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
