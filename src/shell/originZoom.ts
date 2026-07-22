// ============================================================
//  Origin-zoom — the phone app open/close motion.
//
//  On real iOS/Android, tapping an icon doesn't fade a screen in; the app
//  GROWS out of the exact icon you tapped and fills the display, and on close
//  it shrinks straight back into that same icon. We reproduce that by animating
//  the full-screen app-view layer between its natural (full) rect and the rect
//  of the launcher icon.
//
//  Like the macOS genie (see genie.ts) this uses the Web Animations API rather
//  than CSS keyframes, because the target — the live position of a specific
//  icon — is only known at tap time, which a static stylesheet can't express.
// ============================================================

export interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** Per-platform timing/curve for a zoom. */
export interface ZoomOpts {
  duration: number;
  easing: string;
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    !!window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/** The icon artwork's box for app `id` within `root` (the <svg> inside its launcher button). */
export function launcherIconBox(root: ParentNode | null | undefined, id: string): Box | null {
  const btn = root?.querySelector?.(`[data-app-icon="${CSS.escape(id)}"]`) ?? null;
  return iconBox(btn);
}

/** The icon artwork's box for a launcher button element. */
export function iconBox(btn: Element | null): Box | null {
  if (!btn) return null;
  const art = btn.querySelector("svg") ?? btn;
  const r = art.getBoundingClientRect();
  return { left: r.left, top: r.top, width: r.width, height: r.height };
}

/** A small centred box near the bottom of `el` — used when the icon isn't found. */
export function fallbackBox(el: HTMLElement): Box {
  const r = el.getBoundingClientRect();
  const w = 60;
  return { left: r.left + r.width / 2 - w / 2, top: r.top + r.height - 90, width: w, height: w };
}

// The transform that maps `el`'s natural full-screen rect onto `box` (the icon).
// With transform-origin at the top-left, translate moves the corner onto the
// icon and scale shrinks the layer to the icon's size.
function collapsedTransform(el: HTMLElement, box: Box): string {
  const r = el.getBoundingClientRect();
  const sx = box.width / r.width;
  const sy = box.height / r.height;
  const tx = box.left - r.left;
  const ty = box.top - r.top;
  return `translate(${tx}px, ${ty}px) scale(${sx}, ${sy})`;
}

function clearInline(el: HTMLElement) {
  el.style.transform = "";
  el.style.opacity = "";
  el.style.transformOrigin = "";
  el.style.willChange = "";
}

/**
 * Grow the app-view `el` out of the launcher icon `from`. Runs from a layout
 * effect so `fill: "both"` pins the collapsed first frame before paint — no
 * flash of the full-size view. Resolves once it has settled at full size, then
 * releases the inline styles back to the natural CSS.
 */
export function zoomIn(el: HTMLElement, from: Box, opts: ZoomOpts): Promise<void> {
  if (prefersReducedMotion()) {
    clearInline(el);
    return Promise.resolve();
  }
  el.getAnimations().forEach((a) => a.cancel());
  const collapsed = collapsedTransform(el, from);
  el.style.transformOrigin = "0 0";
  el.style.willChange = "transform, opacity";
  const anim = el.animate(
    [
      { transform: collapsed, opacity: 0, offset: 0 },
      { opacity: 1, offset: 0.32 }, // fade completes early; the growth carries the rest
      { transform: "translate(0px, 0px) scale(1, 1)", opacity: 1, offset: 1 },
    ],
    { duration: opts.duration, easing: opts.easing, fill: "both" },
  );
  return anim.finished
    .then(() => {
      clearInline(el);
      anim.cancel(); // drop the held frame; natural CSS now matches it exactly
    })
    .catch(() => undefined); // cancelled by a newer zoom — that call owns el now
}

/**
 * Shrink the app-view `el` back into the launcher icon `to`. The final
 * (collapsed, invisible) frame is HELD via `fill: "both"` so the view never
 * blinks back to full size before the caller unmounts it — the caller flips its
 * React state to remove the element once this resolves.
 */
export function zoomOut(el: HTMLElement, to: Box, opts: ZoomOpts): Promise<void> {
  if (prefersReducedMotion()) return Promise.resolve();
  el.getAnimations().forEach((a) => a.cancel());
  const collapsed = collapsedTransform(el, to);
  el.style.transformOrigin = "0 0";
  el.style.willChange = "transform, opacity";
  const anim = el.animate(
    [
      { transform: "translate(0px, 0px) scale(1, 1)", opacity: 1, offset: 0 },
      { opacity: 1, offset: 0.68 }, // stay opaque most of the way, fade at the very end
      { transform: collapsed, opacity: 0, offset: 1 },
    ],
    { duration: opts.duration, easing: opts.easing, fill: "both" },
  );
  return anim.finished.then(() => undefined).catch(() => undefined);
}
