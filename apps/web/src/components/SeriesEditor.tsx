"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { submitSeriesEdit } from "@/app/actions/moderation";
import { TROPE_CATEGORY_LABEL } from "@/lib/format";
import type { TropeOption } from "@/lib/queries";
import {
  BOOK_LINK_SOURCES,
  type BookEdit,
  type LinkSource,
  LINK_SOURCES,
  MC_GENDER_OPTIONS,
  POV_OPTIONS,
  ROMANCE_OPTIONS,
  SERIES_STATUSES,
  type SeriesEditPayload,
  STATUS_LABELS,
} from "@/lib/series-edit";

const LINK_LABELS: Record<LinkSource, string> = {
  goodreads: "Goodreads",
  royalroad: "Royal Road",
  amazon: "Amazon",
  audible: "Audible",
};
const CATEGORY_ORDER = [
  "power_system",
  "setting",
  "progression",
  "protagonist",
  "tone",
  "relationships",
  "content_warning",
];
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const field =
  "w-full rounded-md border border-line bg-card px-3 py-2 text-sm outline-none focus:border-gold";
const label = "mb-1 block font-mono text-xs tracking-wider text-muted uppercase";

function Select({
  value,
  onChange,
  options,
}: {
  value: string | null;
  onChange: (v: string | null) => void;
  options: string[];
}) {
  return (
    <select
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value || null)}
      className={field}
    >
      <option value="">—</option>
      {options.map((o) => (
        <option key={o} value={o}>
          {cap(o)}
        </option>
      ))}
    </select>
  );
}

