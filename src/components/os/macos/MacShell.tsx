import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useWindowManager, type WorkArea } from "../../../shell/useWindowManager";
import { useRouteSync, parseRoute, resetUrlToHome, type Route } from "../../../shell/history";
import { getApp } from "../../../data/apps";
import type { AppApi } from "../../apps/appApi";
import type { OSKind, Theme, WallpaperPref } from "../../../shell/types";
import DesktopWindow from "../shared/DesktopWindow";
import MenuBar from "./MenuBar";
import Spotlight from "./Spotlight";
import MissionControl from "./MissionControl";
import Dock from "./Dock";
import Wallpaper from "../shared/Wallpaper";
import { useOverviewGesture } from "../../../shell/useOverviewGesture";
import { dockIconCenter, dockFallback, genieMinimize, windowEl } from "../../../shell/genie";

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

const WORK_AREA: WorkArea = { top: 30, bottom: 88 };

/** how close to an edge the pointer must get to summon the hidden chrome */
const EDGE = 12;
/** ...and how far it may stray before the chrome hides again (menu bar + title
    bar at the top, the dock slab at the bottom) */
const KEEP_TOP = WORK_AREA.top + 38;
const KEEP_BOTTOM = WORK_AREA.bottom;

// The opening layout, resolved from the URL before the first paint. A bare "/"
// still lands on About so visitors arrive on content — but seeding it here
// rather than opening it from an effect keeps that default out of the history
// stack, so the first Back from a fresh visit leaves the site as it should.
function initial() {
  if (typeof window === "undefined") return { apps: ["about"], overlay: null as string | null };
  const r = parseRoute(window.location);
  const apps = r.split ? [r.split.top, r.split.bottom] : r.apps;
  return { apps: apps.length ? apps : ["about"], overlay: r.overlay };
}

