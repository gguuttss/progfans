"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { STATUS_LABEL, TROPE_CATEGORY_LABEL } from "@/lib/format";
import type { TropeOption } from "@/lib/queries";

const STATUSES = ["ongoing", "completed", "hiatus", "stub", "dropped"];
const CATEGORY_ORDER = [
  "power_system",
  "setting",
  "progression",
  "protagonist",
  "tone",
  "relationships",
  "content_warning",
];

type Props = {
  tropeOptions: TropeOption[];
  tropes: string[]; // included
  excludeTropes: string[];
  statuses: string[];
};

export function BrowseFilters({ tropeOptions, tropes, excludeTropes, statuses }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);

  // Which trope categories are expanded — user-controlled, and seeded open for
  // any category that already has a selection. Persists across filter changes,
  // so toggling a filter no longer collapses the section.
  const [openCats, setOpenCats] = useState<Set<string>>(() => {
    const s = new Set<string>();
    for (const t of tropeOptions) {
      if (tropes.includes(t.slug) || excludeTropes.includes(t.slug)) s.add(t.category);
    }
    return s;
  });
  const toggleCat = (category: string, isOpen: boolean) =>
    setOpenCats((prev) => {
      if (isOpen === prev.has(category)) return prev;
      const n = new Set(prev);
      if (isOpen) n.add(category);
      else n.delete(category);
      return n;
    });

  // Any control change re-runs the query immediately (no Apply button).
  const apply = (form: HTMLFormElement) => {
    const fd = new FormData(form);
    const params = new URLSearchParams();
    const q = searchParams.get("q");
    if (q) params.set("q", q);
    for (const v of fd.getAll("statuses")) params.append("statuses", String(v));
    for (const v of fd.getAll("tropes")) params.append("tropes", String(v));
    // Content-warning tri-state: cw_<slug> = "" | include | exclude
    for (const [k, v] of fd.entries()) {
      if (!k.startsWith("cw_")) continue;
      const slug = k.slice(3);
      if (v === "include") params.append("tropes", slug);
      else if (v === "exclude") params.append("xtropes", slug);
    }
    router.push(params.toString() ? `/browse?${params}` : "/browse", { scroll: false });
  };

  const byCategory = new Map<string, TropeOption[]>();
  for (const t of tropeOptions) {
    const list = byCategory.get(t.category) ?? [];
    list.push(t);
    byCategory.set(t.category, list);
  }

  const active = statuses.length + tropes.length + excludeTropes.length;
  const legend = "mb-1.5 font-mono text-xs tracking-wider text-muted uppercase";
  const summary =
    "cursor-pointer font-mono text-xs tracking-wider text-muted uppercase select-none";

  const panel = (
    <form onChange={(e) => apply(e.currentTarget)} className="space-y-5 text-sm">
      <div className="flex items-center justify-between md:hidden">
        <span className="font-display text-lg font-bold">Filters</span>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Close filters"
          className="text-lg text-muted hover:text-ink"
        >
          ✕
        </button>
      </div>

      <fieldset>
        <legend className={legend}>Status</legend>
        <div className="space-y-1">
          {STATUSES.map((s) => (
            <label key={s} className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                name="statuses"
                value={s}
                defaultChecked={statuses.includes(s)}
                className="accent-gold"
              />
              {STATUS_LABEL[s]}
            </label>
          ))}
        </div>
      </fieldset>

      {CATEGORY_ORDER.filter((c) => byCategory.has(c)).map((category) => {
        const list = byCategory.get(category)!;

        if (category === "content_warning") {
          return (
            <details
              key={category}
              open={openCats.has(category)}
              onToggle={(e) => toggleCat(category, e.currentTarget.open)}
              className="border-t border-line pt-3"
            >
              <summary className={summary}>{TROPE_CATEGORY_LABEL[category]}</summary>
              <div className="mt-2 space-y-1.5">
                {list.map((t) => {
                  const val = tropes.includes(t.slug)
                    ? "include"
                    : excludeTropes.includes(t.slug)
                      ? "exclude"
                      : "";
                  return (
                    <div key={t.slug} className="flex items-center justify-between gap-2">
                      <span>{t.name}</span>
                      <select
                        name={`cw_${t.slug}`}
                        defaultValue={val}
                        className="rounded border border-line bg-card px-1.5 py-1 text-xs text-ink outline-none focus:border-gold"
                      >
                        <option value="">Any</option>
                        <option value="include">Only</option>
                        <option value="exclude">Exclude</option>
                      </select>
                    </div>
                  );
                })}
              </div>
            </details>
          );
        }

        return (
          <details
            key={category}
            open={openCats.has(category)}
            onToggle={(e) => toggleCat(category, e.currentTarget.open)}
            className="border-t border-line pt-3"
          >
            <summary className={summary}>{TROPE_CATEGORY_LABEL[category] ?? category}</summary>
            <div className="mt-2 space-y-1">
              {list.map((t) => (
                <label key={t.slug} className="flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    name="tropes"
                    value={t.slug}
                    defaultChecked={tropes.includes(t.slug)}
                    className="accent-gold"
                  />
                  {t.name}
                </label>
              ))}
            </div>
          </details>
        );
      })}

      {/* Full nav so Clear resets the uncontrolled inputs. */}
      <a
        href="/browse"
        className="block border-t border-line pt-4 text-muted transition-colors hover:text-ink"
      >
        Clear all filters
      </a>
    </form>
  );

  return (
    <>
      {/* Mobile: open the filter drawer */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mb-4 flex items-center gap-2 rounded-md border border-line bg-card px-3 py-2 text-sm font-medium text-ink md:hidden"
      >
        Filters
        {active > 0 && (
          <span className="rounded-full bg-gold px-1.5 text-xs font-bold text-paper">{active}</span>
        )}
      </button>

      {/* Backdrop (mobile only, when open) */}
      <button
        type="button"
        aria-hidden
        tabIndex={-1}
        onClick={() => setOpen(false)}
        className={`fixed inset-0 z-40 bg-ink/40 md:hidden ${open ? "" : "hidden"}`}
      />

      {/* Panel: slide-in drawer on mobile, sticky sidebar on desktop */}
      <div
        className={`fixed inset-y-0 left-0 z-50 w-80 max-w-[85%] overflow-y-auto bg-card p-4 shadow-xl transition-transform ${
          open ? "translate-x-0" : "-translate-x-full"
        } md:sticky md:inset-auto md:top-6 md:z-auto md:h-max md:w-auto md:max-w-none md:translate-x-0 md:overflow-visible md:bg-transparent md:p-0 md:shadow-none`}
      >
        {panel}
      </div>
    </>
  );
}
