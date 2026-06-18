"use client";

import { useEffect, useLayoutEffect, useRef } from "react";

const MAX_FONT = 24; // px — matches the old text-2xl
const MIN_FONT = 9;

const useIso = typeof window !== "undefined" ? useLayoutEffect : useEffect;

/**
 * Size a tier label to its fixed-width cell: first shrink the font to keep it
 * on one line; only once it bottoms out (MIN_FONT) do we let it wrap, breaking
 * mid-word so even a single long word splits across lines.
 */
function fit(el: HTMLElement) {
  const cw = el.clientWidth;
  if (cw === 0) return;

  // Phase 1 — one line, shrink to fit width.
  el.style.whiteSpace = "nowrap";
  el.style.wordBreak = "normal";
  el.style.overflowWrap = "normal";
  el.style.hyphens = "manual";
  let size = MAX_FONT;
  el.style.fontSize = `${size}px`;
  while (size > MIN_FONT && el.scrollWidth > cw) {
    size -= 1;
    el.style.fontSize = `${size}px`;
  }
  if (el.scrollWidth <= cw) return; // fits on one line at this size

  // Phase 2 — still too wide at the minimum size: wrap, breaking within words.
  el.style.whiteSpace = "normal";
  el.style.wordBreak = "break-word";
  el.style.overflowWrap = "anywhere";
  el.style.hyphens = "auto";
  el.style.fontSize = `${MIN_FONT}px`;
}

function useAutoFit(text: string, sync = false) {
  const ref = useRef<HTMLDivElement>(null);
  useIso(() => {
    const el = ref.current;
    if (!el) return;
    // For the editable (uncontrolled) variant: seed/replace the text only when
    // it actually differs from the prop. During typing they're already equal,
    // so we never touch the DOM text mid-edit and the caret stays put.
    if (sync && el.textContent !== text) el.textContent = text;
    const run = () => fit(el);
    run();
    // Refit when the cell resizes (e.g. the sm: width breakpoint). Observe the
    // parent, not the label — observing the label would loop on our own font
    // changes; the parent's width is independent of them.
    const parent = el.parentElement;
    if (!parent || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(run);
    ro.observe(parent);
    return () => ro.disconnect();
  }, [text, sync]);
  return ref;
}

const LABEL_CLASS = "w-full text-center font-display font-extrabold leading-tight text-white";
const LABEL_STYLE = { fontSize: MAX_FONT, textShadow: "0 1px 2px rgba(0,0,0,0.35)" } as const;

/** Read-only auto-fitting tier label (public view, list cells). */
export function TierLabelView({ label }: { label: string }) {
  const ref = useAutoFit(label);
  return (
    <div ref={ref} lang="en" className={LABEL_CLASS} style={LABEL_STYLE}>
      {label}
    </div>
  );
}

/**
 * Editable auto-fitting tier label. Uncontrolled contentEditable: seeded once
 * so the caret never jumps on re-render; reports its text via `onChange`.
 */
export function TierLabelInput({
  value,
  onChange,
  maxLength,
}: {
  value: string;
  onChange: (v: string) => void;
  maxLength: number;
}) {
  const ref = useAutoFit(value, true);

  return (
    <div
      ref={ref}
      lang="en"
      role="textbox"
      aria-label="Tier label"
      contentEditable
      suppressContentEditableWarning
      spellCheck={false}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.preventDefault();
      }}
      onInput={(e) => {
        const el = e.currentTarget;
        let t = el.textContent ?? "";
        if (t.length > maxLength) {
          t = t.slice(0, maxLength);
          el.textContent = t;
          const r = document.createRange();
          r.selectNodeContents(el);
          r.collapse(false);
          const sel = window.getSelection();
          sel?.removeAllRanges();
          sel?.addRange(r);
        }
        onChange(t);
      }}
      className={`${LABEL_CLASS} cursor-text outline-none`}
      style={LABEL_STYLE}
    />
  );
}
