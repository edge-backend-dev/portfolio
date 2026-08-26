import { useEffect, useRef } from "react";
import { getApp } from "../data/apps";

// The single owner of the History API. No component calls pushState/popstate
// directly — they describe "where am I" as a Route and let useRouteSync mirror
// it into the address bar, and receive Back/Forward as an applyRoute() call.
//
// Without this, every navigation inside the portfolio was pure React state, so
// the history stack never grew past the page-load entry and Back unloaded the
// whole site instead of returning to the previous screen.

export type Overlay = "spotlight" | "overview" | "start";

export interface Route {
  // Open apps in z-order, last = focused. The desktop skins can have several;
  // iOS/Android have at most one.
  apps: string[];
  overlay: Overlay | null;
  split: { top: string; bottom: string } | null;
  // Android's two-step split picker: the top pane is chosen, the bottom isn't.
  // Distinct from `split` so Back can unwind the picker without also unwinding
  // whatever the Recents overview was layered over. Implies the overview.
  splitPick: string | null;
}

export const HOME: Route = { apps: [], overlay: null, split: null, splitPick: null };

// Path segments that name a system destination rather than an app. These must
// never collide with an app id — assertReserved() below enforces that in dev.
const OVERLAYS: Overlay[] = ["spotlight", "overview", "start"];
const SPLIT = "split";

function isOverlay(s: string): s is Overlay {
  return (OVERLAYS as string[]).includes(s);
}

// URLs are user-editable, so an id that names no app ("/nope") has to be dropped
// here rather than reaching a shell — a desktop skin would otherwise create a
// window for it that renders nothing but still occupies the taskbar.
function known(ids: string[]): string[] {
  return ids.filter((id) => !!getApp(id));
}

// ---------------------------------------------------------------- parse/format
// parseRoute and formatRoute are pure and are each other's inverse, so they can
// be reasoned about (and tested) without a DOM.

export function parseRoute(loc: { pathname: string }): Route {
  const segs = loc.pathname.split("/").filter(Boolean).map(decodeURIComponent);
  if (segs.length === 0) return HOME;

  if (segs[0] === SPLIT) {
    const [top, bottom] = known((segs[1] ?? "").split("+").filter(Boolean));
    if (top && bottom) return { ...HOME, split: { top, bottom } };
    // One pane named = the picker is still waiting for the second.
    return top ? { ...HOME, overlay: "overview", splitPick: top } : HOME;
  }

  // An overlay is always the last segment, optionally preceded by the apps.
  const tail = segs[segs.length - 1];
  const overlay = isOverlay(tail) ? tail : null;
  const appSeg = overlay ? segs[segs.length - 2] : tail;
  const apps = appSeg && !isOverlay(appSeg) ? known(appSeg.split("+").filter(Boolean)) : [];

  return { apps, overlay, split: null, splitPick: null };
}

// The ?os= override is carried through unchanged so a shared link keeps the
// skin it was captured in.
export function formatRoute(route: Route, search = ""): string {
  const parts: string[] = [];

  if (route.split) {
    parts.push(SPLIT, `${route.split.top}+${route.split.bottom}`);
  } else if (route.splitPick) {
    // The overview is implied by the picker — don't spell it out twice.
    parts.push(SPLIT, route.splitPick);
  } else {
    if (route.apps.length) parts.push(route.apps.join("+"));
    if (route.overlay) parts.push(route.overlay);
  }

  const path = parts.length ? `/${parts.map(encodeURIComponent).join("/")}` : "/";
  // encodeURIComponent escapes "+", which we use as the app separator.
  return path.replace(/%2B/g, "+") + search;
}

export function sameRoute(a: Route, b: Route): boolean {
  return formatRoute(a) === formatRoute(b);
}

// Dev-only guard: an app id that shadowed a system segment would make its URL
// unparseable. Cheap to check, and it fails loudly the moment an id is added.
export function assertReserved(appIds: string[]): void {
  if (!import.meta.env.DEV) return;
  const clash = appIds.filter((id) => isOverlay(id) || id === SPLIT);
  if (clash.length) {
    console.error(`[history] app id(s) collide with reserved URL segments: ${clash.join(", ")}`);
  }
}

// ------------------------------------------------------------------- History API
// Every call is wrapped: a history failure (exotic sandboxing, file://, quota)
// must degrade to "Back leaves the site", never throw into a render.

function currentSearch(): string {
  return typeof window === "undefined" ? "" : window.location.search;
}

function safeNavigate(url: string, replace: boolean): void {
  try {
    if (replace) window.history.replaceState(null, "", url);
    else window.history.pushState(null, "", url);
  } catch {
    /* inert */
  }
}

// ------------------------------------------------------------------ useRouteSync
// How many ms to wait for applyRoute() to actually reach the target before
// giving up and re-syncing the URL to reality. Comfortably longer than the
// slowest close animation (the ~400ms iOS zoom, the macOS genie).
const SETTLE_MS = 1200;

/**
 * Mirrors `route` into the address bar and turns Back/Forward into applyRoute().
 *
 * Push policy: every distinct route change pushes. Deliberately NOT depth-based
 * — collapsing "going shallower" into a replaceState leaves dead entries in the
 * stack where Back visibly does nothing, which is a worse failure than a history
 * stack that grows honestly. Consecutive entries here always differ.
 */
export function useRouteSync(route: Route, applyRoute: (r: Route) => void): void {
  const url = formatRoute(route, currentSearch());

  // Latest applyRoute without re-binding the popstate listener each render.
  const applyRef = useRef(applyRoute);
  applyRef.current = applyRoute;

  // The URL we believe the address bar currently shows.
  const last = useRef<string | null>(null);
  // While Back/Forward is being applied, the URL we're heading for. Shells close
  // apps behind an async animation, so the route settles a few hundred ms after
  // popstate — pushes stay suppressed until it lands, or SETTLE_MS elapses.
  const pending = useRef<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const onPop = () => {
      const target = parseRoute(window.location);
      const targetUrl = formatRoute(target, window.location.search);
      pending.current = targetUrl;
      last.current = targetUrl;

      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        // applyRoute couldn't reach the target. Rather than suppress pushes
        // forever, drop the latch — the next effect run re-syncs the URL.
        pending.current = null;
      }, SETTLE_MS);

      applyRef.current(target);
    };

    window.addEventListener("popstate", onPop);
    return () => {
      window.removeEventListener("popstate", onPop);
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  useEffect(() => {
    // First run adopts whatever the browser already shows as the baseline entry,
    // so a cold load doesn't spend an extra entry on itself.
    if (last.current === null) {
      last.current = url;
      safeNavigate(url, true);
      return;
    }

    if (pending.current !== null) {
      // Mid Back/Forward. Once the shell's route matches where we're going, the
      // navigation is complete; until then this is just the animation settling.
      if (url === pending.current) {
        pending.current = null;
        if (timer.current) clearTimeout(timer.current);
      }
      return;
    }

    if (url === last.current) return;
    last.current = url;
    safeNavigate(url, false);
  }, [url]);
}

/**
 * Rewrites the URL to the home route without adding an entry. For resetLayout(),
 * which reloads the page — without this the reload would rehydrate from the URL
 * and restore the very layout being reset.
 */
export function resetUrlToHome(): void {
  safeNavigate(formatRoute(HOME, currentSearch()), true);
}
