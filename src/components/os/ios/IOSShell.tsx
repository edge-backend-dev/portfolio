import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { getApp } from "../../../data/apps";
import type { AppApi } from "../../apps/appApi";
import type { OSKind, Theme, WallpaperPref } from "../../../shell/types";
import {
  zoomIn,
  zoomOut,
  rectTransform,
  prefersReducedMotion,
  iconBox,
  launcherIconBox,
  fallbackBox,
  IDENTITY,
  type Box,
  type ZoomOpts,
} from "../../../shell/originZoom";
import { useRouteSync, parseRoute, type Route } from "../../../shell/history";
import HomeScreen from "./HomeScreen";
import Spotlight from "./Spotlight";
import AppView from "./AppView";

// Resolve the opening screen from the URL synchronously, in the state
// initializers below — deferring it to an effect would paint the home screen
// first and then swap, flashing the wrong screen on every deep link.
function initial() {
  if (typeof window === "undefined") return { app: null as string | null, spotlight: false };
  const r = parseRoute(window.location);
  return { app: r.apps[0] ?? r.split?.top ?? null, spotlight: r.overlay === "spotlight" };
}

interface SkinProps {
  theme: Theme;
  setTheme: (t: Theme) => void;
  os: OSKind;
  setOS: (os: OSKind | null) => void;
  autoOS: OSKind;
  overriding: boolean;
  wallpaper: WallpaperPref;
  setWallpaper: (pref: WallpaperPref) => void;
}

// iOS spring-ish open, slightly quicker accelerating close — the app grows out
// of the tapped icon and shrinks back into it.
const OPEN: ZoomOpts = { duration: 400, easing: "cubic-bezier(0.16, 1, 0.3, 1)" };
const CLOSE: ZoomOpts = { duration: 300, easing: "cubic-bezier(0.4, 0, 0.6, 1)" };
// The curve iOS rides for anything a finger threw: quick out, long soft landing.
const SLIDE: ZoomOpts = { duration: 340, easing: "cubic-bezier(0.32, 0.72, 0, 1)" };
const SPRING: ZoomOpts = { duration: 260, easing: "cubic-bezier(0.32, 0.72, 0, 1)" };

// How many apps stay open at once. Older ones fall off the left of the deck.
const MAX_OPEN = 8;

// Gesture thresholds. Distances are fractions of the screen so they hold at any
// size; velocities are px/ms, so a flick commits even when it barely travelled.
const AXIS_LOCK = 8; // px of travel before the gesture picks an axis
const SWITCH_DISTANCE = 0.22;
const SWITCH_VELOCITY = 0.4;
// Home vs. App Switcher is not a distance test. A real iPhone reads the same
// upward swipe two ways by what the finger does at the END of it: let go while
// it's still travelling up and you go Home; bring it to a stop first — a hold —
// and the row stays lifted as the App Switcher. These describe that fork, all
// as fractions of the card HEIGHT unless noted.
//   MIN_LIFT      below this the swipe barely happened — fall back to the app.
//   HOME_FLICK_V  let go still moving up this fast (px/ms) → Home.
//   PUSH_HOME     shoved up past this much without ever stopping → Home.
//   PARK_V        at or below this speed (px/ms) the finger counts as parked.
//   DWELL_MS      parked at least this long before release → App Switcher.
//   IDLE_MS       no pointer event for this long at release ⇒ finger was still.
const MIN_LIFT = 0.03;
const HOME_FLICK_V = 0.15;
const PUSH_HOME = 0.34;
const PARK_V = 0.04;
const DWELL_MS = 100;
const IDLE_MS = 70;
// Vertical fractions are measured against a phone-sized height, not the live
// window: a desktop window is half again as tall as a phone, so the same
// fraction would otherwise be a drag nobody would make with a mouse. Capped
// here. (The sideways swipe is fine — it's measured against the width, and
// .ios-screen is already capped at 430px.)
const REF_HEIGHT = 760;
// The hold that opens the switcher WITHOUT waiting for release: lift past
// HOLD_LIFT, let the finger settle under PARK_V, and after HOLD_MS the row
// glides up on its own — cards sliding out from under a stationary finger, the
// way iOS does it.
const HOLD_LIFT = 0.04;
const HOLD_MS = 240;
const EDGE_RESIST = 0.3; // drag past the last app and it barely moves

// ---- how the row looks once it's lifted off the screen (the App Switcher) ----
// Swiping up doesn't shrink the current app on its own: it shrinks the WHOLE
// row, so the apps either side of it come into view as cards receding into a
// deck over a blurred home screen. `lift` below runs 0 -> 1 with the finger.
//
// THE DECK IS A PINHOLE PROJECTION. A card `p` steps from the focus is treated
// as sitting CARD_SPREAD*p deck-widths across the world and CARD_DEPTH*|p|
// focal lengths BACK from the camera, so one divisor
//
//     q(p) = 1 / (1 + CARD_DEPTH * |p|)
//
// carries both halves of what a viewer reads as depth: the card's size is
// multiplied by q, and its sideways offset is multiplied by the same q. Because
// a single projection drives both, the row stays self-consistent — each card is
// smaller than the one in front of it AND its step in from the edge shortens by
// exactly the amount perspective would shorten it, which is what makes the row
// read as one stack going back rather than a fan of loose rectangles. It is
// also symmetric by construction: |p| means a card N steps either side of the
// focus takes the same shrink and the same offset, so the peek matches on both
// sides. And because q is smooth in `p`, a scroll that paints a fractional
// position gets a fractional shrink — cards grow as they come forward instead
// of popping a size at each card boundary.
//
// q's steps shrink as they go back (-12.3%, -8.8%, -6.6%, ... at CARD_DEPTH
// 0.14) rather than stepping down linearly, which is the falloff a real
// receding stack has and the reason a linear per-card scale looks wrong.
//
// Depth beyond the projection is carried by three things, all interpolated off
// each card's DISTANCE FROM THE FOCUS (never its raw place in the row):
//
//   * z-index — the focused card is frontmost and every other card recedes
//     behind it. This is what actually orders the deck: DOM order is MOUNT
//     order (see `mounted`), not row order, so painting back-to-front by
//     rearranging nodes isn't available — moving a node would throw away the
//     app's scroll position. The z-index is therefore written per slot on every
//     frame, from the live fractional distance, so the two cards crossing the
//     centre swap depth while they're still a half-step apart;
//   * a dim laid over the card, so a card behind sits in the shadow of the one
//     in front (a plain opacity fade would make it see-through instead, and the
//     blurred home screen would show through the app);
//   * the card's own drop shadow, which separates two overlapping cards.
const CARD_SHRINK = 0.22; // how far the ROW scales down at a full lift (-> ~78%)
const CARD_DEPTH = 0.14; // focal lengths a card falls back per step from focus
// How far the neighbour's inner edge tucks UNDER the focused card, as a
// fraction of the screen width. This is the number that is actually looked at,
// so it's the one that's authored; CARD_SPREAD below is solved from it.
const CARD_TUCK = 0.085;
// Centre-to-centre step, in PRE-scale deck widths. Solved rather than authored:
// picking a spread by hand and hoping the peek lands is what makes the row need
// re-tuning every time the shrink or the depth moves. On screen the focused
// card has half-width s/2 and the neighbour s*q/2 (s = the row's own scale),
// and the neighbour's centre sits at s*CARD_SPREAD*q — so asking for its inner
// edge to land CARD_TUCK inside the focused card's edge,
//
//     s*SPREAD*q - s*q/2 = s/2 - CARD_TUCK
//
// gives the line below. Change CARD_SHRINK, CARD_DEPTH or CARD_TUCK and the
// spread re-derives; the peek stays where it was authored.
const CARD_SPREAD = (() => {
  const s = 1 - CARD_SHRINK; // the row's own scale at a full lift
  const q = 1 / (1 + CARD_DEPTH); // the first neighbour's projected size
  return ((s * (1 + q)) / 2 - CARD_TUCK) / (s * q);
})();
const CARD_DIM = 0.1; // how much darker each step back sits, capped below
const CARD_DIM_MAX = 0.32;
const CARD_FADE = 0.18; // opacity lost per card of distance past the first
// The deck stays out of sight until the card being lifted has very nearly
// become one. On a real iPhone the app you are dismissing holds the screen on
// its own for most of the swipe and the rest of the row only arrives as it
// lands — reveal it with the lift and the neighbours are already showing at the
// halfway point, which reads as the switcher opening early rather than as the
// app going away. Everything but the focused card is therefore held off until
// the lift passes CARD_REVEAL and eased in over what is left, so a swipe that
// is abandoned partway never shows the row at all.
const CARD_REVEAL = 0.72;
// How far outside its place a held-off card waits, in deck widths: they slide
// in from the edges as they appear instead of fading up where they will sit.
const CARD_ENTER = 0.16;
const CARD_Z = 1000; // z-index of the focused card; the rest step down from here
const CARD_RADIUS = 44; // on-screen corner radius of a lifted card
const CARD_RADIUS_MAX = 0.11; // ...capped to this fraction of the deck's width,
//                               so a narrow window doesn't get an over-rounded
//                               card — a real device's corner scales with it
const LIFT_FULL = 0.22; // travel, as a fraction of card height, that reads as a full lift
const LIFT_RISE = 0.03; // how far the row itself drifts up at a full lift
// Scrolling the settled deck the way iOS does it: the finger lets go and the
// deck keeps going, losing this fraction of its speed every millisecond, until
// it's slow enough to land on the nearest card.
const SCROLL_FRICTION = 0.994;
const SCROLL_STOP = 0.02; // px/ms — below this the glide is over
// Flicking a card up off the deck closes that app. Distance is a fraction of the
// lifted card's height; velocity is px/ms, so a short hard flick counts too.
const CARD_CLOSE_DISTANCE = 0.16;
const CARD_CLOSE_VELOCITY = 0.5;
// What happens after the finger lets go is integrated as physics rather than
// eased over a fixed duration, so the motion continues the gesture instead of
// restarting it: a card that is put back springs from the speed it was moving
// at, and a card that is thrown leaves at the speed it was thrown. px and
// seconds — the gestures' px/ms is converted on the way in.
const CARD_STIFFNESS = 420; // per second squared; with the damping below this
const CARD_DAMPING = 34; //    sits just under critical, so a card settles with
//                             the barest overshoot rather than gliding in dead
const CARD_REST = 0.5; // px from home it counts as landed...
const CARD_REST_V = 40; // ...if it's also under half a pixel a frame. Without a
//                          velocity floor this wide the tail of the spring is
//                          spent crawling the last pixel, which doubles how
//                          long the gesture takes to finish for nothing seen.
const CARD_LAUNCH = 2000; // px/s floor on the speed a card leaves the deck at,
//                           so a slow drag past the commit distance still goes
const CARD_ACCEL = 3600; // px/s^2 it keeps gaining, so it clears the top rather
//                          than trailing off the screen
const CARD_TRAIL = 0.9; // screens of travel over which a leaving card fades out
const CARD_TRAIL_FLOOR = 0.35; // ...but never below this while the finger holds it

