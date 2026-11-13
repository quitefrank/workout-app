"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import { cn } from "@/lib/cn";
import {
  EASE_IN_OUT,
  buttonWidth,
  elasticReveal,
  expansionTarget,
  isElastic,
  release,
  responseFor,
  shouldExpand,
  snapSpring,
  SWIPE,
} from "@/lib/swipe-row";
import { spring } from "@/lib/tab-lens";

/** The one open row: opening another, a tap elsewhere or a scroll closes it (UITableView keeps one row open). */
let openRow: { close: () => void } | null = null;

type Motion = { goal: number; response: number; damping: number; v: number };

/**
 * A list row with UITableView's trailing swipe to delete (values and sources in src/lib/swipe-row.ts). Swipe toward the
 * leading edge to show Delete; tap it, or swipe all the way, and the row slides off while its height collapses, then
 * `onDelete` runs. The Delete title sits at the row's trailing edge while the button stretches and springs to the row's
 * edge once a full swipe is armed (SwipeCellKit's `.border` layout, 0.6s critically damped). Vertical drags stay with the
 * scroller (`touch-action: pan-y`).
 */
export function SwipeRow({
  children,
  onDelete,
  disabled,
  label = "Delete",
  className,
  contentClassName,
}: {
  children: React.ReactNode;
  onDelete: () => void;
  disabled?: boolean;
  label?: string;
  className?: string;
  contentClassName?: string;
}) {
  const root = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const action = useRef<HTMLButtonElement>(null);
  const title = useRef<HTMLSpanElement>(null);
  const text = useRef<HTMLSpanElement>(null);
  const onDeleteRef = useRef(onDelete);
  useLayoutEffect(() => {
    onDeleteRef.current = onDelete;
  });

  // Everything the gesture moves lives in refs and is written straight to the DOM, once a frame
  const s = useRef({
    x: 0, // reveal, points toward the leading edge
    v: 0,
    motion: null as Motion | null,
    expanded: false,
    e: 0, // the title's place: 0 at the row's trailing edge, 1 at the row's edge
    ev: 0,
    button: SWIPE.minButton as number,
    deleting: false,
    frame: 0,
    last: 0,
  });

  const paint = () => {
    const st = s.current;
    const c = content.current, a = action.current, t = title.current;
    if (!c || !a || !t) return;
    const x = Math.max(st.x, 0);
    c.style.transform = st.x ? `translate3d(${-st.x}px,0,0)` : "";
    a.style.width = `${Math.max(x, st.button)}px`;
    t.style.width = `${st.button}px`;
    // .border: the button sits at the end of the revealed width (x - button); armed, at the row's edge (0)
    t.style.transform = `translate3d(${(x - st.button) * (1 - st.e)}px,0,0)`;
  };

  const tick = (now: number) => {
    const st = s.current;
    const dt = Math.min(48, now - (st.last || now - 16));
    st.last = now;
    let moving = false;
    if (st.motion) {
      const m = st.motion;
      [st.x, m.v] = spring(st.x, m.v, m.goal, m.response, m.damping, dt);
      if (Math.abs(st.x - m.goal) < 0.25 && Math.abs(m.v) < 4) {
        st.x = m.goal;
        st.motion = null;
      } else moving = true;
    }
    const eGoal = st.expanded ? 1 : 0;
    if (st.e !== eGoal) {
      [st.e, st.ev] = spring(st.e, st.ev, eGoal, responseFor(0.6), 1, dt);
      if (Math.abs(st.e - eGoal) < 0.002) [st.e, st.ev] = [eGoal, 0];
      else moving = true;
    }
    paint();
    st.frame = moving ? requestAnimationFrame(tick) : 0;
  };
  const run = () => {
    const st = s.current;
    if (!st.frame) {
      st.last = 0;
      st.frame = requestAnimationFrame(tick);
    }
  };
  const animateTo = (goal: number, velocity = 0, seconds: number = SWIPE.settleSeconds) => {
    const snap = snapSpring();
    s.current.motion = velocity
      ? { goal, v: velocity, response: snap.response, damping: snap.damping }
      : { goal, v: 0, response: responseFor(seconds), damping: 1 };
    run();
  };

  const close = () => {
    const st = s.current;
    if (st.deleting) return;
    st.expanded = false;
    animateTo(0);
    if (openRow?.close === close) openRow = null;
  };
  const closeRef = useRef(close);
  useLayoutEffect(() => {
    closeRef.current = close;
  });

  const del = () => {
    const st = s.current;
    const r = root.current;
    if (st.deleting || !r) return;
    st.deleting = true;
    st.expanded = true;
    if (openRow?.close === closeRef.current) openRow = null;
    // the row slides off past its width plus the button (critically damped, 0.3s) while its height collapses (0.3s)
    animateTo(r.offsetWidth + st.button, 0, SWIPE.deleteSeconds);
    r.style.height = `${r.offsetHeight}px`;
    void r.offsetHeight;
    r.style.transition = `height ${SWIPE.deleteSeconds * 1000}ms ${EASE_IN_OUT}`;
    r.style.height = "0px";
    window.setTimeout(() => onDeleteRef.current(), SWIPE.deleteSeconds * 1000);
  };

  // The button is at least 74pt, else the title padded 8pt
  useLayoutEffect(() => {
    if (text.current) s.current.button = buttonWidth(text.current.offsetWidth);
    paint();
  });

  useEffect(() => {
    const st = s.current;
    return () => {
      cancelAnimationFrame(st.frame);
      if (openRow?.close === closeRef.current) openRow = null;
    };
  }, []);

  // While open: a tap anywhere else closes the row and does nothing else; a scroll closes it
  const watching = useRef<(() => void) | null>(null);
  const watchOutside = () => {
    if (watching.current) return;
    const swallowClick = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
    };
    const onDown = (e: PointerEvent) => {
      if (action.current?.contains(e.target as Node)) return;
      if (root.current?.contains(e.target as Node) && s.current.x === 0) return;
      e.stopPropagation();
      window.addEventListener("click", swallowClick, { capture: true, once: true });
      window.setTimeout(() => window.removeEventListener("click", swallowClick, { capture: true }), 400);
      stop();
      closeRef.current();
    };
    const onScroll = (e: Event) => {
      if (root.current?.contains(e.target as Node)) return;
      stop();
      closeRef.current();
    };
    const stop = () => {
      window.removeEventListener("pointerdown", onDown, { capture: true });
      window.removeEventListener("scroll", onScroll, { capture: true });
      watching.current = null;
    };
    window.addEventListener("pointerdown", onDown, { capture: true });
    window.addEventListener("scroll", onScroll, { capture: true });
    watching.current = stop;
  };
  useEffect(() => () => watching.current?.(), []);

  const drag = useRef<{
    id: number;
    x0: number;
    y0: number;
    on: boolean;
    base: number; // the finger's x the travel counts from
    origin: number; // the reveal the travel adds to
    travel0: number; // the finger's x at the claim, for the 8pt minimum
    raw: number;
    samples: { t: number; x: number }[];
  } | null>(null);

  const onPointerDown = (e: React.PointerEvent) => {
    const st = s.current;
    if (disabled || st.deleting || e.button !== 0) return;
    drag.current = { id: e.pointerId, x0: e.clientX, y0: e.clientY, on: false, base: 0, origin: 0, travel0: 0, raw: 0, samples: [] };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const g = drag.current;
    const st = s.current;
    const r = root.current;
    if (!g || g.id !== e.pointerId || !r) return;
    const dx = e.clientX - g.x0, dy = e.clientY - g.y0;
    if (!g.on) {
      if (Math.abs(dy) > SWIPE.claim && Math.abs(dy) >= Math.abs(dx)) return void (drag.current = null);
      if (Math.abs(dx) <= SWIPE.claim || Math.abs(dx) < Math.abs(dy)) return;
      // no leading actions: a closed row ignores a swipe toward the trailing edge
      if (st.x <= 0 && dx > 0) return void (drag.current = null);
      g.on = true;
      g.base = g.travel0 = e.clientX;
      g.origin = st.x;
      st.motion = null;
      // captured on the element whose handlers follow the finger, so every move reaches them
      e.currentTarget.setPointerCapture(e.pointerId);
      if (openRow && openRow.close !== closeRef.current) openRow.close();
      openRow = { close: closeRef.current };
      watchOutside();
    }
    e.stopPropagation();
    const width = r.offsetWidth;
    g.raw = g.origin + (g.base - e.clientX);
    const goal = elasticReveal(g.raw, width, st.button);
    const fingerFromTrailing = r.getBoundingClientRect().right - e.clientX;
    const armed = shouldExpand(goal, g.travel0 - e.clientX, fingerFromTrailing, width, st.button);
    const target = expansionTarget(width, st.button);
    if (armed && !st.expanded && goal < target) {
      // armed short of the target: the row animates to the target and the finger carries on from there
      g.origin = target;
      g.base = e.clientX;
      g.raw = target;
      animateTo(target);
    } else if (st.motion) {
      st.motion.goal = goal;
    } else {
      st.x = goal;
    }
    if (armed !== st.expanded) {
      st.expanded = armed;
      if (armed) navigator.vibrate?.(10);
    }
    g.samples.push({ t: e.timeStamp, x: e.clientX });
    if (g.samples.length > 6) g.samples.shift();
    run();
  };

  const end = (e: React.PointerEvent) => {
    const g = drag.current;
    drag.current = null;
    if (!g?.on || g.id !== e.pointerId) return;
    e.stopPropagation();
    const st = s.current;
    const r = root.current;
    if (!r) return;
    // the finger's velocity over its last 100ms, positive toward the leading edge
    const recent = g.samples.filter((p) => e.timeStamp - p.t < 100);
    const a = recent[0], b = recent[recent.length - 1];
    const v = a && b && b.t > a.t ? ((a.x - b.x) / (b.t - a.t)) * 1000 : 0;
    const outcome = e.type === "pointercancel" ? (st.expanded ? "close" : release(false, v)) : release(st.expanded, v);
    const scale = isElastic(g.raw, r.offsetWidth, st.button) ? SWIPE.elasticScrollRatio : 1;
    if (outcome === "delete") return del();
    st.expanded = false;
    if (outcome === "open") animateTo(st.button, v * scale);
    else {
      animateTo(0, v * scale);
      if (openRow?.close === closeRef.current) openRow = null;
    }
  };

  return (
    <div ref={root} className={cn("relative touch-pan-y overflow-hidden", className)}>
      <div
        ref={content}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={end}
        onPointerCancel={end}
        onClickCapture={(e) => {
          // a tap on an open row's content closes it and does nothing else
          if (s.current.x > 0 && !s.current.deleting) {
            e.preventDefault();
            e.stopPropagation();
          }
        }}
        className={cn("relative will-change-transform", contentClassName)}
      >
        {children}
        {/* Delete hangs off the row's trailing edge and moves with it, filling whatever the row has uncovered */}
        <button
          ref={action}
          type="button"
          tabIndex={-1}
          aria-label={label}
          onClick={del}
          className="absolute left-full top-0 h-full overflow-hidden bg-red text-left text-white"
          style={{ width: SWIPE.minButton }}
        >
          <span ref={title} className="absolute left-0 top-0 flex h-full items-center justify-center whitespace-nowrap text-[15px] font-medium" style={{ width: SWIPE.minButton }}>
            <span ref={text}>{label}</span>
          </span>
        </button>
      </div>
    </div>
  );
}