export default function MacShell(props: SkinProps) {
  const [start] = useState(initial); // lazy: read the URL once, on mount
  const wm = useWindowManager(WORK_AREA, start.apps);
  const [spotlight, setSpotlight] = useState(start.overlay === "spotlight");
  const [overview, setOverview] = useState(start.overlay === "overview");
  const [chromeRevealed, setChromeRevealed] = useState(false);
  // read by the keydown handler, which must not re-bind on every window change
  const fsRef = useRef<string | null>(null);

  // Swipe up for Mission Control, down to leave it.
  useOverviewGesture((dir) => {
    setSpotlight(false);
    setOverview(dir === "up");
  });

  // ⌘K is the primary binding: real Spotlight is ⌘Space, but macOS itself
  // swallows that before the browser ever sees it. ⌘Space is still handled for
  // anyone viewing the Mac skin on non-Apple hardware, where it does arrive.
  // ⌃↑ is the real Mission Control shortcut and, unlike the 3-finger swipe it
  // shadows, it does reach the browser — so it stands in as the gesture's
  // keyboard equivalent.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && (e.key === "k" || e.key === "K" || e.code === "Space")) {
        e.preventDefault();
        setOverview(false);
        setSpotlight((s) => !s);
      } else if (e.ctrlKey && e.key === "ArrowUp") {
        e.preventDefault();
        setSpotlight(false);
        setOverview((o) => !o);
      } else if (e.key === "Escape") {
        // Overview first, then full screen. Real macOS binds ⌃⌘F, but plenty of
        // its apps leave on Escape too — and it's the one exit a visitor who
        // hasn't found the edge reveal will try by reflex.
        if (overview) setOverview(false);
        else if (fsRef.current) wm.toggleFullscreen(fsRef.current);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [overview, wm]);

  const focusedId = useMemo(() => {
    const visible = wm.windows.filter((w) => !w.minimized);
    if (visible.length === 0) return null;
    return visible.reduce((a, b) => (a.z > b.z ? a : b)).id;
  }, [wm.windows]);

  const fullscreenId = useMemo(
    () => wm.windows.find((w) => w.fullscreen && !w.minimized)?.id ?? null,
    [wm.windows],
  );
  fsRef.current = fullscreenId;

  // Browser Back/Forward. On a desktop there is no "previous screen" to pop —
  // every window is on display at once — so opening or focusing a window is not
  // a navigation and gets no history entry. It only keeps the URL pointing at
  // the front-most app, via replaceState, so a link to /projects stays short and
  // shareable instead of accumulating into /about+resume+projects+...
  //
  // The overlays ARE navigations: each covers the whole screen, so Back
  // dismissing one is a visible step rather than an abrupt exit. Once they're
  // closed, Back leaves the site, which on a desktop is what it should mean.
  const route: Route = {
    apps: focusedId ? [focusedId] : [],
    overlay: spotlight ? "spotlight" : overview ? "overview" : null,
    split: null,
    splitPick: null,
  };
  const applyRoute = useCallback((r: Route) => {
    setSpotlight(r.overlay === "spotlight");
    setOverview(r.overlay === "overview");
    // r.apps is deliberately ignored: windows aren't history state, so Back must
    // never open or close one.
  }, []);
  useRouteSync(route, applyRoute, {
    push: (prev, next) => prev.overlay !== next.overlay,
    unwind: (prev, next) => !!prev.overlay && !next.overlay,
  });

  // Mission Control needs the menu bar and dock on show — its overlay reserves
  // padding for them and deliberately sits a layer BELOW them — so full screen's
  // hide is suspended for as long as the overview is open.
  const hideChrome = !!fullscreenId && !overview;

  // Reveal by pushing the pointer to an edge, hide once it wanders back into the
  // window. One pointermove beats mounting hit-strips over the full-screen app:
  // nothing to fight for z-index or swallow the app's own clicks. Same-value
  // setState bails out of re-render, so the common case costs one comparison.
  useEffect(() => {
    if (!hideChrome) {
      setChromeRevealed(false);
      return;
    }
    const onMove = (e: PointerEvent) => {
      const y = e.clientY;
      const h = window.innerHeight;
      setChromeRevealed((cur) => {
        if (y <= EDGE || y >= h - EDGE) return true;
        // already open? keep it open while the pointer is still over the chrome
        return cur && (y <= KEEP_TOP || y >= h - KEEP_BOTTOM);
      });
    };
    // A real Mac has a screen edge to shove the pointer against; a viewport has
    // nothing to stop it. A quick flick can clear the trigger band between two
    // samples (~25px apart on a fast sweep) and leave the window entirely, so
    // the move handler never sees it. Catch the exit and count it as a hit.
    const onLeave = (e: MouseEvent) => {
      if (e.clientY <= EDGE || e.clientY >= window.innerHeight - EDGE) setChromeRevealed(true);
    };
    window.addEventListener("pointermove", onMove);
    document.addEventListener("mouseleave", onLeave);
    return () => {
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("mouseleave", onLeave);
    };
  }, [hideChrome]);


  const activeTitle = focusedId ? getApp(focusedId)?.title ?? "" : "";

  const api: AppApi = {
    ...props,
    openApp: wm.openApp,
    resetLayout: () => {
      wm.windows.forEach((w) => wm.resetGeom(w.id));
      // Drop the layout from the URL first — the reload rehydrates from it, and
      // would otherwise restore the very layout being reset.
      resetUrlToHome();
      window.location.reload();
    },
  };

  async function launch(id: string) {
    const existing = wm.windows.find((w) => w.id === id);
    // A full-screen app can't be minimized (its yellow light is disabled), so
    // its dock icon just focuses it — matching the real thing, where clicking
    // it switches to that app's Space rather than putting it away.
    if (existing && !existing.minimized && !existing.fullscreen && focusedId === id) {
      // Clicking the dock icon of the focused app minimizes it — with the genie.
      const el = windowEl(id);
      if (el) await genieMinimize(el, dockIconCenter(id) ?? dockFallback());
      wm.minimizeApp(id);
    } else {
      wm.openApp(id);
    }
  }

  return (
    <div
      className="mac-desktop"
      data-fullscreen={hideChrome || undefined}
      data-chrome-revealed={chromeRevealed || undefined}
    >
      <Wallpaper pref={props.wallpaper} theme={props.theme} />
      <MenuBar activeTitle={activeTitle} onSpotlight={() => setSpotlight((s) => !s)} />

      {wm.windows.map((w) => {
        const meta = getApp(w.id);
        if (!meta) return null;
        return (
          <DesktopWindow
            key={w.id}
            win={w}
            meta={meta}
            wm={wm}
            api={api}
            area={WORK_AREA}
            focused={focusedId === w.id}
            variant="macos"
          />
        );
      })}

      <MissionControl
        open={overview}
        windows={wm.windows}
        api={api}
        onOpen={(id) => {
          wm.openApp(id);
          setOverview(false);
        }}
        onClose={wm.closeApp}
        onDismiss={() => setOverview(false)}
      />

      <Spotlight open={spotlight} onLaunch={wm.openApp} onClose={() => setSpotlight(false)} />

      <Dock
        windows={wm.windows}
        onLaunch={(id) => {
          setOverview(false);
          launch(id);
        }}
        onMissionControl={() => setOverview((o) => !o)}
      />
    </div>
  );
}
