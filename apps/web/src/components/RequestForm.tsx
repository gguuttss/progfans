"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { submitBookRequest } from "@/app/actions/moderation";

const field =
  "w-full rounded-md border border-line bg-card px-3 py-2 text-sm outline-none focus:border-gold";
const label = "mb-1 block font-mono text-xs tracking-wider text-muted uppercase";

export function RequestForm({ initialTitle }: { initialTitle: string }) {
  const [title, setTitle] = useState(initialTitle);
  const [author, setAuthor] = useState("");
  const [url, setUrl] = useState("");
  const [note, setNote] = useState("");
  const [done, setDone] = useState(false);
  const [pending, start] = useTransition();

  if (done) {
    return (
      <div className="rounded-lg border border-gold/40 bg-gold/10 p-6">
        <p className="font-display text-lg font-bold">Request received 🙏</p>
        <p className="mt-1 text-sm text-muted">
          An admin will take a look. Thanks for helping grow the catalog.
        </p>
        <Link
          href="/browse"
          className="mt-4 inline-block rounded-md bg-gold px-4 py-2 text-sm font-medium text-paper transition-opacity hover:opacity-90"
        >
          Keep browsing
        </Link>
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!title.trim()) return;
        start(async () => {
          await submitBookRequest({ title, author, url }, note);
          setDone(true);
        });
      }}
      className="space-y-4"
    >
      <div>
        <label className={label} htmlFor="rt">
          Book or series title
        </label>
        <input id="rt" value={title} onChange={(e) => setTitle(e.target.value)} className={field} />
      </div>
      <div>
        <label className={label} htmlFor="ra">
          Author (optional)
        </label>
        <input
          id="ra"
          value={author}
          onChange={(e) => setAuthor(e.target.value)}
          className={field}
        />
      </div>
      <div>
        <label className={label} htmlFor="ru">
          Link (Goodreads / Amazon / Royal Road — optional)
        </label>
        <input
          id="ru"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://…"
          className={field}
        />
      </div>
      <div>
        <label className={label} htmlFor="rn">
          Anything else? (optional)
        </label>
        <textarea
          id="rn"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          className={field}
        />
      </div>
      <button
        type="submit"
        disabled={pending || !title.trim()}
        className="rounded-md bg-gold px-5 py-2 font-medium text-paper transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        {pending ? "Sending…" : "Request this book"}
      </button>
    </form>
  );
}
