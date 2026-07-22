// ============================================================
//  The macOS "genie" effect — a real mesh warp, not a scale.
//
//  A single CSS transform can only shear/scale a rectangle affinely, which is
//  why "collapse the window toward the dock" never looks like the genie: the real
//  effect is a *non-affine* warp. macOS (and Ciechan's BCGenieEffect, and Harshil
//  Shah's recreation) all do the same thing — slice the window into thin
//  horizontal strips and lay each strip between two bézier curves that funnel from
//  the window's full width down to a narrow neck at the dock icon. Two staggered
//  sub-motions sell it: the neck/funnel FORMS first, then the strips POUR down
//  through it into the icon. Restore plays the whole thing in reverse.
//
//  We can't warp live DOM with one transform, so we reproduce the strip technique:
//  clone the window once, stack N clip-banded copies of the clone, and every frame
//  give each strip its own translate+scale so the stack traces the funnel. Cloning
//  (rather than rasterising to a canvas) keeps the real page CSS, so the strips are
//  pixel-identical to the window with no snapshot library. reduced-motion skips it.
//
//  References: github.com/Ciechan/BCGenieEffect, harshil.net/blog/recreating-the-mac-genie-effect
// ============================================================

export interface Point {
  x: number;
  y: number;
}

const SUCK_MS = 440; // minimize / close — pour into the dock
const SPRING_MS = 640; // open / restore — pour back out, quick launch then settle
const NECK = 22; // half-width (px) of the neck the window funnels down to
const CURVE_END = 0.92; // funnel width eases across almost the whole run (no late "balloon")

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    !!window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/** The live centre of an app's dock icon, or null if it isn't mounted. */
export function dockIconCenter(id: string): Point | null {
  if (typeof document === "undefined") return null;
  const el = document.querySelector<HTMLElement>(`[data-dock-id="${id}"]`);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

/** Fallback target: centre of the dock strip along the bottom edge. */
export function dockFallback(): Point {
  if (typeof window === "undefined") return { x: 0, y: 0 };
  return { x: window.innerWidth / 2, y: window.innerHeight - 40 };
}

/** The window element for an app id (used by the dock-click minimize path). */
export function windowEl(id: string): HTMLElement | null {
  if (typeof document === "undefined") return null;
  return document.querySelector<HTMLElement>(`[data-win-id="${id}"]`);
}

// ---- bézier funnel ---------------------------------------------------------
// One cubic curve profiles the *vertical* fall from window-top to the dock; the
// left and right edges share that profile but sweep their x from the window sides
// in to the neck. Because the control points hold x at the full width for the top
// third and only draw in low down, a strip stays full-width until it descends into
// the neck — which is exactly how the genie funnels.

const smoothstep = (x: number) => x * x * (3 - 2 * x);
const easeOut = (x: number) => 1 - Math.pow(1 - x, 3); // fast launch, gentle settle
const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const cubic = (a: number, b: number, c: number, d: number, s: number) => {
  const n = 1 - s;
  return n * n * n * a + 3 * n * n * s * b + 3 * n * s * s * c + s * s * s * d;
};

interface Funnel {
  T: number;
  B: number; // window top / bottom (screen y)
  L: number;
  R: number; // window left / right (screen x)
  dx: number;
  dy: number; // dock icon centre
  y1: number;
  y2: number; // vertical control points
}

/** Solve the fall curve for the parameter s whose y equals a screen y. */
function paramAtY(f: Funnel, y: number): number {
  let s = clamp01((y - f.T) / (f.dy - f.T || 1));
  for (let i = 0; i < 5; i++) {
    const n = 1 - s;
    const fy = cubic(f.T, f.y1, f.y2, f.dy, s) - y;
    const dfy =
      3 * n * n * (f.y1 - f.T) + 6 * n * s * (f.y2 - f.y1) + 3 * s * s * (f.dy - f.y2);
    if (Math.abs(dfy) < 1e-4) break;
    s = clamp01(s - fy / dfy);
  }
  return s;
}

/** Left/right screen x of the funnel at fall-parameter s. */
function edgesAtParam(f: Funnel, s: number): { l: number; r: number } {
  return {
    l: cubic(f.L, f.L, f.dx - NECK, f.dx - NECK, s),
    r: cubic(f.R, f.R, f.dx + NECK, f.dx + NECK, s),
  };
}

// ---- strip warp engine -----------------------------------------------------

interface Warp {
  cancel(): void;
}
const active = new WeakMap<HTMLElement, Warp>();

interface Strip {
  wrap: HTMLElement;
  top: number; // this strip's top in window-local px
}

/** Build the clip-banded clone stack over the window; returns the strips + funnel. */
function buildStrips(el: HTMLElement): {
  container: HTMLElement;
  strips: Strip[];
  bandH: number;
  W: number;
  H: number;
  L: number;
  T: number;
} {
  const r = el.getBoundingClientRect();
  const W = r.width;
  const H = r.height;
  const N = Math.max(8, Math.min(28, Math.round(H / 18)));
  const bandH = H / N;

  const container = document.createElement("div");
  container.setAttribute("data-genie-warp", "");
  container.style.cssText =
    "position:fixed;inset:0;pointer-events:none;z-index:2147483000;contain:strict;";

  // The window paints with a translucent surface + backdrop-filter (vibrancy).
  // A moving clone would re-sample the desktop behind it and go see-through, so
  // we bake the window's solid content colour into each strip and drop the
  // backdrop-filter — the whole thing sucks in as one opaque sheet.
  const content = el.querySelector<HTMLElement>(".win-content");
  const solidBg = getComputedStyle(content ?? el).backgroundColor;

  const strips: Strip[] = [];
  for (let i = 0; i < N; i++) {
    const wrap = document.createElement("div");
    const top = i * bandH;
    // Full window box, positioned at the window's live screen spot, clipped to
    // just this horizontal band. A slight overlap on the bottom hides seams.
    const bot = Math.max(0, H - (i + 1) * bandH - (i < N - 1 ? 0.5 : 0));
    wrap.style.cssText =
      `position:fixed;left:${r.left}px;top:${r.top}px;width:${W}px;height:${H}px;` +
      `transform-origin:0 0;will-change:transform,opacity;` +
      `clip-path:inset(${top}px 0px ${bot}px 0px);contain:layout paint;`;

    const clone = el.cloneNode(true) as HTMLElement;
    clone.style.cssText =
      `position:absolute;left:0;top:0;width:${W}px;height:${H}px;margin:0;` +
      `transform:none;transition:none;pointer-events:none;box-sizing:border-box;` +
      `background:${solidBg};backdrop-filter:none;-webkit-backdrop-filter:none;`;
    clone.removeAttribute("data-win-id");
    wrap.appendChild(clone);
    container.appendChild(wrap);
    strips.push({ wrap, top });
  }

  // Mount inside the shell root, not <body>: the per-OS tokens (--win-radius,
  // --mac-close, --shadow-window…) are scoped to [data-os]/[data-theme] there,
  // and the root supplies the inherited font/colour too. Strips parented to
  // <body> fall outside that scope and render unstyled for the whole warp.
  const scope = el.closest("[data-os]") ?? document.body;
  scope.appendChild(container);
  return { container, strips, bandH, W, H, L: r.left, T: r.top };
}

/**
 * Run one warp. `t` sweeps 0→1 (suck into dock) for minimize/close, or 1→0
 * (pour back out) for restore. Resolves when finished (or superseded).
 */
function runWarp(el: HTMLElement, target: Point, reverse: boolean): Promise<void> {
  active.get(el)?.cancel();

  const { container, strips, bandH, W, H, L, T } = buildStrips(el);
  const N = strips.length;
  const f: Funnel = {
    T,
    B: T + H,
    L,
    R: L + W,
    dx: target.x,
    dy: target.y,
    y1: T + (target.y - T) * 0.42,
    y2: T + (target.y - T) * 0.82,
  };

  // Hide the real window for the duration; the strips stand in for it. Set
  // synchronously so restore (called in a layout effect) never flashes full-size.
  el.style.opacity = "0";

  let raf = 0;
  let done = false;
  let settle: () => void;
  const finished = new Promise<void>((res) => (settle = res));

  const cleanup = (showReal: boolean) => {
    if (done) return;
    done = true;
    cancelAnimationFrame(raf);
    container.remove();
    active.delete(el);
    if (showReal) el.style.opacity = "";
    settle();
  };

  // `p` is genie progress (0 = full window, 1 = fully in the dock). We drive the
  // N+1 horizontal boundary lines between strips, each with its own staggered
  // slide so the bottom of the window pours out first and the top follows. Strip
  // i then spans boundary i→i+1; because neighbours SHARE a boundary node, the
  // strips always tile edge-to-edge with no gaps (the "broken lines" bug). The
  // neck itself forms over the first CURVE_END of the run.
  const boundary = new Array<number>(N + 1);
  const apply = (p: number) => {
    const form = smoothstep(clamp01(p / CURVE_END)); // 0→1 funnel forms

    // Slid screen-y of every strip boundary (0 = window top … N = window bottom).
    for (let i = 0; i <= N; i++) {
      const frac = i / N; // 0 = top edge, 1 = bottom edge
      const start = 0.55 - 0.25 * frac; // lower boundaries start sliding earlier
      const slide = smoothstep(clamp01((p - start) / (1 - start)));
      const y0 = T + i * bandH;
      boundary[i] = y0 + slide * (f.dy - y0);
    }

    for (let i = 0; i < N; i++) {
      const strip = strips[i];
      const topY = boundary[i]; // this strip's current top / bottom on screen
      const botY = boundary[i + 1];
      const sy = Math.max((botY - topY) / bandH, 0.02);
      const yc = (topY + botY) / 2; // centre, for the funnel width lookup

      // Funnel edges at this strip's height, eased in from full-width by `form`.
      const e = edgesAtParam(f, paramAtY(f, yc));
      const lx = L + (e.l - L) * form;
      const rx = L + W + (e.r - (L + W)) * form; // note: e.r toward neck
      const width = Math.max(rx - lx, 1);

      const sx = width / W;
      const tx = lx - L;
      const ty = topY - T - sy * strip.top; // top edge lands exactly on boundary i

      strip.wrap.style.transform = `translate(${tx}px, ${ty}px) scale(${sx}, ${sy})`;
      strip.wrap.style.opacity = p > 0.9 ? String(clamp01((1 - p) / 0.1)) : "1";
    }
  };

  active.set(el, { cancel: () => cleanup(false) });

  const dur = reverse ? SPRING_MS : SUCK_MS;
  const t0 = performance.now();
  const frame = (now: number) => {
    if (done) return;
    const raw = clamp01((now - t0) / dur);
    // Ease the master timeline so restore leaps out of the dock and settles,
    // instead of crawling linearly (which read as sluggish).
    const e = easeOut(raw);
    apply(reverse ? 1 - e : e);
    if (raw < 1) raf = requestAnimationFrame(frame);
    else cleanup(reverse); // restore reveals the real window; minimize leaves it hidden
  };
  apply(reverse ? 1 : 0); // pin the first frame before paint
  raf = requestAnimationFrame(frame);
  return finished;
}

/**
 * Suck the window into its dock icon. Resolves when it has fully poured in — the
 * caller then flips React state (minimized / closed). The real element is left
 * hidden so there's no flash before React hides it.
 */
export function genieMinimize(el: HTMLElement, target: Point): Promise<void> {
  if (prefersReducedMotion()) return Promise.resolve();
  return runWarp(el, target, false);
}

/** Closing pours into the dock just like minimizing, then the window is removed. */
export function genieClose(el: HTMLElement, target: Point): Promise<void> {
  return genieMinimize(el, target);
}

/**
 * Pour the window back out of its dock icon — the reverse genie, used when an app
 * is launched or restored. The real element is revealed once the warp settles.
 */
export function genieRestore(el: HTMLElement, target: Point): Promise<void> {
  if (prefersReducedMotion()) {
    el.style.opacity = "";
    return Promise.resolve();
  }
  return runWarp(el, target, true);
}
