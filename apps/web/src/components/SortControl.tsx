"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

export function SortControl() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const sort = searchParams.get("sort") ?? "tier";

  const onChange = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "tier") params.delete("sort");
    else params.set("sort", value);
    params.delete("page"); // jump back to page 1 when the order changes
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  return (
    <label className="flex shrink-0 items-center gap-2 text-sm text-muted">
      Sort
      <select
        value={sort}
        onChange={(e) => onChange(e.target.value)}
        className="rounded border border-line bg-card px-2 py-1.5 text-sm text-ink outline-none focus:border-gold"
      >
        <optgroup label="Highest rated">
          <option value="tier">ProgFans tier score</option>
          <option value="rating_pf">ProgFans rating</option>
          <option value="rating_rr">Royal Road rating</option>
          <option value="rating_gr">Goodreads rating</option>
        </optgroup>
        <optgroup label="Most ratings">
          <option value="reviews_pf">ProgFans ratings</option>
          <option value="reviews_rr">Royal Road reviews</option>
          <option value="reviews_gr">Goodreads ratings</option>
        </optgroup>
      </select>
    </label>
  );
}
