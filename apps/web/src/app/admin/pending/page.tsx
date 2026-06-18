import type { Metadata } from "next";
import Link from "next/link";
import { ChangeDiff } from "@/components/ChangeDiff";
import { MarkAddedButton } from "@/components/MarkAddedButton";
import { ReviewButtons } from "@/components/ReviewButtons";
import { SiteHeader } from "@/components/SiteHeader";
import { requireAdmin } from "@/lib/auth";
import { fmtRelative } from "@/lib/format";
import { getApprovedBookRequests, getPendingChanges, getSeriesEditState } from "@/lib/queries";
import { type BookRequestPayload, sanitizeEdit, type SeriesEditPayload } from "@/lib/series-edit";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Pending changes — ProgFans" };

export default async function PendingPage() {
  await requireAdmin();
  const [changes, toAdd] = await Promise.all([getPendingChanges(), getApprovedBookRequests()]);

  // Preload each edited series' current state for the diff.
  const current = new Map<number, SeriesEditPayload | null>();
  await Promise.all(
    changes
      .filter((c) => c.kind === "edit" && c.seriesId != null)
      .map(async (c) => current.set(c.id, await getSeriesEditState(c.seriesId as number))),
  );

  return (
    <div className="mx-auto max-w-3xl px-4 pb-12">
      <SiteHeader />
      <h1 className="mb-1 font-display text-2xl font-extrabold">
        Pending changes{" "}
        <span className="font-mono text-base font-normal text-muted">· {changes.length}</span>
      </h1>
      <p className="mb-6 text-sm text-muted">Edits and new-book requests awaiting review.</p>

      {changes.length === 0 ? (
        <div className="rounded-lg border border-line bg-card/60 p-8 text-center text-muted">
          Nothing pending. 🎉
        </div>
      ) : (
        <div className="space-y-4">
          {changes.map((c) => {
            const newBook = c.kind === "new_series" ? (c.payload as BookRequestPayload) : null;
            return (
              <div key={c.id} className="rounded-lg border border-line bg-card p-4">
                <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                  <div className="min-w-0">
                    <span className="mr-2 rounded bg-line/70 px-1.5 py-0.5 font-mono text-[10px] tracking-wider text-muted uppercase">
                      {c.kind === "edit" ? "Edit" : "New book"}
                    </span>
                    {c.kind === "edit" && c.seriesSlug ? (
                      <Link
                        href={`/series/${c.seriesSlug}`}
                        className="font-display font-bold text-ink hover:text-gold"
                      >
                        {c.seriesTitle}
                      </Link>
                    ) : (
                      <span className="font-display font-bold text-ink">
                        {newBook?.title ?? "Untitled request"}
                      </span>
                    )}
                  </div>
                  <span className="font-mono text-xs text-muted">
                    {c.proposer ? `@${c.proposer}` : "anon"} · {fmtRelative(c.createdAt)}
                  </span>
                </div>

                {c.kind === "edit" ? (
                  current.get(c.id) ? (
                    <ChangeDiff
                      current={current.get(c.id) as SeriesEditPayload}
                      proposed={sanitizeEdit(c.payload as SeriesEditPayload)}
                    />
                  ) : (
                    <p className="text-sm text-muted">The series no longer exists.</p>
                  )
                ) : (
                  <div className="space-y-1 text-sm">
                    {newBook?.author && (
                      <div>
                        <span className="text-muted">Author:</span> {newBook.author}
                      </div>
                    )}
                    {newBook?.url && (
                      <div className="truncate">
                        <span className="text-muted">Link:</span>{" "}
                        <a
                          href={newBook.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-gold hover:underline"
                        >
                          {newBook.url}
                        </a>
                      </div>
                    )}
                  </div>
                )}

                {c.note && (
                  <p className="mt-3 rounded border border-line bg-paper px-2.5 py-1.5 text-sm text-muted">
                    “{c.note}”
                  </p>
                )}

                <div className="mt-4 border-t border-line pt-3">
                  <ReviewButtons id={c.id} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Approved book requests — the admin's to-add list. */}
      {toAdd.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-1 font-display text-xl font-bold">
            Books to add{" "}
            <span className="font-mono text-sm font-normal text-muted">· {toAdd.length}</span>
          </h2>
          <p className="mb-4 text-sm text-muted">
            Approved requests waiting to be added to the catalog (via the scraper). Mark them added
            once they’re in.
          </p>
          <div className="space-y-2">
            {toAdd.map((c) => {
              const book = c.payload as BookRequestPayload;
              return (
                <div
                  key={c.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-card p-3"
                >
                  <div className="min-w-0">
                    <div className="font-medium text-ink">{book.title}</div>
                    <div className="truncate text-xs text-muted">
                      {book.author ? `${book.author} · ` : ""}
                      {book.url ? (
                        <a
                          href={book.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-gold hover:underline"
                        >
                          link
                        </a>
                      ) : (
                        "no link"
                      )}
                      {c.proposer ? ` · @${c.proposer}` : ""}
                    </div>
                  </div>
                  <MarkAddedButton id={c.id} />
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
