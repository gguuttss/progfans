"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { type ProfileFormState, saveProfile, uploadAvatar } from "@/app/actions/profile";

const GENDERS = ["", "Male", "Female", "Non-binary", "Other", "Prefer not to say"];
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

type ProfileFields = {
  username: string;
  bio: string | null;
  location: string | null;
  birthday: string | null;
  birthdayPrecision: string | null;
  gender: string | null;
  avatarUrl: string | null;
};

export function ProfileEditor({ profile }: { profile: ProfileFields }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md border border-line bg-card px-3 py-1.5 text-sm font-medium text-ink transition-colors hover:border-gold"
      >
        Edit profile
      </button>
      {open && <Modal profile={profile} onClose={() => setOpen(false)} />}
    </>
  );
}

function Modal({ profile, onClose }: { profile: ProfileFields; onClose: () => void }) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(saveProfile, {} as ProfileFormState);
  const [avatar, setAvatar] = useState(profile.avatarUrl);
  const [avatarErr, setAvatarErr] = useState<string | null>(null);
  const [avatarPending, startAvatar] = useTransition();
  const [mounted, setMounted] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    if (state.ok) {
      onClose();
      router.refresh();
    }
  }, [state.ok, onClose, router]);

  const onPick = (file: File) => {
    setAvatarErr(null);
    const fd = new FormData();
    fd.set("avatar", file);
    startAvatar(async () => {
      const res = await uploadAvatar(fd);
      if (res.error) setAvatarErr(res.error);
      else if (res.url) {
        setAvatar(res.url);
        router.refresh();
      }
    });
  };

  // Defaults split from the stored birthday + precision.
  const [by, bm, bd] = (profile.birthday ?? "").split("-");
  const prec = profile.birthdayPrecision;
  const defYear = by ?? "";
  const defMonth = prec && prec !== "year" && bm ? String(Number(bm)) : "";
  const defDay = prec === "day" && bd ? String(Number(bd)) : "";
  const thisYear = new Date().getFullYear();
  const years = Array.from({ length: 110 }, (_, i) => thisYear - i);

  const field =
    "w-full rounded-md border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-gold";
  const label = "mb-1 block font-mono text-xs tracking-wider text-muted uppercase";

  if (!mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto p-4 py-10"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div className="absolute inset-0 bg-ink/40 backdrop-blur-[1px]" />
      <div
        className="relative w-full max-w-md rounded-xl border border-line bg-card p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-display text-lg font-bold">Edit profile</h3>

        {/* Avatar */}
        <div className="mt-4 flex items-center gap-4">
          <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-full border border-line bg-line">
            {avatar && (
              <Image src={avatar} alt="" fill sizes="64px" className="object-cover" unoptimized />
            )}
          </div>
          <div>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={avatarPending}
              className="rounded-md border border-line px-3 py-1.5 text-sm font-medium text-ink transition-colors hover:border-gold disabled:opacity-50"
            >
              {avatarPending ? "Uploading…" : "Change photo"}
            </button>
            {avatarErr && <p className="mt-1 text-xs text-rose-600">{avatarErr}</p>}
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onPick(f);
              }}
            />
          </div>
        </div>

        <form action={formAction} className="mt-5 space-y-3">
          <div>
            <label className={label} htmlFor="bio">
              Bio
            </label>
            <textarea
              id="bio"
              name="bio"
              defaultValue={profile.bio ?? ""}
              rows={3}
              maxLength={1000}
              className={`${field} resize-none`}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={label} htmlFor="location">
                Location
              </label>
              <input
                id="location"
                name="location"
                defaultValue={profile.location ?? ""}
                maxLength={80}
                className={field}
              />
            </div>
            <div>
              <label className={label} htmlFor="gender">
                Gender
              </label>
              <select
                id="gender"
                name="gender"
                defaultValue={profile.gender ?? ""}
                className={field}
              >
                {GENDERS.map((g) => (
                  <option key={g} value={g}>
                    {g || "—"}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className={label}>Birthday</label>
            <div className="grid grid-cols-3 gap-2">
              <select
                name="birthdayYear"
                defaultValue={defYear}
                className={field}
                aria-label="Year"
              >
                <option value="">Year</option>
                {years.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
              <select
                name="birthdayMonth"
                defaultValue={defMonth}
                className={field}
                aria-label="Month"
              >
                <option value="">Month</option>
                {MONTHS.map((m, i) => (
                  <option key={m} value={i + 1}>
                    {m}
                  </option>
                ))}
              </select>
              <select name="birthdayDay" defaultValue={defDay} className={field} aria-label="Day">
                <option value="">Day</option>
                {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
            <p className="mt-1 text-xs text-muted">Year only, or add a month/day — your choice.</p>
          </div>

          {state.error && <p className="text-sm text-rose-600">{state.error}</p>}

          <div className="flex items-center gap-2 pt-1">
            <button
              type="submit"
              disabled={pending}
              className="flex-1 rounded-md bg-ink px-3 py-2 text-sm font-medium text-paper transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {pending ? "…" : "Save"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-line px-3 py-2 text-sm font-medium text-muted transition-colors hover:text-ink"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}
