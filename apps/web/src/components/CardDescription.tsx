"use client";

import { useRouter } from "next/navigation";

// Fixed 4-line synopsis beside the cover; scroll inside (wheel) to read the
// rest. A plain click still navigates to the series page, like the rest of the
// card — the box just needs pointer events so it can scroll.
export function CardDescription({ text, href }: { text: string; href: string }) {
  const router = useRouter();
  return (
    <div
      onClick={() => router.push(href)}
      className="pointer-events-auto h-16 cursor-pointer overflow-x-hidden overflow-y-auto pr-1 text-xs leading-4 break-words whitespace-pre-line text-muted"
    >
      {text}
    </div>
  );
}