function refHeight(h: number): number {
  return Math.min(h, REF_HEIGHT);
}

/** Eased at both ends, so a value ramped in over a window arrives and leaves
 *  without a corner — used for anything that fades in partway through another
 *  animation, where a linear ramp shows the moment it starts. */
function smooth(k: number): number {
  const t = Math.max(0, Math.min(1, k));
  return t * t * (3 - 2 * t);
}

/** How visible a card is once it has been dragged `dy` up off the deck: gone by
 *  the time it has travelled CARD_TRAIL screens. A function of where the card
 *  is rather than of how long it has been going, so the fade can't come unstuck
 *  from the motion when the finger hands it over mid-flight. */
function cardTrail(dy: number, h: number): number {
  return Math.max(0, Math.min(1, 1 + dy / (h * CARD_TRAIL)));
}

/** A spring, integrated frame by frame: it takes the velocity the finger left
 *  behind (px/s) and carries `x` to `to`, painting every step. Semi-implicit
 *  Euler with dt clamped, so a dropped frame integrated in one go can't throw
 *  it. `hold` is where the caller keeps its rAF handle, so an interrupting
 *  gesture cancels this the same way it cancels every other animation here. */
function springTo(
  from: number,
  velocity: number,
  to: number,
  paint: (x: number) => void,
  done: () => void,
  hold: { current: number },
) {
  let x = from;
  let v = velocity;
  let prev = performance.now();
  const step = (now: number) => {
    const dt = Math.min(0.032, (now - prev) / 1000);
    prev = now;
    v += (-CARD_STIFFNESS * (x - to) - CARD_DAMPING * v) * dt;
    x += v * dt;
    if (Math.abs(x - to) < CARD_REST && Math.abs(v) < CARD_REST_V) {
      paint(to);
      return done();
    }
    paint(x);
    hold.current = requestAnimationFrame(step);
  };
  hold.current = requestAnimationFrame(step);
}

type Axis = "x" | "y";

interface Drag {
  id: number;
  x0: number;
  y0: number;
  x: number;
  y: number;
  t: number;
  vx: number;
  vy: number;
  axis: Axis | null;
  /** The app view's rect BEFORE the drag transform — measuring it live would
   *  compound the scale on every pointer move. */
  natural: Box | null;
  /** Deck offset in px when the finger went down, so an interrupted slide is
   *  picked up from wherever it had got to. */
  from: number;
  /** How far the row is currently lifted, 0 → 1; the spring-back animates this
   *  number back to 0 through the same painter the finger drives. */
  lift: number;
  /** Set once the hold-timer fires: the switcher is showing and frozen, and
   *  further finger movement is ignored until release. */
  held: boolean;
  /** When the finger last dropped to a near-stop while lifted (or null while
   *  it's moving). A long enough gap before release is the "hold" that means
   *  App Switcher instead of Home. */
  slowSince: number | null;
  /** Which card was focused when the gesture started. Paging the settled deck
   *  is measured from here, so one long drag can cross several cards. */
  base: number;
}

/** A gesture on the cards themselves once the App Switcher is settled: sideways
 *  scrolls the deck, up throws a card off it. `card` is the app the finger went
 *  down on, which is not necessarily the focused one. */
interface SwitcherDrag {
  id: number;
  x0: number;
  y0: number;
  x: number;
  y: number;
  t: number;
  vx: number;
  vy: number;
  axis: Axis | null;
  base: number;
  card: string | null;
}

