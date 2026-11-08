"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";
import { CheckIcon, ChevronUpDown } from "./icons";

export type PopUpItem = { value: string; note?: string; disabled?: boolean; destructive?: boolean };

/**
 * A labelled pop-up button (iOS 27 kit, Pop-up Button) whose menu grows out of the value with the measured morph
 * (`.pop-menu` in globals.css). One choice is plain text, since there is nothing to pick. A choice the current setup
 * rules out stays in the menu, dimmed, with what it needs, as Apple's menus keep unavailable items in place.
 */
export function PopUpMenu({ label, value, items, disabled, onChange }: { label: string; value: string; items: PopUpItem[]; disabled?: boolean; onChange: (value: string) => void }) {
  const button = useRef<HTMLButtonElement>(null);
  const [menu, setMenu] = useState<{ rect: DOMRect } | null>(null);
  const choosable = items.length > 1 && !disabled;
  return (
    <div className={cn("flex h-11 items-center justify-between gap-3", disabled && "opacity-40")}>
      <span className="shrink-0 text-[15px] text-ink-2">{label}</span>
      {items.length > 1 ? (
        <button
          ref={button}
          type="button"
          disabled={!choosable}
          aria-haspopup="menu"
          aria-expanded={!!menu}
          aria-label={`${label}: ${value}`}
          onClick={() => button.current && setMenu(menu ? null : { rect: button.current.getBoundingClientRect() })}
          className={cn("-mr-2 flex min-w-0 items-center gap-1 rounded-full px-2 py-1 text-[15px] font-medium text-blue active:bg-fill", menu && "invisible")}
        >
          <span className="truncate">{value}</span>
          <ChevronUpDown size={14} strokeWidth={2.2} className="shrink-0" />
        </button>
      ) : (
        <span className="min-w-0 truncate text-[15px] font-medium">{value}</span>
      )}
      {menu && (
        <Menu
          rect={menu.rect}
          items={items}
          value={value}
          onClose={(focus) => {
            setMenu(null);
            if (focus) button.current?.focus();
          }}
          onPick={(v) => v !== value && onChange(v)}
        />
      )}
    </div>
  );
}

/**
 * A menu of actions from a button (a More button, a chip): the same glass and morph as the pop-up button's menu, with
 * no checkmark. `rect` is the button's box; the menu grows from its top-right corner.
 */
export function ActionMenu({ rect, items, onClose, onPick }: { rect: DOMRect; items: PopUpItem[]; onClose: () => void; onPick: (value: string) => void }) {
  return <Menu rect={rect} items={items} value="" onClose={() => onClose()} onPick={onPick} />;
}

function Menu({ rect, items, value, onClose, onPick }: { rect: DOMRect; items: PopUpItem[]; value: string; onClose: (focus: boolean) => void; onPick: (value: string) => void }) {
  const panel = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"closed" | "open">("closed");
  const closing = useRef(false);

  const close = useCallback(
    (focus: boolean, after?: () => void) => {
      if (closing.current) return;
      closing.current = true;
      setState("closed");
      // the morph closes over 320ms; the value comes back as the glass lands
      window.setTimeout(() => {
        onClose(focus);
        after?.();
      }, 320);
    },
    [onClose],
  );

  // Size the glass from the value it covers to the menu, pinned at the value's top-right corner
  useLayoutEffect(() => {
    const el = panel.current;
    const inner = content.current;
    if (!el || !inner) return;
    // width first, so the height is measured with the lines laid out at the menu's real width
    inner.style.width = "max-content";
    const width = Math.min(Math.max(220, Math.ceil(inner.getBoundingClientRect().width)), window.innerWidth - 24);
    inner.style.width = "";
    el.style.setProperty("--W", `${width}px`);
    const height = Math.min(Math.ceil(inner.getBoundingClientRect().height), window.innerHeight - 24);
    el.style.setProperty("--W0", `${rect.width}px`);
    el.style.setProperty("--B", `${rect.height}px`);
    el.style.setProperty("--H", `${height}px`);
    el.style.right = `${Math.max(12, window.innerWidth - rect.right)}px`;
    el.style.top = `${Math.max(12, Math.min(rect.top, window.innerHeight - height - 12))}px`;
    el.getBoundingClientRect();
    const frame = requestAnimationFrame(() => {
      setState("open");
      const buttons = [...inner.querySelectorAll<HTMLButtonElement>("button")];
      (buttons.find((b) => b.getAttribute("aria-checked") === "true") ?? buttons.find((b) => b.getAttribute("aria-disabled") !== "true"))?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [rect]);

  // A tap outside, a scroll or a resize closes it, as a menu does
  useEffect(() => {
    const outside = (e: PointerEvent) => {
      if (!panel.current?.contains(e.target as Node)) close(false);
    };
    const away = () => close(false);
    document.addEventListener("pointerdown", outside, true);
    window.addEventListener("scroll", away, true);
    window.addEventListener("resize", away);
    return () => {
      document.removeEventListener("pointerdown", outside, true);
      window.removeEventListener("scroll", away, true);
      window.removeEventListener("resize", away);
    };
  }, [close]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    const buttons = [...(content.current?.querySelectorAll<HTMLButtonElement>("button") ?? [])];
    const at = buttons.indexOf(document.activeElement as HTMLButtonElement);
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const step = e.key === "ArrowDown" ? 1 : -1;
      buttons[(at + step + buttons.length) % buttons.length]?.focus();
    } else if (e.key === "Escape") {
      e.preventDefault();
      close(true);
    }
  };

  return createPortal(
    <div ref={panel} role="menu" data-state={state} onKeyDown={onKeyDown} className="glass-sheet pop-menu fixed z-[60] outline-none">
      <div ref={content} className="pop-menu-content grid py-1.5">
        {items.map((item) => {
          const on = item.value === value;
          return (
            <button
              key={item.value}
              type="button"
              role="menuitemradio"
              aria-checked={on}
              aria-disabled={item.disabled || undefined}
              onClick={() => {
                if (item.disabled) return;
                close(true, () => onPick(item.value));
              }}
              className={cn(
                "grid min-h-11 grid-cols-[28px_1fr] items-center pl-3 pr-5 text-left text-[17px] outline-none focus-visible:bg-fill",
                item.disabled ? "cursor-default text-ink-3" : "active:bg-fill",
                item.destructive && !item.disabled && "text-red",
              )}
            >
              <span>{on && <CheckIcon size={15} strokeWidth={2.6} />}</span>
              <span className="grid py-2">
                <span className="whitespace-nowrap">{item.value}</span>
                {item.note && <span className="text-[13px] text-ink-3">{item.note}</span>}
              </span>
            </button>
          );
        })}
      </div>
    </div>,
    document.body,
  );
}
