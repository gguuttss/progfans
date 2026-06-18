"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { addFavorite, removeFavorite } from "@/app/actions/profile";
import type { FavoriteSeries, SearchSuggestion } from "@/lib/queries";

export function FavoritesEditor({
  favorites,
  isOwner,
}: {
  favorites: FavoriteSeries[];
  isOwner: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [adding, setAdding] = useState(false);

  const remove = (id: number) =>
    start(async () => {
      await removeFavorite(id);
      router.refresh();
    });

  if (favorites.length === 0 && !isOwner) {
    return <p className="text-sm text-muted">No favourites yet.</p>;
  }

  return (
    <div className="grid grid-cols-5 gap-3 sm:grid-cols-10">
      {favorites.map((f) => (
        <div key={f.slug} className="group relative">
          <Link href={`/series/${f.slug}`} className="block">
            <div className="relative aspect-[2/3] overflow-hidden rounded border border-line bg-line">
              {f.coverUrl && (
                <Image
                  src={f.coverUrl}
                  alt=""
                  fill
                  sizes="80px"
                  className="object-cover"
                  unoptimized
                />
              )}
            </div>
            <div className="mt-1 line-clamp-2 text-xs leading-tight text-muted">{f.title}</div>
          </Link>
          {isOwner && (
            <button
              type="button"
              onClick={() => remove(f.id)}
              disabled={pending}
              aria-label="Remove favourite"
              className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-rose-600 text-[10px] text-white opacity-0 transition-opacity group-hover:opacity-100"
            >
              ✕
            </button>
          )}
        </div>
      ))}

      {isOwner &&
        favorites.length < 10 &&
        (adding ? (
          <FavoriteSearch existing={favorites.map((f) => f.id)} onClose={() => setAdding(false)} />
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="flex aspect-[2/3] items-center justify-center rounded border border-dashed border-line text-2xl text-muted transition-colors hover:border-gold hover:text-ink"
            aria-label="Add favourite"
          >
            +
          </button>
        ))}
    </div>
  );
}

function FavoriteSearch({ existing, onClose }: { existing: number[]; onClose: () => void }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<SearchSuggestion[]>([]);
  const [pending, start] = useTransition();
  const ref = useRef<HTMLDivElement>(null);

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
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [onClose]);

  const add = (id: number) =>
    start(async () => {
      await addFavorite(id);
      router.refresh();
      onClose();
    });

  return (
    <div ref={ref} className="relative col-span-3 self-start">
      {/** biome-ignore lint/a11y/noAutofocus: opened on demand by the user */}
      <input
        autoFocus
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Add a series…"
        className="w-full rounded-md border border-line bg-paper px-3 py-1.5 text-sm outline-none focus:border-gold"
      />
      {results.length > 0 && (
        <div className="absolute inset-x-0 top-full z-50 mt-1 max-h-72 overflow-y-auto rounded-md border border-line bg-card shadow-lg">
          {results.map((r) => {
            const already = existing.includes(r.id);
            return (
              <button
                key={r.slug}
                type="button"
                disabled={already || pending}
                onClick={() => add(r.id)}
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
                {already && <span className="text-xs text-muted">added</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
