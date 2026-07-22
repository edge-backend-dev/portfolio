import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { getApp } from "../../../data/apps";
import type { AppApi } from "../../apps/appApi";
import type { OSKind, Theme, WallpaperPref } from "../../../shell/types";
import {
  zoomIn,
  zoomOut,
  iconBox,
  launcherIconBox,
  fallbackBox,
  type Box,
  type ZoomOpts,
} from "../../../shell/originZoom";
import IOSStatusBar from "./IOSStatusBar";
import HomeScreen from "./HomeScreen";
import Spotlight from "./Spotlight";
import AppView from "./AppView";

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

// iOS uses the home-screen → fullscreen-app paradigm. No window manager: one app
// is open at a time and fills the screen.
export default function IOSShell(props: SkinProps) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [closing, setClosing] = useState(false); // app is shrinking back to its icon
  const [spotlight, setSpotlight] = useState(false);
  const meta = openId ? getApp(openId) : undefined;

  const screenRef = useRef<HTMLDivElement>(null);
  const originRef = useRef<Box | null>(null); // where the app should grow from
  const busy = useRef(false); // guards against re-entrant close while animating

  function appViewEl() {
    return screenRef.current?.querySelector<HTMLElement>(".ios-appview") ?? null;
  }

  // The origin is measured HERE, at tap time, rather than in the layout effect
  // below. A Spotlight result unmounts in the same commit that opens the app, so
  // by the time the effect runs the row is detached and measures as a zero rect
  // — the app would fly out of the screen's top-left corner.
  function open(id: string, from: HTMLElement) {
    originRef.current = iconBox(from);
    setOpenId(id);
  }

  // Grow the app out of the tapped icon. Layout effect + fill:"both" pins the
  // collapsed frame before paint, so there's no flash of the full-size view.
  useLayoutEffect(() => {
    if (!openId) return;
    const el = appViewEl();
    const from = originRef.current ?? (el ? fallbackBox(el) : null);
    if (el && from) void zoomIn(el, from, OPEN);
  }, [openId]);

  async function requestClose() {
    if (!openId || busy.current) return;
    const el = appViewEl();
    if (el) {
      busy.current = true;
      setClosing(true); // let the home screen ease back in while the app shrinks
      const to = launcherIconBox(screenRef.current, openId) ?? fallbackBox(el);
      await zoomOut(el, to, CLOSE);
      busy.current = false;
    }
    setClosing(false);
    setOpenId(null);
  }

  // One owner for Escape: Spotlight first (it's the shallower layer), then the
  // open app. Spotlight deliberately doesn't bind Escape itself.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (spotlight) setSpotlight(false);
      else void requestClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openId, spotlight]);

  const api: AppApi = {
    ...props,
    // In-app navigation (e.g. a link that opens another app) has no launcher
    // icon to grow from, so fall back to a neutral origin.
    openApp: (id) => {
      originRef.current = null;
      setOpenId(id);
    },
    resetLayout: () => setOpenId(null),
  };

  return (
    <div className="ios-viewport">
      <div className={`ios-screen${closing ? " closing" : ""}`} ref={screenRef}>
        <IOSStatusBar dark={!meta} />
        <HomeScreen onOpen={open} onSearch={() => setSpotlight(true)} />
        <Spotlight open={spotlight} onLaunch={open} onClose={() => setSpotlight(false)} />
        {meta && <AppView meta={meta} api={api} onHome={() => void requestClose()} />}
      </div>
    </div>
  );
}
