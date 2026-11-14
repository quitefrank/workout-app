"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ACTION_SHEET, placeActionSheet } from "@/lib/action-sheet";
import { cn } from "@/lib/cn";
import { CheckIcon, ChevronUpDown } from "./icons";
import { SfSymbol } from "./sf-symbol";
import type { SfSymbolName } from "./sf-symbol-data";

/** `icon` is an SF Symbol leading the label (17pt); `separator` draws a hairline above the item, starting a new group. */
export type PopUpItem = { value: string; note?: string; disabled?: boolean; destructive?: boolean; icon?: SfSymbolName; separator?: boolean };

/** Symbols are rendered at 19pt (scripts/sf-symbols.js); a menu draws them at 17pt, the kit's Body size */
const MENU_SYMBOL = 17 / 19;

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
 * no checkmark. `rect` is the button's box; the menu grows from its top-right corner. `palette` is a row of up to three
 * actions above the list, each its symbol over a short label, as UIMenu's medium element size draws them; a hairline
 * separates it from the list.
 */
export function ActionMenu({ rect, items, palette, onClose, onPick }: { rect: DOMRect; items: PopUpItem[]; palette?: PopUpItem[]; onClose: () => void; onPick: (value: string) => void }) {
  return <Menu rect={rect} items={items} palette={palette} value="" onClose={() => onClose()} onPick={onPick} />;
}

/** A tap outside, a scroll or a resize closes it, as a menu or an anchored action sheet does */
function useDismiss(panel: React.RefObject<HTMLDivElement | null>, close: (focus: boolean) => void) {
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
  }, [panel, close]);
}

export type SheetAction = { label: string; destructive?: boolean; onPick: () => void };

/**
 * The kit's Action Sheet (values and sources in src/lib/action-sheet.ts): choices about an action the person just
 * chose, grown out of the button that asked with the menu's morph and glass. Destructive actions come first. There is
 * no Cancel: a tap outside, a scroll or Escape cancels, as iOS does with an anchored action sheet. The screen behind
 * takes the kit's Overlay - Alerts, fading in and out with it (unlike a menu, which dims nothing). A pick closes it,
 * then runs once the glass has landed.
 */