export function SeriesEditor({
  seriesId,
  slug,
  initial,
  tropeOptions,
  isAdmin,
}: {
  seriesId: number;
  slug: string;
  initial: SeriesEditPayload;
  tropeOptions: TropeOption[];
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [form, setForm] = useState<SeriesEditPayload>(initial);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [pending, start] = useTransition();

  const set = (patch: Partial<SeriesEditPayload>) => setForm((f) => ({ ...f, ...patch }));
  const tropeSet = useMemo(() => new Set(form.tropes), [form.tropes]);
  const toggleTrope = (s: string) =>
    set({ tropes: tropeSet.has(s) ? form.tropes.filter((t) => t !== s) : [...form.tropes, s] });

  const [openBooks, setOpenBooks] = useState<Set<number>>(new Set());
  const toggleBook = (id: number) =>
    setOpenBooks((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const updateBook = (id: number, patch: Partial<BookEdit>) =>
    set({ books: form.books.map((b) => (b.id === id ? { ...b, ...patch } : b)) });

  const byCategory = useMemo(() => {
    const m = new Map<string, TropeOption[]>();
    for (const t of tropeOptions) {
      const list = m.get(t.category) ?? [];
      list.push(t);
      m.set(t.category, list);
    }
    return m;
  }, [tropeOptions]);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) return setError("Title is required.");
    setError(null);
    start(async () => {
      const res = await submitSeriesEdit(seriesId, form, note);
      if (res.applied) router.push(`/series/${slug}`);
      else setSubmitted(true);
    });
  };

  if (submitted) {
    return (
      <div className="rounded-lg border border-gold/40 bg-gold/10 p-6">
        <p className="font-display text-lg font-bold">Thanks — your changes were submitted 🙌</p>
        <p className="mt-1 text-sm text-muted">
          An admin will review them before they go live. You can keep browsing in the meantime.
        </p>
        <Link
          href={`/series/${slug}`}
          className="mt-4 inline-block rounded-md bg-gold px-4 py-2 text-sm font-medium text-paper transition-opacity hover:opacity-90"
        >
          Back to the series
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      {!isAdmin && (
        <p className="rounded-md border border-line bg-card px-3 py-2 text-sm text-muted">
          Your edits are saved as a suggestion and reviewed by an admin before going live.
        </p>
      )}

      <div>
        <label className={label} htmlFor="title">
          Title
        </label>
        <input
          id="title"
          value={form.title}
          onChange={(e) => set({ title: e.target.value })}
          className={`${field} font-display text-base font-bold`}
        />
      </div>

      <div>
        <span className={label}>Synopsis</span>
        <textarea
          value={form.description ?? ""}
          onChange={(e) => set({ description: e.target.value })}
          rows={6}
          className={`${field} leading-relaxed`}
        />
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div>
          <span className={label}>Status</span>
          <select
            value={form.status}
            onChange={(e) => set({ status: e.target.value })}
            className={field}
          >
            {SERIES_STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s] ?? s}
              </option>
            ))}
          </select>
        </div>
        <div>
          <span className={label}>POV</span>
          <Select value={form.pov} onChange={(v) => set({ pov: v })} options={POV_OPTIONS} />
        </div>
        <div>
          <span className={label}>MC gender</span>
          <Select
            value={form.mcGender}
            onChange={(v) => set({ mcGender: v })}
            options={MC_GENDER_OPTIONS}
          />
        </div>
        <div>
          <span className={label}>Romance</span>
          <Select
            value={form.romance}
            onChange={(v) => set({ romance: v })}
            options={ROMANCE_OPTIONS}
          />
        </div>
      </div>

      <div>
        <span className={label}>Formats</span>
        <div className="flex flex-wrap gap-3">
          {(
            [
              ["web", "Web serial"],
              ["ebook", "eBook"],
              ["ku", "Kindle Unlimited"],
              ["audio", "Audiobook"],
            ] as const
          ).map(([key, lbl]) => (
            <label key={key} className="flex items-center gap-1.5 text-sm">
              <input
                type="checkbox"
                checked={form.formats[key]}
                onChange={(e) => set({ formats: { ...form.formats, [key]: e.target.checked } })}
              />
              {lbl}
            </label>
          ))}
        </div>
      </div>

      <div>
        <span className={label}>Where to read</span>
        <div className="grid gap-3 sm:grid-cols-2">
          {LINK_SOURCES.map((src) => (
            <label key={src} className="block">
              <span className="mb-1 block text-xs text-muted">{LINK_LABELS[src]}</span>
              <input
                value={form.links[src]}
                onChange={(e) => set({ links: { ...form.links, [src]: e.target.value } })}
                placeholder="https://…"
                className={field}
              />
            </label>
          ))}
        </div>
      </div>

      <div>
        <span className={label}>Tropes</span>
        <div className="space-y-3">
          {CATEGORY_ORDER.filter((c) => byCategory.has(c)).map((category) => (
            <div key={category}>
              <div className="mb-1.5 font-mono text-[10px] tracking-wider text-muted uppercase">
                {TROPE_CATEGORY_LABEL[category] ?? category}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {byCategory.get(category)!.map((t) => (
                  <button
                    key={t.slug}
                    type="button"
                    onClick={() => toggleTrope(t.slug)}
                    className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
                      tropeSet.has(t.slug)
                        ? "border-gold bg-gold/15 text-ink"
                        : "border-line text-muted hover:border-gold"
                    }`}
                  >
                    {t.name}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {form.books.length > 0 && (
        <div>
          <span className={label}>Books · {form.books.length}</span>
          <p className="mb-2 text-xs text-muted">Select a book to edit its details.</p>
          <div className="space-y-1.5">
            {form.books.map((b) => {
              const open = openBooks.has(b.id);
              return (
                <div key={b.id} className="overflow-hidden rounded-md border border-line">
                  <button
                    type="button"
                    onClick={() => toggleBook(b.id)}
                    className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-line/40"
                  >
                    <span className="min-w-0 truncate">
                      {b.position != null && <span className="text-muted">#{b.position} </span>}
                      <span className="font-medium text-ink">{b.title || "Untitled"}</span>
                    </span>
                    <span className="shrink-0 font-mono text-xs text-muted">
                      {open ? "Close" : "Edit"}
                    </span>
                  </button>
                  {open && (
                    <div className="space-y-3 border-t border-line p-3">
                      <div>
                        <span className="mb-1 block text-xs text-muted">Title</span>
                        <input
                          value={b.title}
                          onChange={(e) => updateBook(b.id, { title: e.target.value })}
                          className={field}
                        />
                      </div>
                      <div className="w-24">
                        <span className="mb-1 block text-xs text-muted">Book #</span>
                        <input
                          type="number"
                          value={b.position ?? ""}
                          onChange={(e) =>
                            updateBook(b.id, {
                              position: e.target.value === "" ? null : Number(e.target.value),
                            })
                          }
                          className={field}
                        />
                      </div>
                      <div>
                        <span className="mb-1 block text-xs text-muted">Synopsis</span>
                        <textarea
                          value={b.description ?? ""}
                          onChange={(e) =>
                            updateBook(b.id, { description: e.target.value || null })
                          }
                          rows={3}
                          className={field}
                        />
                      </div>
                      <div className="grid gap-2 sm:grid-cols-3">
                        {BOOK_LINK_SOURCES.map((src) => (
                          <label key={src} className="block">
                            <span className="mb-1 block text-xs text-muted">
                              {LINK_LABELS[src]}
                            </span>
                            <input
                              value={b.links[src]}
                              onChange={(e) =>
                                updateBook(b.id, { links: { ...b.links, [src]: e.target.value } })
                              }
                              placeholder="https://…"
                              className={field}
                            />
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {!isAdmin && (
        <div>
          <label className={label} htmlFor="note">
            Note for the reviewer (optional)
          </label>
          <textarea
            id="note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder="What did you change and why?"
            className={field}
          />
        </div>
      )}

      {error && <p className="text-sm text-rose-600">{error}</p>}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-gold px-5 py-2 font-medium text-paper transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {pending ? "Saving…" : isAdmin ? "Save changes" : "Submit for review"}
        </button>
        <Link href={`/series/${slug}`} className="text-sm text-muted hover:text-ink">
          Cancel
        </Link>
      </div>
    </form>
  );
}
