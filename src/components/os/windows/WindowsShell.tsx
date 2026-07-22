import { useEffect, useMemo, useRef, useState } from "react";
import { useWindowManager, type WorkArea } from "../../../shell/useWindowManager";
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

export default function WindowsShell(props: SkinProps) {
  const wm = useWindowManager(WORK_AREA);
  const [startOpen, setStartOpen] = useState(false);
  const [taskView, setTaskView] = useState(false);

  // Swipe up for Task view, down to leave it.
  useOverviewGesture((dir) => {
    setStartOpen(false);
    setTaskView(dir === "up");
  });

  // Open the About window once on first load so visitors land on content.
  const opened = useRef(false);
  useEffect(() => {
    if (!opened.current) {
      opened.current = true;
      wm.openApp("about");
    }
  }, [wm]);

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

  const api: AppApi = {
    ...props,
    openApp: wm.openApp,
    resetLayout: () => {
      wm.windows.forEach((w) => wm.resetGeom(w.id));
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
