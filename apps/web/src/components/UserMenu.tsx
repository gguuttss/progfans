"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { signOut } from "@/app/login/actions";
import { applyTheme } from "@/lib/theme";

function Avatar({
  username,
  avatarUrl,
  size,
}: {
  username: string;
  avatarUrl: string | null;
  size: number;
}) {
  return (
    <span
      className="relative shrink-0 overflow-hidden rounded-full border border-line bg-line"
      style={{ width: size, height: size }}
    >
      {avatarUrl ? (
        <Image
          src={avatarUrl}
          alt=""
          fill
          sizes={`${size}px`}
          className="object-cover"
          unoptimized
        />
      ) : (
        <span className="flex h-full w-full items-center justify-center font-display text-xs font-bold text-muted">
          {username.charAt(0).toUpperCase()}
        </span>
      )}
    </span>
  );
}

export function UserMenu({
  username,
  avatarUrl,
  initialDark,
  isAdmin,
  pendingCount,
}: {
  username: string;
  avatarUrl: string | null;
  initialDark: boolean;
  isAdmin: boolean;
  pendingCount: number;
}) {
  const [open, setOpen] = useState(false);
  const [dark, setDark] = useState(initialDark);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const item = "block w-full px-3 py-2 text-left text-ink transition-colors hover:bg-line/60";

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-2 rounded-md border border-line py-1 pr-2 pl-1 text-sm font-medium text-ink transition-colors hover:border-gold"
      >
        <Avatar username={username} avatarUrl={avatarUrl} size={26} />
        <span className="hidden sm:inline">@{username}</span>
        <span aria-hidden="true" className="text-xs text-muted">
          ▾
        </span>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 w-44 overflow-hidden rounded-lg border border-line bg-card py-1 text-sm shadow-lg"
        >
          <div className="flex items-center gap-2 border-b border-line px-3 py-2.5">
            <Avatar username={username} avatarUrl={avatarUrl} size={32} />
            <span className="truncate font-mono text-xs text-muted">@{username}</span>
          </div>
          <Link
            href={`/user/${username}`}
            role="menuitem"
            className={item}
            onClick={() => setOpen(false)}
          >
            Profile
          </Link>
          <Link
            href={`/list/${username}`}
            role="menuitem"
            className={item}
            onClick={() => setOpen(false)}
          >
            My list
          </Link>
          {isAdmin && (
            <Link
              href="/admin/pending"
              role="menuitem"
              className={`${item} flex items-center justify-between gap-2`}
              onClick={() => setOpen(false)}
            >
              Review changes
              {pendingCount > 0 && (
                <span className="rounded-full bg-gold px-1.5 py-0.5 font-mono text-[10px] font-bold text-paper">
                  {pendingCount}
                </span>
              )}
            </Link>
          )}
          <div className="my-1 border-t border-line" role="separator" />
          <button
            type="button"
            role="menuitemcheckbox"
            aria-checked={dark}
            onClick={() => {
              const next = !dark;
              setDark(next);
              applyTheme(next);
            }}
            className={`${item} flex items-center justify-between gap-2`}
          >
            Dark mode
            <span
              className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${
                dark ? "bg-gold" : "bg-line"
              }`}
              aria-hidden="true"
            >
              <span
                className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
                  dark ? "translate-x-4" : ""
                }`}
              />
            </span>
          </button>
          <div className="my-1 border-t border-line" role="separator" />
          <form action={signOut}>
            <button type="submit" role="menuitem" className={item}>
              Log out
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
