import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useWindowManager, type WorkArea } from "../../../shell/useWindowManager";
import { useRouteSync, parseRoute, resetUrlToHome, type Route } from "../../../shell/history";
import { apps, getApp } from "../../../data/apps";
import type { AppApi } from "../../apps/appApi";
import type { OSKind, Theme, WallpaperPref } from "../../../shell/types";
import DesktopWindow from "../shared/DesktopWindow";
import Taskbar from "./Taskbar";
import StartMenu from "./StartMenu";
import Wallpaper from "../shared/Wallpaper";
import { useOverviewGesture } from "../../../shell/useOverviewGesture";
import { AppIcon } from "../../apps/AppIcon";
import { AppContent } from "../../apps/AppRouter";

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

const WORK_AREA: WorkArea = { top: 0, bottom: 48 };

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

export default function WindowsShell(props: SkinProps) {
  const [start] = useState(initial); // lazy: read the URL once, on mount
  const wm = useWindowManager(WORK_AREA, start.apps);
  const [startOpen, setStartOpen] = useState(start.overlay === "start");
  const [taskView, setTaskView] = useState(start.overlay === "overview");

  // Swipe up for Task view, down to leave it.
  useOverviewGesture((dir) => {
    setStartOpen(false);
    setTaskView(dir === "up");
  });

  // Escape closes the Start menu / Task view.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setStartOpen(false);
        setTaskView(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const focusedId = useMemo(() => {
    const visible = wm.windows.filter((w) => !w.minimized);
    if (visible.length === 0) return null;
    return visible.reduce((a, b) => (a.z > b.z ? a : b)).id;
  }, [wm.windows]);

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
    overlay: startOpen ? "start" : taskView ? "overview" : null,
    split: null,
    splitPick: null,
  };
  const applyRoute = useCallback((r: Route) => {
    setStartOpen(r.overlay === "start");
    setTaskView(r.overlay === "overview");
    // r.apps is deliberately ignored: windows aren't history state, so Back must
    // never open or close one.
  }, []);
  useRouteSync(route, applyRoute, {
    push: (prev, next) => prev.overlay !== next.overlay,
    unwind: (prev, next) => !!prev.overlay && !next.overlay,
  });

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

  function launch(id: string) {
    const existing = wm.windows.find((w) => w.id === id);
    // taskbar toggle: if focused & open, minimize; otherwise open/raise
    if (existing && !existing.minimized && focusedId === id) {
      wm.minimizeApp(id);
    } else {
      wm.openApp(id);
    }
  }

  return (
    <div className="win-desktop">
      <Wallpaper pref={props.wallpaper} theme={props.theme} />

      {/* desktop app shortcuts */}
      <div className="win-shortcuts">
        {apps
          .filter((a) => a.category === "primary")
          .map((a) => (
            <button key={a.id} className="win-shortcut" onDoubleClick={() => wm.openApp(a.id)} onClick={() => wm.openApp(a.id)}>
              <AppIcon id={a.id} size={40} radius={0.18} className="win-shortcut-icon" />
              <span className="win-shortcut-label">{a.title}</span>
            </button>
          ))}
      </div>

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
            variant="windows"
          />
        );
      })}

      {taskView && (
        <div className="tv-overlay" onClick={() => setTaskView(false)}>
          <div className="tv-grid" onClick={(e) => e.stopPropagation()}>
            {wm.windows.length === 0 && <div className="tv-empty">No open windows</div>}
            {wm.windows.map((w) => {
              const meta = getApp(w.id);
              if (!meta) return null;
              return (
                <div key={w.id} className="tv-card" data-minimized={w.minimized || undefined}>
                  <div className="tv-caption">
                    <AppIcon id={w.id} size={16} radius={0.18} />
                    <span className="tv-caption-title">{meta.title}</span>
                  </div>
                  <button
                    className="tv-thumb"
                    aria-label={`Open ${meta.title}`}
                    onClick={() => {
                      wm.openApp(w.id);
                      setTaskView(false);
                    }}
                  >
                    <div className="tv-thumb-frame" aria-hidden="true">
                      <AppContent id={w.id} api={api} />
                    </div>
                  </button>
                  {/* the point of arriving here by swipe is usually to find a
                      window that isn't on screen — so mark which those are.
                      Sits outside the thumb so the dim doesn't fade the very
                      label that explains it. */}
                  {w.minimized && <span className="tv-badge">Minimized</span>}
                  <button className="tv-close" aria-label={`Close ${meta.title}`} onClick={() => wm.closeApp(w.id)}>
                    <svg width="9" height="9" viewBox="0 0 10 10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round">
                      <line x1="1.4" y1="1.4" x2="8.6" y2="8.6" />
                      <line x1="8.6" y1="1.4" x2="1.4" y2="8.6" />
                    </svg>
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <StartMenu open={startOpen} onLaunch={wm.openApp} onClose={() => setStartOpen(false)} />

      <Taskbar
        windows={wm.windows}
        startOpen={startOpen}
        onStart={() => {
          setTaskView(false);
          setStartOpen((s) => !s);
        }}
        onSearch={() => {
          setTaskView(false);
          setStartOpen(true);
        }}
        onTaskView={() => {
          setStartOpen(false);
          setTaskView((t) => !t);
        }}
        onShowDesktop={() => {
          wm.windows.forEach((w) => !w.minimized && wm.minimizeApp(w.id));
        }}
        onLaunch={launch}
        onOpen={wm.openApp}
        onClose={wm.closeApp}
        focusedId={focusedId}
        api={api}
      />
    </div>
  );
}
