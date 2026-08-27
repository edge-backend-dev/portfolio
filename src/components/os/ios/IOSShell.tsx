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
const HOME_DISTANCE = 0.11;
const HOME_VELOCITY = 0.28;
// Those two fractions are of the card HEIGHT, and that is where they went
// wrong: a desktop window is half again as tall as a phone, so the same 11%
// became a drag nobody would make with a mouse. Everything vertical is
// measured against a phone-sized height instead, capped here — the gesture
// then costs the same travel whatever the window is. (The sideways swipe
// never had the problem: it is measured against the width, and .ios-screen
// is already capped at 430px.)
const REF_HEIGHT = 760;
// Real iOS also commits on a plain swipe-up-and-HOLD, well short of
// HOME_DISTANCE and with no velocity at all — the pause itself is the signal.
// Cross a much smaller lift, then stop moving for HOLD_MS, and it minimizes
// exactly as if you'd released past the distance/velocity thresholds above.
const HOLD_LIFT = 0.04;
const HOLD_MS = 420;
const EDGE_RESIST = 0.3; // drag past the last app and it barely moves

// ---- how the row looks once it's lifted off the screen (the App Switcher) ----
// Swiping up doesn't shrink the current app on its own: it shrinks the WHOLE
// row, so the apps either side of it come into view as cards, spaced and
// rounded, over a blurred home screen. `lift` below runs 0 → 1 with the finger.
const CARD_SHRINK = 0.3; // how far the row scales down at a full lift
const CARD_GAP = 14; // on-screen px between neighbouring cards
const CARD_RADIUS = 38; // on-screen corner radius of a lifted card
const LIFT_FULL = 0.22; // travel, as a fraction of card height, that reads as a full lift
const LIFT_RISE = 0.05; // how far the row itself drifts up at a full lift