// iOS uses the home-screen → fullscreen-app paradigm: one app fills the screen.
// But the apps you've opened don't go away — they stack up in a row (the App
// Switcher) that the home indicator swipes through sideways, and swiping up
// suspends the current app into that row rather than closing it.
export default function IOSShell(props: SkinProps) {
  // `order` is the switcher order, oldest → newest, which is also left → right
  // on screen. `mounted` is DOM order and only ever grows: reordering the row
  // moves each app's slot with a transform instead of moving its node, because
  // detaching a node would throw away the scroll position we're keeping.
  const [deck, setDeck] = useState<{ order: string[]; mounted: string[] }>(() => {
    const a = initial().app;
    return { order: a ? [a] : [], mounted: a ? [a] : [] };
  });
  const [activeId, setActiveId] = useState<string | null>(() => initial().app);
  const [spotlight, setSpotlight] = useState(() => initial().spotlight);
  const [closing, setClosing] = useState(false); // app is shrinking back to its icon
  const [peek, setPeek] = useState(false); // home showing behind a live swipe-up
  // True once a hold has been released into the persistent App Switcher: the
  // row stays lifted and no app is fullscreen, same as real iOS after a pause.
  const [switcher, setSwitcher] = useState(false);

  const screenRef = useRef<HTMLDivElement>(null);
  const deckRef = useRef<HTMLDivElement>(null);
  const scrimRef = useRef<HTMLDivElement>(null);
  // Set when the next activeId change should GROW out of an icon rather than
  // slide. Starts filled so a cold deep link still animates in.
  const pendingZoom = useRef<{ from: Box | null } | null>({ from: null });
  // Set when it should instead slide in from one edge: the home screen's
  // sideways bar swipe, which brings the last app back the way it left.
  const pendingSlide = useRef<number | null>(null);
  const busy = useRef(false); // guards against re-entrant close while animating
  const drag = useRef<Drag | null>(null);
  const swipe = useRef<SwitcherDrag | null>(null); // gestures on the settled deck
  const cardRaf = useRef(0); // a card being thrown off the deck, or falling back
  const scrollRaf = useRef(0); // the deck gliding on after the finger let go
  // Set while the deck is closing the gap a thrown card left behind: how many
  // places in the row each remaining card still has to travel, by app id. Read
  // by paintStack, so the settle goes through the same projection as everything
  // else — a card moving in shrinks, dims and re-orders on the way instead of
  // sliding as a flat rectangle into its new place.
  const reflow = useRef<Map<string, number> | null>(null);
  const reflowRaf = useRef(0);
  // The fractional card the deck is painted on right now. A glide or a settle
  // has to start from exactly where the last frame left it, not from the last
  // card that was committed as the focus.
  const liveIndex = useRef(0);
  const swiped = useRef(false); // a real drag happened; swallow the click after it
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const raf = useRef(0); // the spring-back that returns an abandoned lift to 0

  function clearHoldTimer() {
    if (holdTimer.current !== null) {
      clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
  }
  useEffect(
    () => () => {
      clearHoldTimer();
      cancelAnimationFrame(raf.current);
      cancelAnimationFrame(cardRaf.current);
      cancelAnimationFrame(scrollRaf.current);
      cancelAnimationFrame(reflowRaf.current);
    },
    [],
  );

  const index = activeId ? deck.order.indexOf(activeId) : -1;
  // Where the deck sits while nothing is active: on the app we just left, so a
  // minimise animation plays in place instead of jumping to the row's start.
  const lastIndex = useRef(0);
  const deckIndex = index >= 0 ? index : lastIndex.current;
  // The render-time `deckIndex` above can lag `lastIndex.current`: paging the
  // switcher writes that ref without a re-render, so anything imperative (the
  // painter, the spring-backs, the release handlers) has to read the focus
  // live or it snaps back to whichever card was focused when the row lifted.
  const focusIndex = () => (index >= 0 ? index : lastIndex.current);

  // ------------------------------------------------------------------ elements
  function activeViewEl(): HTMLElement | null {
    return deckRef.current?.querySelector<HTMLElement>(".ios-deck-slot.is-active .ios-appview") ?? null;
  }
  // offsetWidth, not getBoundingClientRect().width: the deck is scaled down while
  // the App Switcher is up, and the rect would report that shrunk width back —
  // every position the painter derives from it would then compound the scale.
  // offsetWidth is the layout width, before any transform.
  function deckWidth(): number {
    return deckRef.current?.offsetWidth ?? 0;
  }
  // Live horizontal offset, read through the computed style so it's right even
  // mid-animation — that's what lets an interrupted slide be picked up.
  function deckOffset(): number {
    const el = deckRef.current;
    if (!el) return 0;
    const t = getComputedStyle(el).transform;
    return !t || t === "none" ? 0 : new DOMMatrix(t).m41;
  }

  // The deck's position is owned imperatively, not through a style prop: the
  // drag writes straight to el.style, and React would have no way to know its
  // own last value had been overwritten. One owner avoids that class of bug.
  // A live lift owns it outright, so leave it alone while one is in progress.
  useLayoutEffect(() => {
    const el = deckRef.current;
    if (el && !el.classList.contains("switching")) {
      el.style.transform = `translateX(${-deckIndex * 100}%)`;
    }
    if (index >= 0) lastIndex.current = index;
  }, [deckIndex, index]);

  // Grow the app out of the tapped icon. Layout effect + fill:"both" pins the
  // collapsed frame before paint, so there's no flash of the full-size view.
  // Only opens do this; moving along the row slides the deck instead.
  useLayoutEffect(() => {
    if (!activeId) return;
    const slide = pendingSlide.current;
    const req = pendingZoom.current;
    pendingSlide.current = null;
    pendingZoom.current = null;
    const el = activeViewEl();
    if (!el) return;
    if (slide) {
      if (!prefersReducedMotion()) {
        el.animate([{ transform: `translateX(${slide * 100}%)` }, { transform: "translateX(0)" }], {
          duration: SLIDE.duration,
          easing: SLIDE.easing,
        });
      }
      return;
    }
    if (!req) return;
    const from = req.from ?? fallbackBox(el);
    void zoomIn(el, from, OPEN);
  }, [activeId]);

  // A minimised app still carries zoomOut's final collapsed frame, held there by
  // fill:"both". It's off screen now, but a sideways swipe brings it back
  // WITHOUT a zoom to clear it, so drop the held frame as it leaves.
  useLayoutEffect(() => {
    if (activeId) return;
    deckRef.current?.querySelectorAll<HTMLElement>(".ios-appview").forEach((el) => {
      el.getAnimations().forEach((a) => a.cancel());
      el.style.transform = "";
      el.style.opacity = "";
      el.style.transformOrigin = "";
      el.style.willChange = "";
    });
  }, [activeId]);

  // --------------------------------------------------------------- deck state
  function promote(id: string) {
    setDeck((d) => {
      const order = [...d.order.filter((x) => x !== id), id];
      const mounted = d.mounted.includes(id) ? d.mounted : [...d.mounted, id];
      if (order.length <= MAX_OPEN) return { order, mounted };
      const dropped = new Set(order.slice(0, order.length - MAX_OPEN));
      return {
        order: order.filter((x) => !dropped.has(x)),
        mounted: mounted.filter((x) => !dropped.has(x)),
      };
    });
  }

  // Opening always moves the app to the newest end of the row, the way iOS
  // reorders the switcher when you launch something from the home screen.
  function open(id: string, from: HTMLElement | null) {
    if (busy.current) return;
    setSpotlight(false);
    if (id === activeId) return;
    // The origin is measured HERE, at tap time, rather than in the layout effect
    // above. A Spotlight result unmounts in the same commit that opens the app,
    // so by then the row is detached and measures as a zero rect — the app would
    // fly out of the screen's top-left corner.
    pendingZoom.current = { from: from ? iconBox(from) : null };
    promote(id);
    setActiveId(id);
  }

  // The home screen's sideways bar swipe: bring back the app you were last in,
  // sliding it in from the edge the finger came from. iOS reaches the same app
  // the same way, and it does NOT reorder the row — you can swipe straight back.
  function resumeLast(dir: number) {
    if (busy.current || activeId) return;
    const id = deck.order[deck.order.length - 1];
    if (!id) return;
    pendingZoom.current = null;
    pendingSlide.current = dir;
    setActiveId(id);
  }

  // Move along the row. Deliberately does NOT reorder it: iOS keeps the chain
  // stable while you swipe, so you can go back and forth through the same apps.
  function switchTo(target: number) {
    const t = Math.max(0, Math.min(deck.order.length - 1, target));
    slideDeck(deckOffset(), t);
    const id = deck.order[t];
    if (id && id !== activeId) setActiveId(id);
  }

  // Animate the deck to `target`'s resting place. Both endpoints are px so the
  // animation can start wherever the finger left off; the inline style it
  // settles on is a percentage, which survives a window resize.
  function slideDeck(fromPx: number, target: number) {
    const el = deckRef.current;
    if (!el) return;
    const settle = () => {
      el.style.transform = `translateX(${-target * 100}%)`;
      el.classList.remove("is-moving");
    };
    if (prefersReducedMotion()) return settle();
    el.getAnimations().forEach((a) => a.cancel());
    el.classList.add("is-moving"); // neighbours have to be paintable to slide in
    const anim = el.animate(
      [
        { transform: `translateX(${fromPx}px)` },
        { transform: `translateX(${-target * deckWidth()}px)` },
      ],
      { duration: SLIDE.duration, easing: SLIDE.easing, fill: "both" },
    );
    void anim.finished
      .then(() => {
        settle();
        anim.cancel(); // drop the held frame; the inline style now matches it
      })
      .catch(() => undefined); // superseded by a newer slide, which owns el now
  }

  // ----------------------------------------------------------- the lifted row
  // One painter for the switcher, driven by `lift` (0 = the app fills the
  // screen, 1 = a fully lifted row of cards). The finger calls it, and so does
  // the spring-back, so both take exactly the same path.
  //
  // The row takes the shared shrink as ONE layer about the screen's centre,
  // which is what brings the neighbours in from the sides on their own; each
  // card's own depth is then layered on top of that, per slot, in paintStack.
  // Splitting it this way means the per-card scale is a small correction around
  // 1 rather than the whole shrink, so a card never has to be un-scaled to
  // stay aligned — every offset here is a fraction of the deck's own width and
  // rides the row's scale unchanged.
  //
  // `idx` is deliberately allowed to be fractional: scrolling the settled deck
  // paints a position between two cards every frame.
  function paintLift(lift: number, dx: number, idx = focusIndex()) {
    const el = deckRef.current;
    if (!el) return;
    const w = deckWidth() || 1;
    const h = refHeight(screenRef.current?.getBoundingClientRect().height ?? 1);
    const s = 1 - CARD_SHRINK * lift;
    // .ios-deck scales about its own centre (no transform-origin is set), which
    // keeps whatever card is at the middle of the row centred on screen for
    // free — so the row only has to be shifted sideways to put card `idx` in
    // that middle.
    const x = -s * idx * w + dx;
    const y = -h * LIFT_RISE * lift;
    liveIndex.current = idx;
    // Divided by the row's scale so it lands at its authored size on screen,
    // and capped against the live deck width so a narrow window doesn't get an
    // over-rounded card. Deliberately NOT divided by each card's own depth
    // scale as well: a card further back should have a smaller corner, the same
    // as it has a smaller everything else.
    const radius = Math.min(CARD_RADIUS, w * CARD_RADIUS_MAX);
    el.style.setProperty("--card-radius", `${(radius * lift) / s}px`);
    el.style.transform = `translate(${x}px, ${y}px) scale(${s})`;
    paintStack(lift, idx, w);
    if (scrimRef.current) scrimRef.current.style.opacity = `${lift}`;
  }

  // The two halves of the projection, and the only place the deck's geometry is
  // defined. `p` is the card's signed distance from the focus and is deliberately
  // fractional: a live scroll paints a position between two cards every frame,
  // and both of these are smooth in `p` so that position gets a smooth size and
  // a smooth offset rather than snapping at each card boundary.

  // How big a card `p` steps back is drawn, as a fraction of a card at the
  // focus. |p|, so the row recedes the same way on both sides.
  function cardDepth(p: number): number {
    return 1 / (1 + CARD_DEPTH * Math.abs(p));
  }

  // Where its centre projects to, in pre-scale deck widths from the focus. The
  // world offset CARD_SPREAD*p is divided by the SAME depth divisor that shrank
  // the card, which is what keeps the two consistent: as cards recede their
  // steps close up at exactly the rate their size falls off, so the deck reads
  // as one stack going back instead of a row of shrinking rectangles.
  function cardOffset(p: number): number {
    return CARD_SPREAD * p * cardDepth(p);
  }

  // The half of the stack the shared row-scale can't express: each card's own
  // size, its place in the row, how far it's dimmed, and which card covers
  // which. All four are a function of the slot's DISTANCE FROM THE FOCUS, not
  // its index — the focus moves every frame during a scroll and React isn't in
  // that loop, so it's written per slot here. Every term is scaled by `lift`,
  // so at rest the slots fall back onto the plain one-per-screen tiling the
  // rest of the shell relies on.
  function paintStack(lift: number, idx: number, w: number) {
    const el = deckRef.current;
    if (!el) return;
    // How much of the deck behind the focused card has arrived: 0 leaves that
    // card alone on the screen, 1 is the settled row. The card being lifted is
    // never held back by it, only everything else.
    const reveal = smooth((lift - CARD_REVEAL) / (1 - CARD_REVEAL));
    const shifts = reflow.current;
    el.querySelectorAll<HTMLElement>(".ios-deck-slot").forEach((slot) => {
      // Where the stylesheet has already tiled this slot, from its place in the
      // row as React currently has it.
      const raw = Number(slot.dataset.pos ?? 0) - idx;
      // ...and where the projection should treat it as being, which is the same
      // thing except while the deck is closing a gap: the cards that have to
      // move carry a fraction of a place for the length of that settle, so they
      // travel through every intermediate depth rather than jumping a place the
      // moment React renumbers the row (see the settle in the effect below).
      const p = raw + (shifts?.get(slot.dataset.app ?? "") ?? 0);
      const dist = Math.abs(p);
      // How far this card is still being held off screen, 1 = not yet arrived.
      // Weighted by distance so the focused card is never held, and so a card
      // part way between two places during a scroll is held part way too.
      const held = (1 - reveal) * Math.min(1, dist);
      // Ease the card's own scale in with the lift, from 1 (flat, tiling the
      // row one screen apart) to its projected size. The row's shared scale is
      // applied to the deck, so this multiplies it rather than replacing it.
      const q = 1 - lift * (1 - cardDepth(p));
      // The offset is authored as where the card should END UP, so subtract the
      // `raw` screens the stylesheet has already tiled the slot by. A card that
      // hasn't arrived yet waits a further CARD_ENTER out towards the edge it
      // will come in from, so the reveal is a slide rather than a fade in place.
      const enter = held * CARD_ENTER * Math.sign(p);
      slot.style.setProperty("--card-x", `${lift * w * (cardOffset(p) + enter - raw)}px`);
      slot.style.setProperty("--card-scale", `${q}`);
      // Nearest the focus on top; every card recedes behind it, both directions.
      // Rounded off `dist` so the order is stable frame to frame and the swap as
      // two cards cross the centre lands while they're a half-step apart. The
      // cards at +n and -n are the same distance out, so `dist` alone leaves
      // them tied and the browser would fall back to DOM order — which is mount
      // order, not row order. The older (left) card takes the extra step back,
      // so the deck always recedes the same way whatever order apps opened in.
      slot.style.zIndex = String(CARD_Z - Math.round(dist * 100) - (p < 0 ? 1 : 0));
      // A card behind sits in the shadow of the one in front. Laid over the card
      // rather than taken out of its opacity: opacity would make the app itself
      // translucent and the blurred home screen would show through it.
      slot.style.setProperty(
        "--card-dim",
        `${(1 - held) * lift * Math.min(CARD_DIM_MAX, CARD_DIM * dist)}`,
      );
      // Past the first neighbour a card is mostly off-screen anyway; this is
      // what stops the far end of a long deck piling up as a hard edge.
      slot.style.opacity = `${(1 - held) * (1 - lift * CARD_FADE * Math.min(2, Math.max(0, dist - 1)))}`;
    });
  }

  // Anything that takes over the deck finishes a gap-settle on the spot rather
  // than abandoning it: the shift it carries is what every later paint measures
  // from, so it can't be left part way through.
  function finishSettle() {
    if (!reflow.current) return;
    cancelAnimationFrame(reflowRaf.current);
    reflow.current = null;
    paintLift(1, 0);
  }

  function slotEl(id: string): HTMLElement | null {
    return deckRef.current?.querySelector<HTMLElement>(`.ios-deck-slot[data-app="${id}"]`) ?? null;
  }

  // On-screen px from the focused card to its neighbour in the settled deck —
  // the unit every scroll gesture is measured in. Taken from cardOffset rather
  // than from CARD_SPREAD directly so it can't drift from what's painted: the
  // projection shortens the first step by the neighbour's depth, and a gesture
  // measured against the un-projected spread would move the row further than
  // the finger. Steps further back are shorter still, but the drag is always
  // moving the card at the FOCUS, so the focus-to-neighbour step is the honest
  // unit for it.
  function cardStep(): number {
    const w = deckWidth() || 1;
    return Math.max(1, (1 - CARD_SHRINK) * cardOffset(1) * w);
  }

  // Put the row back the way the rest of the shell expects to find it.
  // `keepCard` leaves the corner radius alone: a card that's committing to home
  // is about to shrink into its icon, and squaring it off mid-flight would show.
  function endLift(keepCard = false) {
    const el = deckRef.current;
    if (el) {
      el.classList.remove("is-moving");
      el.style.transform = `translateX(${-focusIndex() * 100}%)`;
      if (!keepCard) {
        el.classList.remove("switching");
        el.style.removeProperty("--card-radius");
      }
      // The stack's per-slot state is only meaningful while the row is lifted;
      // left behind, it would out-rank the active app's own slot.
      el.querySelectorAll<HTMLElement>(".ios-deck-slot").forEach((slot) => {
        slot.style.zIndex = "";
        slot.style.opacity = "";
        slot.style.removeProperty("--card-x");
        slot.style.removeProperty("--card-scale");
        slot.style.removeProperty("--card-dim");
        slot.style.removeProperty("--card-dy");
      });
    }
    if (scrimRef.current) scrimRef.current.style.opacity = "0";
    setPeek(false);
  }

  // Let go without committing and the row falls back onto the screen. Animated
  // by hand rather than by WAAPI or a CSS transition because the gap and the
  // corner radius are custom properties feeding several elements at once — one
  // rAF walking the same painter keeps every part of the row in step.
  function springLift(lift: number, dx: number) {
    setPeek(false);
    if (prefersReducedMotion()) return endLift();
    const t0 = performance.now();
    const step = (now: number) => {
      const k = Math.min(1, (now - t0) / SPRING.duration);
      const e = 1 - Math.pow(1 - k, 3);
      paintLift(lift * (1 - e), dx * (1 - e));
      if (k < 1) raf.current = requestAnimationFrame(step);
      else endLift();
    };
    raf.current = requestAnimationFrame(step);
  }

  // The mirror of springLift: carry a partial lift the REST of the way UP to a
  // settled row of cards, then hand it to enterSwitcher so the row stays put as
  // real state. Every path that commits to the switcher from a half-finished
  // drag comes through here — a mid-band release, a swipe up from the home
  // screen, the hold timer firing under the finger.
  function settleToSwitcher(lift: number, dx: number) {
    if (prefersReducedMotion()) {
      paintLift(1, 0);
      return enterSwitcher();
    }
    const t0 = performance.now();
    const step = (now: number) => {
      const k = Math.min(1, (now - t0) / SPRING.duration);
      const e = 1 - Math.pow(1 - k, 3);
      paintLift(lift + (1 - lift) * e, dx * (1 - e));
      if (k < 1) raf.current = requestAnimationFrame(step);
      else {
        paintLift(1, 0);
        enterSwitcher();
      }
    };
    raf.current = requestAnimationFrame(step);
  }

  // Swipe up, tap the bar, Escape, or the nav bar's Home button. The app leaves
  // the screen but STAYS in the deck with its scroll intact — iOS suspends into
  // the switcher, it doesn't close. It also becomes the most recent, so it's
  // what a swipe right from the next app lands on.
  async function minimize() {
    const id = activeId;
    if (!id || busy.current) return;
    const el = activeViewEl();
    // Coming out of a lift, this card is already a small rounded rectangle
    // sitting somewhere mid-screen. Hand the row back first, then start the
    // shrink from exactly where the row had the card — otherwise it snaps to
    // fullscreen for a frame before collapsing into the icon.
    let from = IDENTITY;
    if (el && deckRef.current?.classList.contains("switching")) {
      cancelAnimationFrame(raf.current);
      const lifted = el.getBoundingClientRect();
      endLift(true);
      from = rectTransform(el.getBoundingClientRect(), lifted);
    }
    if (el) {
      busy.current = true;
      setClosing(true); // let the home screen ease back in while the app shrinks
      const to = launcherIconBox(screenRef.current, id) ?? fallbackBox(el);
      await zoomOut(el, to, CLOSE, from);
      busy.current = false;
    }
    endLift();
    setClosing(false);
    setActiveId(null);
    promote(id);
  }

  // Land in the persistent App Switcher: the hold already painted the row at
  // full lift (paintLift(1, 0) in dragCard), so this just turns that live-drag
  // visual into real state — no app is fullscreen, and the row stays lifted
  // instead of springing back or continuing on to Home.
  function enterSwitcher() {
    setPeek(true);
    setSwitcher(true);
    setActiveId(null);
  }

  // Tapping a card in the switcher: unlift the row and open that app, right
  // from wherever the row currently has the card (not a fresh zoom out of its
  // launcher icon — it is already open, just suspended).
  function openFromSwitcher(id: string) {
    if (busy.current) return;
    const pos = deck.order.indexOf(id);
    if (pos < 0) return;
    cancelAnimationFrame(raf.current);
    cancelAnimationFrame(scrollRaf.current);
    const el = deckRef.current;
    const from = el ? getComputedStyle(el).transform : IDENTITY;
    lastIndex.current = pos;
    setSwitcher(false);
    pendingZoom.current = null;
    pendingSlide.current = null;
    setActiveId(id);
    if (el) {
      // Each slot carries its own depth now, so dropping the stack has to be
      // animated per slot as well as on the row: clearing the properties alone
      // would snap the tapped card from its projected size straight to
      // fullscreen, a visible jump under the finger that lands on it. Read every
      // slot's live matrix BEFORE the properties go, then hand each one the same
      // spring the row is taking — the card grows out of exactly where it sat.
      const slots = [...el.querySelectorAll<HTMLElement>(".ios-deck-slot")].map((slot) => ({
        slot,
        from: getComputedStyle(slot).transform,
      }));
      el.classList.remove("switching", "is-moving");
      el.style.removeProperty("--card-radius");
      for (const { slot } of slots) {
        slot.style.zIndex = "";
        slot.style.opacity = "";
        slot.style.removeProperty("--card-x");
        slot.style.removeProperty("--card-scale");
        slot.style.removeProperty("--card-dim");
        slot.style.removeProperty("--card-dy");
      }
      // Cleared in one pass, then animated in another: reading a slot's
      // computed transform flushes style, so interleaving the two would force a
      // recalc per card instead of one for the lot.
      if (!prefersReducedMotion()) {
        for (const { slot, from: was } of slots) {
          const rest = getComputedStyle(slot).transform;
          if (was === rest) continue;
          slot.animate([{ transform: was }, { transform: rest }], {
            duration: SPRING.duration,
            easing: SPRING.easing,
          });
        }
      }
      const to = `translateX(${-pos * 100}%)`;
      el.style.transform = to;
      if (!prefersReducedMotion()) {
        el.animate([{ transform: from }, { transform: to }], { duration: SPRING.duration, easing: SPRING.easing });
      }
    }
    if (scrimRef.current) scrimRef.current.style.opacity = "0";
    setPeek(false);
  }

  // Tap the bar (or Escape, or Back) while the switcher is showing: dismiss it
  // without opening anything, the same spring-back path an abandoned drag
  // takes, just starting from a full lift instead of a partial one.
  function closeSwitcherToHome() {
    cancelAnimationFrame(raf.current);
    cancelAnimationFrame(scrollRaf.current);
    setSwitcher(false);
    springLift(1, 0);
  }

  // --------------------------------------------------- scrolling the settled deck
  // A fractional card position, resisted once it runs past either end of the
  // deck so the row rubber-bands instead of dragging a blank screen into view.
  function resistIndex(idx: number): number {
    const last = deck.order.length - 1;
    if (idx < 0) return idx * EDGE_RESIST;
    if (idx > last) return last + (idx - last) * EDGE_RESIST;
    return idx;
  }

  // Where a scroll of `dx` px, started with card `base` focused, has got to —
  // in cards, fractional, resisted past either end of the deck.
  function scrolledTo(dx: number, base: number): number {
    return resistIndex(base - dx / cardStep());
  }

  // Land the deck on one card and make it the focus. Walked by hand from
  // whatever fractional position is on screen right now, because a settle moves
  // the per-card offsets as well as the row — one painter has to drive both.
  function settleFocus(target: number) {
    const t = Math.max(0, Math.min(deck.order.length - 1, target));
    lastIndex.current = t;
    cancelAnimationFrame(scrollRaf.current);
    const from = liveIndex.current;
    if (prefersReducedMotion() || from === t) return paintLift(1, 0, t);
    const t0 = performance.now();
    const step = (now: number) => {
      const k = Math.min(1, (now - t0) / SLIDE.duration);
      const e = 1 - Math.pow(1 - k, 3);
      paintLift(1, 0, from + (t - from) * e);
      if (k < 1) scrollRaf.current = requestAnimationFrame(step);
    };
    scrollRaf.current = requestAnimationFrame(step);
  }

  // A finger that lets go while still moving doesn't stop dead: the deck keeps
  // coasting under friction, the way the real switcher does, and only settles on
  // a card once it's crawling — or the moment it runs off either end.
  function releaseScroll(vx: number) {
    const last = deck.order.length - 1;
    if (prefersReducedMotion()) return settleFocus(Math.round(liveIndex.current));
    let v = vx;
    let idx = liveIndex.current;
    let prev = performance.now();
    const step = (now: number) => {
      const dt = Math.min(32, now - prev);
      prev = now;
      // Cards per ms: the glide is measured in the same unit the drag was.
      idx -= (v * dt) / cardStep();
      v *= Math.pow(SCROLL_FRICTION, dt);
      if (Math.abs(v) < SCROLL_STOP || idx < 0 || idx > last) {
        return settleFocus(Math.round(Math.max(0, Math.min(last, idx))));
      }
      paintLift(1, 0, idx);
      scrollRaf.current = requestAnimationFrame(step);
    };
    scrollRaf.current = requestAnimationFrame(step);
  }

  // ------------------------------------------------ throwing a card off the deck
  // A card leaving the deck is the one thing on it that moves on its own, so
  // it's the one thing that doesn't go through paintStack: its travel lives in
  // --card-dy, which the stylesheet composes with the place in the row the
  // stack painter is still responsible for. Nothing else on the deck is touched
  // for the whole throw — the cards behind stay exactly where the finger found
  // them, and the gap only closes once the card is gone.
  function paintCard(slot: HTMLElement, dy: number, h: number, floor = 0) {
    slot.style.setProperty("--card-dy", `${dy}px`);
    slot.style.opacity = `${Math.max(floor, cardTrail(dy, h))}`;
  }

  // Track one card up under the finger. Downward travel is resisted: this
  // gesture only goes one way.
  function dragCardOff(id: string, dy: number) {
    const slot = slotEl(id);
    if (!slot) return;
    const h = refHeight(screenRef.current?.getBoundingClientRect().height ?? 1);
    // Over the rest of the deck for as long as it's in the air: a card being
    // taken off the top shouldn't climb UNDER the one in front of it. The stack
    // painter owns this again the moment the throw is over.
    slot.style.zIndex = String(CARD_Z + 1);
    // Held off the floor while the finger is down, so a long drag that hasn't
    // committed to anything yet doesn't leave the visitor holding an invisible
    // card.
    paintCard(slot, dy > 0 ? dy * 0.3 : dy, h, CARD_TRAIL_FLOOR);
  }

  // Not thrown far enough — the card springs back into the deck, carrying
  // whatever speed the finger let go with. It's a spring rather than a fixed
  // ease so an aborted flick decelerates, turns round and comes back, instead
  // of stopping dead and starting a new animation from rest.
  function returnCard(id: string, vy: number) {
    const slot = slotEl(id);
    if (!slot) return;
    cancelAnimationFrame(cardRaf.current);
    const h = refHeight(screenRef.current?.getBoundingClientRect().height ?? 1);
    const from = Number.parseFloat(slot.style.getPropertyValue("--card-dy")) || 0;
    const land = () => {
      slot.style.removeProperty("--card-dy");
      slot.style.opacity = "";
      slot.style.zIndex = "";
      paintLift(1, 0); // the card's depth is the stack's to write, not the drag's
    };
    if (prefersReducedMotion()) return land();
    springTo(from, vy * 1000, 0, (x) => paintCard(slot, x, h), land, cardRaf);
  }

  // Thrown: the card flies off the top and the app is closed for real — its
  // slot unmounts, which is the one place the deck deliberately throws away an
  // app's scroll position. Ballistic rather than sprung: a card that is leaving
  // has nowhere to settle, so it keeps the speed it was thrown at and gains a
  // little more, which is what makes a hard flick leave hard while a slow drag
  // past the commit distance still goes promptly.
  function closeCard(id: string, vy: number) {
    const slot = slotEl(id);
    const h = screenRef.current?.getBoundingClientRect().height ?? 800;
    const drop = () => {
      const gap = deck.order.indexOf(id);
      const idx = focusIndex();
      // Everything on the far side of the gap closes it, and everything between
      // the gap and the focused card stays put — the focused card included,
      // which shouldn't slide out from under the eye because something else was
      // thrown away. So when the gap is to the LEFT of the focus the focus moves
      // in with the row and the cards left of the gap come toward it; when it's
      // to the right, the focus holds and the cards right of the gap come in.
      // Either way every remaining card starts this settle exactly where the
      // throw left it: recorded here, in places in the row, before React
      // renumbers them.
      const back = gap >= 0 && gap < idx ? 1 : 0;
      const shift = new Map<string, number>();
      deck.order.forEach((other, at) => {
        if (other !== id) shift.set(other, (at > gap ? 1 : 0) - back);
      });
      reflow.current = [...shift.values()].some((v) => v !== 0) ? shift : null;
      lastIndex.current = Math.max(0, idx - back);
      setDeck((d) => ({
        order: d.order.filter((x) => x !== id),
        mounted: d.mounted.filter((x) => x !== id),
      }));
    };
    if (!slot || prefersReducedMotion()) return drop();
    cancelAnimationFrame(cardRaf.current);
    const ref = refHeight(h);
    let x = Number.parseFloat(slot.style.getPropertyValue("--card-dy")) || 0;
    let v = Math.min(-CARD_LAUNCH, vy * 1000);
    let prev = performance.now();
    const step = (now: number) => {
      const dt = Math.min(0.032, (now - prev) / 1000);
      prev = now;
      v -= CARD_ACCEL * dt;
      x += v * dt;
      if (x <= -h) return drop(); // clear of the top; nothing left to draw
      paintCard(slot, x, ref);
      cardRaf.current = requestAnimationFrame(step);
    };
    cardRaf.current = requestAnimationFrame(step);
  }

  // Closing a card shortens the deck, so the rest of the stack has to close the
  // gap it left. Emptying it altogether leaves nothing to look at — iOS drops
  // you back to the home screen.
  //
  // A layout effect, not a passive one: React has just renumbered every slot's
  // place in the row, and a frame painted between that and the first frame of
  // the settle would show every card already sitting in its new place.
  useLayoutEffect(() => {
    if (!switcher) return;
    if (deck.order.length === 0) {
      reflow.current = null;
      return closeSwitcherToHome();
    }
    lastIndex.current = Math.min(lastIndex.current, deck.order.length - 1);
    const shift = reflow.current;
    // Paint first either way: with a settle pending this holds every card where
    // the throw left it, and without one it's the plain repaint a shorter deck
    // needs anyway.
    paintLift(1, 0);
    if (!shift) return;
    if (prefersReducedMotion()) {
      reflow.current = null;
      return paintLift(1, 0);
    }
    // Run in px, so the gap closes with the same physics the cards themselves
    // take, and handed back to paintStack as the fraction of a place each card
    // has left to go. The px are one place in the row, not one screen: that's
    // the distance a card actually covers here, so the spring's landing is
    // scaled to the movement being made.
    const w = cardStep();
    const from = new Map(shift);
    springTo(
      w,
      0,
      0,
      (x) => {
        from.forEach((v, key) => shift.set(key, (v * x) / w));
        paintLift(1, 0);
      },
      () => {
        reflow.current = null;
        paintLift(1, 0);
      },
      reflowRaf,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [switcher, deck.order.length]);

  // Trackpad / mouse-wheel scrolling for the settled switcher. The pointer
  // handlers already cover touch and mouse drags; a two-finger horizontal swipe
  // on a laptop trackpad arrives as `wheel` events instead, so it's wired up
  // here. The listener is attached natively and non-passive because a horizontal
  // wheel would otherwise trigger the browser's Back/Forward swipe, and React's
  // onWheel can't preventDefault. The deck keeps following the wheel the whole
  // time; a short gap with no event counts as the release and settles the row.
  useEffect(() => {
    if (!switcher) return;
    const el = deckRef.current;
    if (!el) return;
    let pos = liveIndex.current;
    let running = false;
    let settle: ReturnType<typeof setTimeout> | null = null;
    const onWheel = (e: WheelEvent) => {
      // Trackpads send the sideways component as deltaX; a plain mouse wheel
      // only has deltaY, and using it to page the deck is a fair fallback since
      // the switcher has nothing else for a wheel to do.
      const move = Math.abs(e.deltaX) >= Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      if (move === 0) return;
      e.preventDefault();
      cancelAnimationFrame(scrollRaf.current);
      cancelAnimationFrame(raf.current);
      finishSettle();
      if (!running) {
        pos = liveIndex.current;
        running = true;
      }
      const last = deck.order.length - 1;
      pos = Math.max(-0.6, Math.min(last + 0.6, pos + move / cardStep()));
      paintLift(1, 0, resistIndex(pos));
      if (settle) clearTimeout(settle);
      settle = setTimeout(() => {
        running = false;
        settleFocus(Math.round(Math.max(0, Math.min(last, pos))));
      }, 110);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      el.removeEventListener("wheel", onWheel);
      if (settle) clearTimeout(settle);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [switcher, deck.order.length]);

  // ------------------------------------ pointer gestures on the settled deck
  // Once the switcher is up, the cards themselves take the gesture: sideways
  // scrolls the whole deck (as far as the finger travels — not one card per
  // swipe), and up throws whichever card it started on off the deck. A gesture
  // that never locks an axis stays a tap, and the slot's onClick reopens it.
  function onDeckDown(e: React.PointerEvent<HTMLElement>) {
    if (!switcher || busy.current) return;
    cancelAnimationFrame(raf.current);
    cancelAnimationFrame(cardRaf.current);
    cancelAnimationFrame(scrollRaf.current); // a finger down stops the glide dead
    finishSettle();
    swiped.current = false;
    swipe.current = {
      id: e.pointerId,
      x0: e.clientX,
      y0: e.clientY,
      x: e.clientX,
      y: e.clientY,
      t: performance.now(),
      vx: 0,
      vy: 0,
      axis: null,
      base: focusIndex(),
      card: (e.target as Element | null)?.closest?.(".ios-deck-slot")?.getAttribute("data-app") ?? null,
    };
  }

  function onDeckMove(e: React.PointerEvent<HTMLElement>) {
    const d = swipe.current;
    if (!d || e.pointerId !== d.id) return;
    const now = performance.now();
    const dt = Math.max(1, now - d.t);
    d.vx = 0.7 * ((e.clientX - d.x) / dt) + 0.3 * d.vx;
    d.vy = 0.7 * ((e.clientY - d.y) / dt) + 0.3 * d.vy;
    d.x = e.clientX;
    d.y = e.clientY;
    d.t = now;

    const dx = e.clientX - d.x0;
    const dy = e.clientY - d.y0;
    if (!d.axis) {
      if (Math.hypot(dx, dy) < AXIS_LOCK) return;
      d.axis = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
      swiped.current = true;
      // Captured only now it's certainly a drag: capturing on pointerdown would
      // retarget the click that a plain tap on a card still needs.
      e.currentTarget.setPointerCapture(e.pointerId);
    }
    if (d.axis === "x") paintLift(1, 0, scrolledTo(dx, d.base));
    else if (d.card) dragCardOff(d.card, dy);
  }

  function onDeckUp(e: React.PointerEvent<HTMLElement>) {
    const d = swipe.current;
    if (!d || e.pointerId !== d.id) return;
    swipe.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    if (!d.axis) return; // a tap — the slot's onClick has it
    if (d.axis === "x") return releaseScroll(d.vx);
    if (!d.card) return;
    const dy = d.y - d.y0;
    const card = refHeight(screenRef.current?.getBoundingClientRect().height ?? 1) * (1 - CARD_SHRINK);
    if (-dy > card * CARD_CLOSE_DISTANCE || d.vy < -CARD_CLOSE_VELOCITY) closeCard(d.card, d.vy);
    else returnCard(d.card, d.vy);
  }

  // ------------------------------------------------------------------ gestures
  // The home bar takes one pointer gesture and resolves it to an axis: sideways
  // moves the deck between apps, up lifts the current app off the screen. Both
  // track the finger, and are abandoned if it doesn't travel far or fast enough.
  // With no app on screen only the sideways half means anything — that's the
  // gesture that brings the last app back.
  function onBarDown(e: React.PointerEvent<HTMLElement>) {
    swiped.current = false;
    clearHoldTimer(); // defensive — a fresh gesture should never inherit one
    cancelAnimationFrame(raf.current); // catch a spring-back still in flight
    cancelAnimationFrame(scrollRaf.current);
    if (busy.current) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = {
      id: e.pointerId,
      x0: e.clientX,
      y0: e.clientY,
      x: e.clientX,
      y: e.clientY,
      t: performance.now(),
      vx: 0,
      vy: 0,
      axis: null,
      natural: null,
      from: deckOffset(),
      lift: 0,
      held: false,
      slowSince: null,
      base: focusIndex(),
    };
  }

  function onBarMove(e: React.PointerEvent<HTMLElement>) {
    const d = drag.current;
    if (!d || e.pointerId !== d.id) return;

    // Velocity is smoothed: one stalled frame right before release would
    // otherwise read as "stopped" and cancel a gesture the user did flick.
    const now = performance.now();
    const dt = Math.max(1, now - d.t);
    d.vx = 0.7 * ((e.clientX - d.x) / dt) + 0.3 * d.vx;
    d.vy = 0.7 * ((e.clientY - d.y) / dt) + 0.3 * d.vy;
    d.x = e.clientX;
    d.y = e.clientY;
    d.t = now;

    const dx = e.clientX - d.x0;
    const dy = e.clientY - d.y0;

    if (!d.axis) {
      if (Math.hypot(dx, dy) < AXIS_LOCK) return;
      d.axis = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
      swiped.current = true;
      if (d.axis === "x") {
        // On the home screen there's nothing to slide between mid-gesture: that
        // swipe simply picks the last app when the finger lifts.
        if (activeId) deckRef.current?.classList.add("is-moving");
      } else {
        if (switcher) return; // already lifted — onBarUp turns this into a dismiss
        const el = activeViewEl();
        const r = (el ?? screenRef.current)?.getBoundingClientRect();
        if (!r) return;
        d.natural = { left: r.left, top: r.top, width: r.width, height: r.height };
        // No app on screen: the lift is coming off the home screen. With apps in
        // the deck it can settle into the switcher (focused on the most recent,
        // like iOS); with an empty deck there's nothing to land on, so onBarUp
        // just springs it back — the frost only tracks the finger and lets go.
        if (!el && deck.order.length > 0) lastIndex.current = deck.order.length - 1;
        deckRef.current?.classList.add("is-moving", "switching");
        setPeek(true); // uncover the home screen the row is lifting away from
      }
    }

    if (d.axis === "x") {
      if (switcher) dragSwitcherPan(dx);
      else dragDeck(dx);
    } else if (!switcher) {
      dragCard(dx, dy);
    }
  }

  // Sideways swipe on the home bar while the App Switcher is showing: the same
  // free scroll the cards themselves take, so the bar can reach the far end of
  // the deck in one drag rather than a card at a time.
  function dragSwitcherPan(dx: number) {
    const d = drag.current;
    if (!d) return;
    paintLift(1, 0, scrolledTo(dx, d.base));
  }

  function dragDeck(dx: number) {
    const el = deckRef.current;
    const d = drag.current;
    if (!el || !d || !activeId) return;
    let off = dx;
    // Nothing sits left of the oldest app or right of the newest, so resist
    // rather than drag a blank screen into view.
    const atOldest = deckIndex === 0;
    const atNewest = deckIndex === deck.order.length - 1;
    if ((off > 0 && atOldest) || (off < 0 && atNewest)) off *= EDGE_RESIST;
    el.style.transform = `translateX(${d.from + off}px)`;
  }

  function dragCard(dx: number, dy: number) {
    const d = drag.current;
    if (!d?.natural || d.held) return;
    // This gesture only goes up; downward travel is heavily resisted.
    const travel = dy > 0 ? dy * 0.25 : dy;
    // Eased, not linear: iOS pulls the row down to card size in the first
    // centimetre of travel and then trails the finger, so the switcher is
    // fully readable long before the gesture reaches its commit distance.
    const ref = refHeight(d.natural.height);
    const raw = Math.max(0, Math.min(1, -travel / (ref * LIFT_FULL)));
    d.lift = 1 - (1 - raw) * (1 - raw);
    paintLift(d.lift, dx * 0.35);

    // Note when the finger settles to a near-stop while lifted — onBarUp reads
    // that dwell to tell an App-Switcher hold from a swipe Home. Cleared the
    // moment it's clearly moving again.
    const armed = -dy > ref * HOLD_LIFT;
    const parked = Math.abs(d.vy) < PARK_V;
    if (armed && parked) {
      if (d.slowSince === null) d.slowSince = performance.now();
    } else {
      d.slowSince = null;
    }

    // A long enough dwell opens the switcher without waiting for release: the
    // row glides up under the still finger. Only where there's somewhere to land
    // — an empty deck off the home screen just springs back (see onBarUp).
    if (armed && parked && deck.order.length > 0) {
      if (holdTimer.current === null) {
        holdTimer.current = setTimeout(() => {
          holdTimer.current = null;
          const live = drag.current;
          if (!live) return;
          // Freeze the drag and glide the rest of the way into the switcher; it
          // stays open for as long as the finger is down and lands as real
          // state once it lifts (onBarUp). It does NOT close the app.
          live.held = true;
          settleToSwitcher(live.lift, (live.x - live.x0) * 0.35);
        }, HOLD_MS);
      }
    } else {
      clearHoldTimer();
    }
  }

  function onBarUp(e: React.PointerEvent<HTMLElement>) {
    const d = drag.current;
    if (!d || e.pointerId !== d.id) return;
    clearHoldTimer();
    drag.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    if (!d.axis) return; // never moved — it was a tap, and onClick has it

    if (d.axis === "x") {
      const dx = d.x - d.x0;
      const w = deckWidth() || 1;
      const commit =
        Math.abs(dx) > AXIS_LOCK &&
        (Math.abs(dx) > w * SWITCH_DISTANCE || Math.abs(d.vx) > SWITCH_VELOCITY);
      // Scrolling the deck while the switcher is open: land on whichever card
      // the finger was heading for, still in the switcher — sideways never
      // opens anything on its own, same as a real iPhone.
      if (switcher) return releaseScroll(d.vx);
      // From the home screen there's only one destination: the last app, coming
      // in from whichever edge the finger swept away from.
      if (!activeId) {
        if (commit) resumeLast(dx > 0 ? -1 : 1);
        return;
      }
      // Dragging right pulls the older app in from the left, and the reverse.
      switchTo(deckIndex + (commit ? (dx > 0 ? -1 : 1) : 0));
      return;
    }

    // A vertical drag on the bar while the switcher is up dismisses it to Home.
    if (switcher) return void closeSwitcherToHome();
    if (!d.natural) return; // the swipe up never found a card to lift
    // The hold already fired mid-drag and glided into the switcher; releasing
    // just confirms it.
    if (d.held) return void enterSwitcher();

    const dy = d.y - d.y0;
    const ref = refHeight(d.natural.height);
    const dxRest = (d.x - d.x0) * 0.35;
    const fromHome = !activeId;
    const canSwitch = deck.order.length > 0;

    // Read the end of the gesture the way a real iPhone does — was the finger
    // still moving up when it let go, or had it stopped? `idle` is ms since the
    // last real movement: a touch sensor can lag pointerup ~50ms behind the last
    // move even on a hard flick, so the flick test tolerates more idle than the
    // dwell test does — a high trailing velocity is itself the proof it flicked.
    const idle = performance.now() - d.t;
    const flickedUp = d.vy < -HOME_FLICK_V && idle < 120;
    const dwelled =
      idle > IDLE_MS || (d.slowSince !== null && performance.now() - d.slowSince > DWELL_MS);

    if (-dy < ref * MIN_LIFT) {
      springLift(d.lift, dxRest); // barely moved — back onto the app (or home)
    } else if (fromHome) {
      // Already Home: a held lift with apps behind it reaches the switcher; a
      // flick, or an empty deck, just drops back.
      if (canSwitch && dwelled) settleToSwitcher(d.lift, dxRest);
      else springLift(d.lift, dxRest);
    } else if (flickedUp || (-dy > ref * PUSH_HOME && !dwelled)) {
      void minimize(); // let go still moving up, or shoved right up → Home
    } else if (dwelled) {
      settleToSwitcher(d.lift, dxRest); // stopped first → stay in the App Switcher
    } else {
      void minimize(); // a bare swipe-up with no hold defaults to Home, like iOS
    }
  }

  // Keyboard equivalent of the sideways swipe, for anyone who reaches the bar by
  // tabbing to it rather than touching it.
  function onBarKey(e: React.KeyboardEvent) {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    const back = e.key === "ArrowLeft";
    if (switcher) settleFocus(focusIndex() + (back ? -1 : 1));
    else if (!activeId) resumeLast(back ? -1 : 1);
    else switchTo(focusIndex() + (back ? -1 : 1));
    e.preventDefault();
  }

  // One owner for Escape: Spotlight first (it's the shallower layer), then the
  // open app. Spotlight deliberately doesn't bind Escape itself.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (spotlight) setSpotlight(false);
      else if (activeId) void minimize();
      else if (switcher) closeSwitcherToHome();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activeId, spotlight, switcher]);

  // Browser Back/Forward. The layer order matches Escape above: Spotlight is
  // shallower than the open app, so Back dismisses it first. Only the app on
  // screen is in the URL — the rest of the row is session state, not a place.
  const route: Route = {
    apps: activeId ? [activeId] : [],
    overlay: spotlight ? "spotlight" : null,
    split: null,
    splitPick: null,
  };
  useRouteSync(route, (r) => {
    setSpotlight(r.overlay === "spotlight");
    const target = r.apps[0] ?? null;
    if (target === activeId) return;
    if (target === null) {
      if (activeId) void minimize();
      else if (switcher) closeSwitcherToHome();
      return;
    }
    const at = deck.order.indexOf(target);
    // Already in the row, and we're in another app: slide rather than zoom.
    if (at >= 0 && activeId) return switchTo(at);
    pendingZoom.current = { from: null }; // no icon to grow from on a history jump
    promote(target);
    setActiveId(target);
  });

  const api: AppApi = {
    ...props,
    // In-app navigation (e.g. a link that opens another app) has no launcher
    // icon to grow from, so fall back to a neutral origin.
    openApp: (id) => open(id, null),
    resetLayout: () => {
      setDeck({ order: [], mounted: [] });
      setActiveId(null);
    },
  };

  const screenClass = [
    "ios-screen",
    activeId && "app-open",
    closing && "closing",
    peek && "peek",
    switcher && "switcher",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="ios-viewport">
      <div className={screenClass} ref={screenRef}>
        <HomeScreen onOpen={open} onSearch={() => setSpotlight(true)} />
        <Spotlight open={spotlight} onLaunch={open} onClose={() => setSpotlight(false)} />

        {/* Frosts everything behind the lifted row — wallpaper, icons, dock —
            the way the App Switcher does. Sits under the deck and over the home
            screen, and is invisible until a lift starts. Once the switcher is
            settled the stylesheet re-enables its pointer events so a tap that
            misses a card lands here (and dismisses) instead of falling through
            to the home screen underneath. */}
        <div
          className="ios-switch-scrim"
          ref={scrimRef}
          aria-hidden="true"
          onClick={switcher ? () => closeSwitcherToHome() : undefined}
        />

        {/* In the switcher the deck takes pointer events (see shell.css) so the
            cards can be scrolled and thrown from anywhere on them. A press that
            misses every card lands on the deck itself and dismisses, which is
            what the scrim underneath would otherwise have caught. */}
        <div
          className={`ios-deck${switcher ? " is-moving switching" : ""}`}
          ref={deckRef}
          onPointerDown={switcher ? onDeckDown : undefined}
          onPointerMove={switcher ? onDeckMove : undefined}
          onPointerUp={switcher ? onDeckUp : undefined}
          onPointerCancel={switcher ? onDeckUp : undefined}
          onClick={
            switcher
              ? (e) => {
                  // A drag captures the pointer, so its click lands here rather
                  // than on the card it started on — that's a finished gesture,
                  // not a tap on empty space.
                  if (swiped.current) return void (swiped.current = false);
                  if (e.target === e.currentTarget) closeSwitcherToHome();
                }
              : undefined
          }
        >
          {deck.mounted.map((id) => {
            const meta = getApp(id);
            const pos = deck.order.indexOf(id);
            if (!meta || pos < 0) return null;
            const isActive = id === activeId;
            return (
              <div
                key={id}
                className={`ios-deck-slot${isActive ? " is-active" : ""}`}
                // Position by place in the row, not by DOM order — see `mounted`
                // above. The stylesheet turns this into a transform, spacing the
                // slots by whatever gap the row currently has.
                style={{ "--pos": String(pos) } as React.CSSProperties}
                // Read back by the stack painter, which runs outside React.
                data-pos={pos}
                data-app={id}
                inert={!isActive && !switcher}
                // In the switcher every card is tappable to reopen it — the app
                // content itself ignores pointer events there (see shell.css),
                // so this is what actually catches the tap.
                role={switcher ? "button" : undefined}
                tabIndex={switcher ? 0 : undefined}
                aria-label={switcher ? `Open ${meta.title}` : undefined}
                // A scroll or a throw ends in a click too; only a gesture that
                // never moved counts as a tap on the card.
                onClick={
                  switcher
                    ? () => {
                        if (swiped.current) return void (swiped.current = false);
                        openFromSwitcher(id);
                      }
                    : undefined
                }
                onKeyDown={
                  switcher
                    ? (e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          openFromSwitcher(id);
                        }
                      }
                    : undefined
                }
              >
                <AppView meta={meta} api={api} onHome={() => void minimize()} />
              </div>
            );
          })}
        </div>

        {/* Spotlight layers OVER everything else, so the bar would be gesturing
            at something the visitor can't see. */}
        {!spotlight && (
          <button
            className="ios-home-indicator"
            aria-label={activeId ? "Home" : switcher ? "Close app switcher" : "Last app"}
            onPointerDown={onBarDown}
            onPointerMove={onBarMove}
            onPointerUp={onBarUp}
            onPointerCancel={onBarUp}
            onKeyDown={onBarKey}
            onClick={() => {
              if (swiped.current) return void (swiped.current = false);
              if (activeId) void minimize();
              else if (switcher) closeSwitcherToHome();
            }}
          >
            <span />
          </button>
        )}
      </div>
    </div>
  );
}
