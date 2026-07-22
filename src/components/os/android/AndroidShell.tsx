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
import AndroidStatusBar from "./AndroidStatusBar";
import AndroidHome from "./AndroidHome";
import AndroidAppView from "./AndroidAppView";
import AndroidRecents from "./AndroidRecents";
import AndroidSplit from "./AndroidSplit";
import AndroidSearch from "./AndroidSearch";
import NavBar from "./NavBar";

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

export type SplitPair = { top: string; bottom: string };

// One UI "container transform": the app expands from the icon on Material's
// emphasised-decelerate curve, and accelerates back into it on close.
const OPEN: ZoomOpts = { duration: 320, easing: "cubic-bezier(0.05, 0.7, 0.1, 1)" };
const CLOSE: ZoomOpts = { duration: 260, easing: "cubic-bezier(0.3, 0, 0.8, 0.15)" };
const RECENTS_MAX = 8;

// Android One UI: home-screen → fullscreen-app paradigm, plus the three system
// destinations the nav bar reaches — the Recents overview, split-screen, and a
// full-screen search — all layered over the same launcher.
export default function AndroidShell(props: SkinProps) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [closing, setClosing] = useState(false);
  const [recents, setRecents] = useState<string[]>([]);
  const [overview, setOverview] = useState(false);
  const [searching, setSearching] = useState(false);
  const [split, setSplit] = useState<SplitPair | null>(null);
  const [splitPick, setSplitPick] = useState<string | null>(null);

  const meta = openId ? getApp(openId) : undefined;
  const stageRef = useRef<HTMLDivElement>(null);
  const originBox = useRef<Box | null>(null);
  const busy = useRef(false);

  const mode = searching
    ? "search"
    : overview
      ? "overview"
      : split
        ? "split"
        : meta
          ? "app"
          : "home";
  const overWallpaper = mode === "home" || mode === "overview" || mode === "search";

  function pushRecent(id: string) {
    setRecents((r) => [id, ...r.filter((x) => x !== id)].slice(0, RECENTS_MAX));
  }

  function appViewEl() {
    return stageRef.current?.querySelector<HTMLElement>(".and-appview") ?? null;
  }

  // Capture the tapped icon's box NOW — the search / recents overlay it lives in
  // is about to unmount, so we can't measure the element later.
  function open(id: string, from: HTMLElement | null) {
    originBox.current = from ? iconBox(from) : null;
    setSearching(false);
    setOverview(false);
    setSplit(null);
    setSplitPick(null);
    pushRecent(id);
    setOpenId(id);
  }

  useLayoutEffect(() => {
    if (!openId || split) return;
    const el = appViewEl();
    const from = originBox.current ?? (el ? fallbackBox(el) : null);
    if (el && from) void zoomIn(el, from, OPEN);
  }, [openId, split]);

  async function requestClose() {
    if (!openId || busy.current) return;
    const el = appViewEl();
    if (el) {
      busy.current = true;
      setClosing(true);
      const to = launcherIconBox(stageRef.current, openId) ?? fallbackBox(el);
      await zoomOut(el, to, CLOSE);
      busy.current = false;
    }
    setClosing(false);
    setOpenId(null);
  }

  // Nav bar — Home always returns to the launcher, unwinding whatever's open.
  function goHome() {
    setSearching(false);
    setOverview(false);
    setSplitPick(null);
    if (split) {
      setSplit(null);
      return;
    }
    if (openId) void requestClose();
  }

  // Recents opens the overview of everything you've opened this session.
  function goRecents() {
    setSearching(false);
    setSplitPick(null);
    if (split) setSplit(null);
    setOverview(true);
  }

  // Back pops one layer at a time.
  function goBack() {
    if (searching) return setSearching(false);
    if (splitPick) return setSplitPick(null);
    if (overview) return setOverview(false);
    if (split) return setSplit(null);
    if (openId) void requestClose();
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && goBack();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // Split-screen: pick a top app from Recents, then a bottom one.
  function startSplit(id: string) {
    setSplitPick(id);
  }
  function pickSplitBottom(id: string) {
    if (!splitPick || id === splitPick) return;
    pushRecent(id);
    setOpenId(null);
    setOverview(false);
    setSplit({ top: splitPick, bottom: id });
    setSplitPick(null);
  }
  function expandFromSplit(id: string) {
    setSplit(null);
    open(id, null);
  }

  const api: AppApi = {
    ...props,
    openApp: (id) => open(id, null),
    resetLayout: () => {
      setOpenId(null);
      setSplit(null);
      setOverview(false);
      setSearching(false);
    },
  };

  const canBack = searching || !!splitPick || overview || !!split || !!openId;

  return (
    <div className="and-viewport">
      <div className={`and-screen mode-${mode}`}>
        <AndroidStatusBar dark={overWallpaper} />
        <div className={`and-stage${closing ? " closing" : ""}`} ref={stageRef}>
          <AndroidHome onOpen={open} onSearch={() => setSearching(true)} />
          {meta && !split && <AndroidAppView meta={meta} api={api} onHome={() => void requestClose()} />}
          {split && <AndroidSplit split={split} api={api} onExpand={expandFromSplit} />}
          {overview && (
            <AndroidRecents
              recents={recents}
              splitPick={splitPick}
              api={api}
              onOpen={open}
              onStartSplit={startSplit}
              onPickBottom={pickSplitBottom}
              onCloseAll={() => {
                setRecents([]);
                setSplitPick(null);
                setOverview(false);
                setSplit(null);
                setOpenId(null);
              }}
            />
          )}
          {searching && <AndroidSearch onOpen={open} onClose={() => setSearching(false)} />}
        </div>
        <NavBar canBack={canBack} onBack={goBack} onHome={goHome} onRecents={goRecents} />
      </div>
    </div>
  );
}
