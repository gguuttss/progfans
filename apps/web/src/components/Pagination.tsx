import Link from "next/link";

type SP = Record<string, string | string[] | undefined>;

export function Pagination({
  pathname,
  searchParams,
  page,
  totalPages,
}: {
  pathname: string;
  searchParams: SP;
  page: number;
  totalPages: number;
}) {
  if (totalPages <= 1) return null;

  const href = (p: number) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(searchParams)) {
      if (k === "page" || v == null) continue;
      if (Array.isArray(v)) v.forEach((x) => q.append(k, x));
      else q.append(k, v);
    }
    if (p > 1) q.set("page", String(p));
    const s = q.toString();
    return s ? `${pathname}?${s}` : pathname;
  };

  // Windowed page list: 1 … (page-1, page, page+1) … last
  const win = 1;
  const items: (number | "…")[] = [];
  for (let p = 1; p <= totalPages; p++) {
    if (p === 1 || p === totalPages || (p >= page - win && p <= page + win)) {
      items.push(p);
    } else if (items[items.length - 1] !== "…") {
      items.push("…");
    }
  }

  const cell =
    "flex h-9 min-w-[2.25rem] items-center justify-center rounded-md border px-2 text-sm";

  return (
    <nav className="mt-6 flex flex-wrap items-center justify-center gap-1.5">
      {page > 1 && (
        <Link href={href(page - 1)} className={`${cell} border-line text-ink hover:border-gold`}>
          ‹ Prev
        </Link>
      )}
      {items.map((p, i) =>
        p === "…" ? (
          <span key={`e${i}`} className="px-1 text-muted">
            …
          </span>
        ) : (
          <Link
            key={p}
            href={href(p)}
            aria-current={p === page ? "page" : undefined}
            className={`${cell} ${
              p === page
                ? "border-gold bg-gold/10 font-semibold text-ink"
                : "border-line text-muted hover:border-gold"
            }`}
          >
            {p}
          </Link>
        ),
      )}
      {page < totalPages && (
        <Link href={href(page + 1)} className={`${cell} border-line text-ink hover:border-gold`}>
          Next ›
        </Link>
      )}
    </nav>
  );
}
