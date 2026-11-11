"use client";

import { useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * A body whose height animates open and closed, as the Journal's exercise cards do: grid rows from 0fr to 1fr on the
 * sheet's curve. Closed, it stays in the DOM, clipped to nothing and inert, so the glass painter draws nothing of it.
 * Every accordion expands and collapses through this (Frank's call, 2026-11-10); never a bare `<details>`, which
 * snaps and which the painter would draw closed.
 */
export function Collapse({ open, children, className }: { open: boolean; children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "grid transition-[grid-template-rows] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none",
        open ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
      )}
    >
      <div className={cn("min-h-0 overflow-hidden", className)} inert={!open}>
        {children}
      </div>
    </div>
  );
}

/**
 * An accordion row: the header opens its body in place, so its chevron points down and turns up when open (a right
 * chevron means another page). The header is whatever the caller draws; the chevron sits at its trailing edge.
 */
export function Disclosure({
  header,
  children,
  defaultOpen = false,
  className,
}: {
  header: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={className}>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="flex min-h-11 w-full items-center gap-3 px-4 py-2.5 text-left active:bg-fill"
      >
        <div className="min-w-0 flex-1">{header}</div>
        <svg
          width="13"
          height="8"
          viewBox="0 0 13 8"
          aria-hidden
          className={cn(
            "shrink-0 text-ink-3 transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none",
            open && "rotate-180",
          )}
        >
          <path d="M1.5 1.5l5 5 5-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <Collapse open={open}>{children}</Collapse>
    </div>
  );
}
