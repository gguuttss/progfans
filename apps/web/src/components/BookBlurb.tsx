"use client";

import { useState } from "react";

/** A book synopsis clamped to 2 lines with a More/Less toggle when it's long. */
export function BookBlurb({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const long = text.length > 140;
  return (
    <div className="mt-1">
      <p className={`text-sm text-muted ${open ? "whitespace-pre-line" : "line-clamp-2"}`}>
        {text}
      </p>
      {long && (
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="mt-0.5 text-xs font-medium text-gold transition-colors hover:underline"
        >
          {open ? "Show less" : "More"}
        </button>
      )}
    </div>
  );
}
