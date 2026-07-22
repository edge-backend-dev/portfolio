import { useEffect, useRef } from "react";

// Two-finger swipe to open/close the window overview (Mission Control / Task
// view), shared by both desktop skins.
//
// Why two fingers and not three: the real OS bindings are 3- and 4-finger
// swipes, and those are swallowed by the compositor — no event of any kind
// reaches a browser, on Windows or macOS. A two-finger swipe is the only
// multi-touch trackpad motion a page can see, and it arrives as `wheel`. Pinch
// is reachable too (`wheel` + ctrlKey) but taking it would break browser zoom,
// so it's deliberately left alone.

/** px a burst must accumulate before it counts as a swipe */
const TRAVEL = 90;
/** a trackpad swipe ramps up from small deltas; a mouse-wheel notch starts big */
const RAMP = 40;
/** ms of silence that ends one burst and starts the next */
const QUIET = 140;
/** a trackpad streams events; anything shorter isn't a swipe */
const MIN_EVENTS = 3;

/**
 * `deltaY` sign of a physical two-finger swipe UP.
 *
 * Trackpads scroll naturally on both platforms — macOS always, and Windows 11
 * precision touchpads default to "down motion scrolls up" — so fingers up means
 * the page scrolls down and deltaY reads positive on both. A mouse wheel is the
 * opposite, which is one more reason to reject it. Nothing exposes the user's
 * scroll-direction setting, so anyone who flipped it gets the two directions
 * swapped; the keyboard and click fallbacks cover them.
 */
const UP = 1;

/** true if anything under `target` can actually scroll right now */
function canScroll(target: EventTarget | null): boolean {
  let el = target instanceof Element ? target : null;
  while (el && el !== document.body) {
    // scrollHeight is free; the computed style isn't, so check it second
    if (el.scrollHeight > el.clientHeight) {
      const oy = getComputedStyle(el).overflowY;
      if (oy === "auto" || oy === "scroll") return true;
    }
    el = el.parentElement;
  }
  return false;
}

/**
 * Calls `onSwipe` when a two-finger swipe lands on a surface that can't scroll
 * — wallpaper, dock, taskbar, menu bar, title bars, or a window whose content
 * already fits. Scrollable surfaces are left to scroll, so the gesture never
 * competes with reading an app.
 */
export function useOverviewGesture(onSwipe: (dir: "up" | "down") => void) {
  const cb = useRef(onSwipe);
  cb.current = onSwipe;

  useEffect(() => {
    let travel = 0;
    let events = 0;
    let last = 0;
    let dead = false;
    let fired = false;

    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey) return; // pinch-zoom: the browser's gesture, not ours
      if (e.deltaMode !== 0) return; // line/page units mean a mouse wheel

      const fresh = e.timeStamp - last > QUIET;
      last = e.timeStamp;

      if (fresh) {
        travel = 0;
        events = 0;
        fired = false;
        // Judge the surface once per burst: walking ancestors and reading
        // computed styles on every wheel event would cost far too much.
        dead = Math.abs(e.deltaY) > RAMP || canScroll(e.target);
      }
      if (dead) return;

      events += 1;
      travel += e.deltaY;
      if (fired || events < MIN_EVENTS || Math.abs(travel) < TRAVEL) return;

      fired = true; // one toggle per swipe, however long the finger keeps going
      e.preventDefault();
      cb.current(Math.sign(travel) === UP ? "up" : "down");
    };

    window.addEventListener("wheel", onWheel, { passive: false });
    return () => window.removeEventListener("wheel", onWheel);
  }, []);
}
