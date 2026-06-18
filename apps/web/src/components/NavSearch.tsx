"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type SyntheticEvent, useEffect, useRef, useState } from "react";
import type { SearchSuggestion } from "@/lib/queries";

const SearchIcon = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
    <path d="m20 20-3.2-3.2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

export function NavSearch() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<SearchSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false); // mobile: icon → full-width input
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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
        // best-effort typeahead
      }
    }, 160);
    return () => clearTimeout(id);
  }, [q]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setExpanded(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  useEffect(() => {
    if (expanded) inputRef.current?.focus();
  }, [expanded]);

  const submit = (e: SyntheticEvent) => {
    e.preventDefault();
    const term = q.trim();
    if (!term) return;
    setOpen(false);
    setExpanded(false);
    router.push(`/search?q=${encodeURIComponent(term)}`);
  };

  const showPanel = open && q.trim().length > 0;

  return (
    <>
      <div
        ref={ref}
        className={`${
          expanded ? "fixed inset-x-0 top-0 z-50 border-b border-line bg-paper p-3" : "hidden"
        } sm:relative sm:inset-auto sm:z-auto sm:block sm:min-w-0 sm:flex-1 sm:border-0 sm:bg-transparent sm:p-0 sm:max-w-xs`}
      >
        <form onSubmit={submit} className="relative flex items-center gap-2">
          <input
            ref={inputRef}
            type="search"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            placeholder="Search series, books, authors…"
            aria-label="Search series, books, and authors"
            className="w-full rounded-md border border-line bg-card px-3 py-1.5 text-sm outline-none focus:border-gold"
          />
          {expanded && (
            <button
              type="button"
              onClick={() => {
                setExpanded(false);
                setOpen(false);
              }}
              className="shrink-0 text-sm text-muted sm:hidden"
            >
              Cancel
            </button>
          )}

          {showPanel && results.length === 0 && (
            <div className="absolute inset-x-0 top-full z-50 mt-1 overflow-hidden rounded-md border border-line bg-card px-3 py-3 text-sm shadow-lg">
              <p className="text-muted">No matches for “{q.trim()}”.</p>
              <Link
                href={`/request?q=${encodeURIComponent(q.trim())}`}
                onClick={() => {
                  setOpen(false);
                  setExpanded(false);
                }}
                className="mt-1 inline-block font-medium text-gold hover:underline"
              >
                Can’t find your book? Request it →
              </Link>
            </div>
          )}
          {showPanel && results.length > 0 && (
            <div className="absolute inset-x-0 top-full z-50 mt-1 overflow-hidden rounded-md border border-line bg-card shadow-lg">
              {results.map((r) => (
                <Link
                  key={r.slug}
                  href={`/series/${r.slug}`}
                  onClick={() => {
                    setOpen(false);
                    setExpanded(false);
                  }}
                  className="flex items-center gap-2.5 px-3 py-2 transition-colors hover:bg-line/60"
                >
                  <div className="relative h-10 w-7 shrink-0 overflow-hidden rounded bg-line">
                    {r.coverUrl && (
                      <Image
                        src={r.coverUrl}
                        alt=""
                        fill
                        sizes="28px"
                        className="object-cover"
                        unoptimized
                      />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-ink">{r.title}</div>
                    <div className="truncate text-xs text-muted">
                      {r.authors || "Unknown author"}
                      {r.matchedBook && <span className="text-gold"> · {r.matchedBook}</span>}
                    </div>
                  </div>
                </Link>
              ))}
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={submit}
                className="block w-full border-t border-line px-3 py-2 text-left text-xs font-medium text-gold hover:bg-line/60"
              >
                See all results for “{q.trim()}” →
              </button>
            </div>
          )}
        </form>
      </div>

      {/* Mobile: search icon that expands the bar */}
      <button
        type="button"
        onClick={() => {
          setExpanded(true);
          setOpen(true);
        }}
        aria-label="Search"
        className={`${expanded ? "hidden" : "flex"} h-8 w-8 items-center justify-center rounded-md text-muted hover:text-ink sm:hidden`}
      >
        {SearchIcon}
      </button>
    </>
  );
}
