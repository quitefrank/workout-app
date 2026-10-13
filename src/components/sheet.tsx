"use client";

import { useEffect, useId, useRef, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";

/**
 * The kit's Sheet at the medium detent: 6pt in from the edges, 34pt
 * corners, a 58 by 4 grabber, a 20% scrim, and the sheet material.
 * Escape and a tap on the scrim close it.
 */
export function Sheet({
  open,
  onClose,
  title,
  leading,
  trailing,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  leading?: ReactNode;
  trailing?: ReactNode;
  children: ReactNode;
}) {
  const titleId = useId();
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panel.current?.focus();
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  // The stage hides the dock and stops reading the page under it while a sheet is up
  useEffect(() => {
    if (!open) return;
    document.documentElement.classList.add("sheet-open");
    return () => document.documentElement.classList.remove("sheet-open");
  }, [open]);

  // The portal needs document.body, so the server and the first client render both draw nothing
  const mounted = useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
  if (!mounted) return null;
  return createPortal(
    <div className={open ? "" : "pointer-events-none"} aria-hidden={!open}>
      <div
        onClick={onClose}
        data-scrim={open ? "on" : "off"}
        className={`fixed inset-0 z-50 bg-black/20 transition-opacity duration-300 ${open ? "opacity-100" : "opacity-0"}`}
      />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        data-glass-skip
        aria-labelledby={titleId}
        tabIndex={-1}
        className="glass-sheet fixed inset-x-1.5 z-50 mx-auto flex max-h-[calc(100dvh-60px)] max-w-[540px] flex-col outline-none transition-transform duration-[450ms] ease-[cubic-bezier(0.32,0.72,0,1)]"
        style={{
          ["--r" as string]: "34px",
          bottom: "calc(6px + env(safe-area-inset-bottom, 0px))",
          transform: open ? "none" : "translateY(calc(100% + 40px))",
        }}
      >
        <div className="mx-auto mt-[5px] h-1 w-[58px] shrink-0 rounded-full bg-ink-3" />
        <div className="mt-[7px] flex h-[54px] shrink-0 items-center justify-between gap-3 px-4 pb-2.5">
          <div className="flex min-w-16 justify-start">{leading}</div>
          <h2 id={titleId} className="truncate text-[17px] font-semibold">
            {title}
          </h2>
          <div className="flex min-w-16 justify-end">{trailing}</div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-5">{open && children}</div>
      </div>
    </div>,
    document.body,
  );
}

const noop = () => () => {};
