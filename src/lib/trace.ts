/**
 * A temporary frame recorder for the stepper keyboard bug (2026-11-10), on only while Settings > Developer is on.
 * Every focus change, viewport resize or scroll records each frame for the next 1.5 s (viewport, window scroll, the
 * focus screen's lift and place, the focused field), then posts the batch to /api/trace, which writes it to the
 * Vercel logs. Remove once the bug is settled.
 */
type Sample = (string | number)[];

export function startTrace(): () => void {
  const vv = window.visualViewport;
  const html = document.documentElement;
  let until = 0;
  let frame = 0;
  let t0 = 0;
  let events: string[] = [];
  let samples: Sample[] = [];

  const sample = (now: number) => {
    const fs = document.querySelector<HTMLElement>("[data-focus-screen]");
    const el = document.activeElement;
    const input = el instanceof HTMLInputElement ? el : null;
    const sc = document.querySelector<HTMLElement>("[data-app-scroller]");
    samples.push([
      Math.round(now - t0),
      events.join("+"),
      Math.round(vv?.height ?? 0),
      Math.round(vv?.offsetTop ?? 0),
      Math.round(window.scrollY),
      window.innerHeight,
      html.style.getPropertyValue("--focus-lift") || "-",
      html.classList.contains("keyboard") ? 1 : 0,
      input?.getAttribute("aria-label")?.split(" ")[0] ?? (el?.tagName ?? "-"),
      fs ? Math.round(fs.getBoundingClientRect().top) : "-",
      input ? Math.round(input.getBoundingClientRect().top) : "-",
      sc ? Math.round(sc.scrollTop) : "-",
    ]);
    events = [];
  };

  const flush = () => {
    if (!samples.length) return;
    const body = JSON.stringify({
      ua: navigator.userAgent,
      gpu: html.classList.contains("gpu"),
      standalone: html.classList.contains("standalone"),
      cols: "t,ev,vvH,vvTop,scrollY,innerH,lift,kb,focus,fsTop,inTop,scTop",
      samples,
    });
    samples = [];
    fetch("/api/trace", { method: "POST", body, keepalive: true }).catch(() => {});
  };

  const loop = (now: number) => {
    sample(now);
    if (now < until) frame = requestAnimationFrame(loop);
    else {
      frame = 0;
      flush();
    }
  };

  const on = (name: string) => () => {
    events.push(name);
    const now = performance.now();
    if (!frame) {
      t0 = now;
      frame = requestAnimationFrame(loop);
    }
    until = now + 1500;
  };

  const handlers: [EventTarget | null | undefined, string, () => void][] = [
    [document, "focusin", on("in")],
    [document, "focusout", on("out")],
    [document, "pointerdown", on("down")],
    [vv, "resize", on("vvR")],
    [vv, "scroll", on("vvS")],
    [window, "scroll", on("winS")],
  ];
  for (const [t, n, h] of handlers) t?.addEventListener(n, h, { passive: true, capture: true });
  return () => {
    for (const [t, n, h] of handlers) t?.removeEventListener(n, h, { capture: true });
    cancelAnimationFrame(frame);
    flush();
  };
}