function refHeight(h: number): number {
  return Math.min(h, REF_HEIGHT);
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
    },
    [],
  );

  const index = activeId ? deck.order.indexOf(activeId) : -1;
  // Where the deck sits while nothing is active: on the app we just left, so a
  // minimise animation plays in place instead of jumping to the row's start.
  const lastIndex = useRef(0);
  const deckIndex = index >= 0 ? index : lastIndex.current;

  // ------------------------------------------------------------------ elements
  function activeViewEl(): HTMLElement | null {
    return deckRef.current?.querySelector<HTMLElement>(".ios-deck-slot.is-active .ios-appview") ?? null;
  }
  function deckWidth(): number {
    return deckRef.current?.getBoundingClientRect().width ?? 0;
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
  // The row scales as ONE layer about the screen's centre, which is what brings
  // the neighbours in from the sides on their own. The gap and the corner are
  // authored in on-screen px and divided by that scale, so they stay the size
  // they were asked for however far the row has shrunk.
  function paintLift(lift: number, dx: number) {
    const el = deckRef.current;
    if (!el) return;
    const w = deckWidth() || 1;
    const h = refHeight(screenRef.current?.getBoundingClientRect().height ?? 1);
    const s = 1 - CARD_SHRINK * lift;
    const gap = (CARD_GAP * lift) / s;
    const x = -s * deckIndex * (w + gap) + dx;
    const y = -h * LIFT_RISE * lift;
    el.style.setProperty("--deck-gap", `${gap}px`);
    el.style.setProperty("--card-radius", `${(CARD_RADIUS * lift) / s}px`);
    el.style.transform = `translate(${x}px, ${y}px) scale(${s})`;
    if (scrimRef.current) scrimRef.current.style.opacity = `${lift}`;
  }

  // Put the row back the way the rest of the shell expects to find it.
  // `keepCard` leaves the corner radius alone: a card that's committing to home
  // is about to shrink into its icon, and squaring it off mid-flight would show.
  function endLift(keepCard = false) {
    const el = deckRef.current;
    if (el) {
      el.classList.remove("is-moving");
      el.style.transform = `translateX(${-deckIndex * 100}%)`;
      el.style.setProperty("--deck-gap", "0px");
      if (!keepCard) {
        el.classList.remove("switching");
        el.style.removeProperty("--deck-gap");
        el.style.removeProperty("--card-radius");
      }
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
        const el = activeViewEl();
        if (!el) return; // home screen: a swipe up has nothing to lift
        const r = el.getBoundingClientRect();
        d.natural = { left: r.left, top: r.top, width: r.width, height: r.height };
        // Every card in the row has to be paintable now — they are what this
        // gesture uncovers.
        deckRef.current?.classList.add("is-moving", "switching");
        setPeek(true); // uncover the home screen the row is lifting away from
      }
    }

    if (d.axis === "x") dragDeck(dx);
    else dragCard(dx, dy);
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
    if (!d?.natural) return;
    // This gesture only goes up; downward travel is heavily resisted.
    const travel = dy > 0 ? dy * 0.25 : dy;
    // Eased, not linear: iOS pulls the row down to card size in the first
    // centimetre of travel and then trails the finger, so the switcher is
    // fully readable long before the gesture reaches its commit distance.
    const ref = refHeight(d.natural.height);
    const raw = Math.max(0, Math.min(1, -travel / (ref * LIFT_FULL)));
    d.lift = 1 - (1 - raw) * (1 - raw);
    paintLift(d.lift, dx * 0.35);

    // Past the (small) arm distance, treat a pause as "hold to minimize": reset
    // a timer on every move, so it only actually fires once the finger stops.
    // Below the arm distance — dragged back down again — drop it, matching a
    // real device where easing off cancels the hold.
    if (-dy > ref * HOLD_LIFT) {
      clearHoldTimer();
      holdTimer.current = setTimeout(() => {
        holdTimer.current = null;
        // Resolve the gesture right here, the same way a real release does — so
        // if the finger lifts a moment later, onBarUp finds drag.current already
        // cleared and does nothing, instead of re-finishing a drag that is
        // already mid-animation.
        drag.current = null;
        void minimize();
      }, HOLD_MS);
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

    if (!d.natural) return; // the swipe up never found a card to lift
    const dy = d.y - d.y0;
    if (-dy > refHeight(d.natural.height) * HOME_DISTANCE || d.vy < -HOME_VELOCITY) void minimize();
    else springLift(d.lift, (d.x - d.x0) * 0.35);
  }

  // Keyboard equivalent of the sideways swipe, for anyone who reaches the bar by
  // tabbing to it rather than touching it.
  function onBarKey(e: React.KeyboardEvent) {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    const back = e.key === "ArrowLeft";
    if (!activeId) resumeLast(back ? -1 : 1);
    else switchTo(deckIndex + (back ? -1 : 1));
    e.preventDefault();
  }

  // One owner for Escape: Spotlight first (it's the shallower layer), then the
  // open app. Spotlight deliberately doesn't bind Escape itself.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (spotlight) setSpotlight(false);
      else void minimize();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activeId, spotlight]);

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
    if (target === null) return void minimize();
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

  const screenClass = ["ios-screen", activeId && "app-open", closing && "closing", peek && "peek"]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="ios-viewport">
      <div className={screenClass} ref={screenRef}>
        <HomeScreen onOpen={open} onSearch={() => setSpotlight(true)} />
        <Spotlight open={spotlight} onLaunch={open} onClose={() => setSpotlight(false)} />

        {/* Frosts everything behind the lifted row — wallpaper, icons, dock —
            the way the App Switcher does. Sits under the deck and over the home
            screen, and is invisible until a lift starts. */}
        <div className="ios-switch-scrim" ref={scrimRef} aria-hidden="true" />

        <div className="ios-deck" ref={deckRef}>
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
                inert={!isActive}
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
            aria-label={activeId ? "Home" : "Last app"}
            onPointerDown={onBarDown}
            onPointerMove={onBarMove}
            onPointerUp={onBarUp}
            onPointerCancel={onBarUp}
            onKeyDown={onBarKey}
            onClick={() => {
              if (swiped.current) return void (swiped.current = false);
              if (activeId) void minimize();
            }}
          >
            <span />
          </button>
        )}
      </div>
    </div>
  );
}