export function ActionSheet({ rect, title, message, actions, onClose }: { rect: DOMRect; title: string; message?: string; actions: SheetAction[]; onClose: () => void }) {
  const panel = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"closed" | "open">("closed");
  const [pin, setPin] = useState<"top" | "bottom">("top");
  const closing = useRef(false);
  const ids = useId();

  const close = useCallback(
    (_focus: boolean, after?: () => void) => {
      if (closing.current) return;
      closing.current = true;
      setState("closed");
      window.setTimeout(() => {
        onClose();
        after?.();
      }, 320);
    },
    [onClose],
  );

  useLayoutEffect(() => {
    const el = panel.current;
    const inner = content.current;
    if (!el || !inner) return;
    const screen = { width: window.innerWidth, height: window.innerHeight };
    const width = placeActionSheet(rect, 0, screen).width;
    el.style.setProperty("--W", `${width}px`);
    const height = Math.min(Math.ceil(inner.getBoundingClientRect().height), screen.height - ACTION_SHEET.margin * 2);
    const place = placeActionSheet(rect, height, screen);
    el.style.setProperty("--W0", `${rect.width}px`);
    el.style.setProperty("--B", `${rect.height}px`);
    el.style.setProperty("--H", `${height}px`);
    el.style.setProperty("--mr", `${ACTION_SHEET.radius}px`);
    el.style.right = `${place.right}px`;
    el.style.top = place.top !== undefined ? `${place.top}px` : "";
    el.style.bottom = place.bottom !== undefined ? `${place.bottom}px` : "";
    setPin(place.pin);
    el.getBoundingClientRect();
    const frame = requestAnimationFrame(() => {
      setState("open");
      el.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [rect]);

  useDismiss(panel, close);

  return createPortal(
    <>
    {/* The kit's Overlay - Alerts over everything, bars and any sheet included. CSS on both glass paths, above the
        canvas (a full-screen flat tint cannot drift), so the painter skips it; a tap on it is a tap outside. */}
    <div
      aria-hidden
      data-unpainted
      data-screen-fill
      className={cn("fixed inset-0 z-[59] bg-[var(--alert-overlay)] transition-opacity duration-300", state === "open" ? "opacity-100" : "opacity-0")}
    />
    <div
      ref={panel}
      role="alertdialog"
      aria-modal="true"
      aria-labelledby={`${ids}-title`}
      aria-describedby={message ? `${ids}-message` : undefined}
      tabIndex={-1}
      data-state={state}
      data-pin={pin}
      onKeyDown={(e) => {
        if (e.key !== "Escape") return;
        e.preventDefault();
        close(true);
      }}
      className="glass-sheet pop-menu fixed z-[60] outline-none"
    >
      <div ref={content} className="pop-menu-content grid p-[14px]">
        <div className="grid gap-2.5 px-2 pb-6 pt-2 text-[17px] leading-[22px] tracking-[-0.43px]">
          <h2 id={`${ids}-title`} className="font-semibold">{title}</h2>
          {message && <p id={`${ids}-message`}>{message}</p>}
        </div>
        <div className="grid gap-2">
          {actions.map((a) => (
            <button
              key={a.label}
              type="button"
              onClick={() => close(false, a.onPick)}
              className={cn(
                "h-12 min-w-0 truncate rounded-full bg-fill-secondary px-4 text-[17px] font-semibold tracking-[-0.43px] outline-none transition-opacity focus-visible:ring-2 focus-visible:ring-blue active:opacity-60",
                a.destructive && "text-red",
              )}
            >
              {a.label}
            </button>
          ))}
        </div>
      </div>
    </div>
    </>,
    document.body,
  );
}

function Menu({ rect, items, palette, value, onClose, onPick }: { rect: DOMRect; items: PopUpItem[]; palette?: PopUpItem[]; value: string; onClose: (focus: boolean) => void; onPick: (value: string) => void }) {
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

  useDismiss(panel, close);

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
        {palette && palette.length > 0 && (
          <>
            <div className="grid px-3" style={{ gridTemplateColumns: `repeat(${palette.length}, minmax(0, 1fr))` }}>
              {palette.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  role="menuitem"
                  aria-disabled={item.disabled || undefined}
                  onClick={() => {
                    if (item.disabled) return;
                    close(true, () => onPick(item.value));
                  }}
                  className={cn(
                    "grid min-w-[76px] content-start justify-items-center gap-1.5 rounded-[14px] px-1 pb-2 pt-2.5 text-center outline-none focus-visible:bg-fill",
                    item.disabled ? "cursor-default text-ink-3" : "active:bg-fill",
                    item.destructive && !item.disabled && "text-red",
                  )}
                >
                  {item.icon && <span className="grid h-[22px] place-items-center"><SfSymbol name={item.icon} scale={MENU_SYMBOL} /></span>}
                  <span className="text-[13px] leading-4 tracking-[-0.08px]">{item.value}</span>
                </button>
              ))}
            </div>
            {items.length > 0 && <div aria-hidden="true" className="mx-6 my-1.5 h-px origin-top scale-y-50 bg-sep" />}
          </>
        )}
        {items.map((item) => {
          const on = item.value === value;
          const icons = items.some((i) => i.icon);
          return (
            <div key={item.value} className="contents">
              {item.separator && <div aria-hidden="true" className="mx-6 my-1.5 h-px origin-top scale-y-50 bg-sep" />}
              <button
                type="button"
                role={icons ? "menuitem" : "menuitemradio"}
                aria-checked={icons ? undefined : on}
                aria-disabled={item.disabled || undefined}
                onClick={() => {
                  if (item.disabled) return;
                  close(true, () => onPick(item.value));
                }}
                className={cn(
                  "grid min-h-11 items-center text-left text-[17px] outline-none focus-visible:bg-fill",
                  // with symbols: the kit's 24pt inset, a 26pt symbol column and 11pt to the label (More Menu Lab)
                  icons ? "grid-cols-[26px_1fr] gap-[11px] px-6" : "grid-cols-[28px_1fr] pl-3 pr-5",
                  item.disabled ? "cursor-default text-ink-3" : "active:bg-fill",
                  item.destructive && !item.disabled && "text-red",
                )}
              >
                <span className={cn(icons && "grid place-items-center")}>
                  {icons ? item.icon && <SfSymbol name={item.icon} scale={MENU_SYMBOL} /> : on && <CheckIcon size={15} strokeWidth={2.6} />}
                </span>
                <span className="grid py-2">
                  <span className="whitespace-nowrap">{item.value}</span>
                  {item.note && <span className="text-[13px] text-ink-3">{item.note}</span>}
                </span>
              </button>
            </div>
          );
        })}
      </div>
    </div>,
    document.body,
  );
}
