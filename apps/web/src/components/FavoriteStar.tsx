"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { addFavorite, removeFavorite } from "@/app/actions/profile";

function Star({ filled }: { filled: boolean }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="2"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m12 3 2.7 5.9 6.3.6-4.7 4.3 1.4 6.2L12 17.8 6.3 20.2l1.4-6.2L3 9.5l6.3-.6z" />
    </svg>
  );
}

export function FavoriteStar({
  seriesId,
  signedIn,
  initialIsFavorite,
}: {
  seriesId: number;
  signedIn: boolean;
  initialIsFavorite: boolean;
}) {
  const router = useRouter();
  const [fav, setFav] = useState(initialIsFavorite);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (!signedIn) {
    return (
      <Link
        href="/login"
        aria-label="Sign in to favourite"
        title="Sign in to favourite"
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-line text-muted transition-colors hover:border-gold hover:text-gold"
      >
        <Star filled={false} />
      </Link>
    );
  }

  const toggle = () =>
    start(async () => {
      setMsg(null);
      if (fav) {
        await removeFavorite(seriesId);
        setFav(false);
        router.refresh();
      } else {
        const res = await addFavorite(seriesId);
        if (res.ok) {
          setFav(true);
          router.refresh();
        } else {
          setMsg(res.error ?? "Couldn't add.");
        }
      }
    });

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={toggle}
        disabled={pending}
        aria-pressed={fav}
        aria-label={fav ? "Remove from favourites" : "Add to favourites"}
        title={fav ? "In your favourites" : "Add to favourites"}
        className={`flex h-9 w-9 items-center justify-center rounded-md border transition-colors ${
          fav
            ? "border-gold bg-gold/10 text-gold"
            : "border-line text-muted hover:border-gold hover:text-gold"
        }`}
      >
        <Star filled={fav} />
      </button>
      {msg && (
        <p className="absolute top-full right-0 z-20 mt-1 w-44 rounded bg-ink px-2 py-1 text-xs text-paper shadow-lg">
          {msg}
        </p>
      )}
    </div>
  );
}
