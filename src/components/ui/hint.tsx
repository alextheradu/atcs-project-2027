"use client";

import { Info } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/utils";

const GAP = 8;
const EDGE = 16;
const WIDTH = 300;

type Place = { left: number; width: number; top?: number; bottom?: number };

/**
 * A small "i" beside a title that holds the longer explanation, so pages show the short version first.
 * Opens on hover or keyboard focus, and a tap or click pins it open (phones have no hover).
 * The popover is fixed to the viewport, so it is never clipped by a scrolling sheet or a table.
 * It may hold links, so it is a disclosure, not a tooltip: moving into it keeps it open.
 */
export function Hint({
  children,
  label = "More about this",
  className,
}: {
  children: React.ReactNode;
  /** What a screen reader hears for the button, such as "About credits". */
  label?: string;
  className?: string;
}) {
  const id = useId();
  const wrap = useRef<HTMLSpanElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [hover, setHover] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [place, setPlace] = useState<Place | null>(null);
  const open = hover || pinned;

  const measure = useCallback(() => {
    const b = button.current;
    if (!b) return;
    const r = b.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const width = Math.min(WIDTH, vw - EDGE * 2);
    const left = Math.min(Math.max(r.left + r.width / 2 - width / 2, EDGE), vw - EDGE - width);
    const below = vh - r.bottom;
    // Above only when there is clearly more room there, so most hints read top to bottom.
    setPlace(below < 180 && r.top > below ? { left, width, bottom: vh - r.top + GAP } : { left, width, top: r.bottom + GAP });
  }, []);

  const close = useCallback(() => {
    setHover(false);
    setPinned(false);
  }, []);

  const show = () => {
    if (timer.current) clearTimeout(timer.current);
    measure();
    setHover(true);
  };
  // A short delay lets the pointer cross the gap into the popover.
  const hide = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setHover(false), 120);
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      // Escape closes the hint first, not the sheet or dialog it sits in.
      e.stopPropagation();
      e.preventDefault();
      close();
      button.current?.focus();
    };
    const onDown = (e: PointerEvent) => {
      if (!wrap.current?.contains(e.target as Node)) close();
    };
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [open, close]);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  return (
    <span
      ref={wrap}
      className={cn("relative inline-flex align-middle", className)}
      onMouseEnter={show}
      onMouseLeave={() => !pinned && hide()}
      onFocus={show}
      onBlur={(e) => {
        if (!wrap.current?.contains(e.relatedTarget as Node)) close();
      }}
    >
      <button
        ref={button}
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          measure();
          setPinned((p) => !p);
        }}
        className={cn(
          "relative inline-flex size-[18px] shrink-0 items-center justify-center rounded-full text-dim transition-colors hover:text-fg",
          "after:absolute after:-inset-2 after:content-['']",
          open && "text-fg",
        )}
      >
        <Info aria-hidden size={16} strokeWidth={2} />
      </button>
      {open && place && (
        <span
          id={id}
          role="note"
          className="hint-pop fixed z-50 block rounded-[12px] bg-fill-2 p-3.5 text-left text-[13px] font-normal leading-relaxed tracking-normal text-fg normal-case shadow-[0_12px_32px_rgb(0_0_0/0.45)] [&_a]:text-accent-ink"
          style={{ left: place.left, width: place.width, top: place.top, bottom: place.bottom }}
        >
          {children}
        </span>
      )}
    </span>
  );
}

/** A title with its hint right after it, on one line. */
export function WithHint({ children, hint, label }: { children: React.ReactNode; hint?: React.ReactNode; label?: string }) {
  if (!hint) return <>{children}</>;
  return (
    <span className="inline-flex items-center gap-1.5">
      {children}
      <Hint label={label}>{hint}</Hint>
    </span>
  );
}
