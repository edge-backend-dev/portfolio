import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { WinState } from "../../../shell/types";
import type { WindowManager, WorkArea } from "../../../shell/useWindowManager";
import type { AppMeta } from "../../../data/types";
import type { AppApi } from "../../apps/appApi";
import { AppContent } from "../../apps/AppRouter";
import { AppIcon } from "../../apps/AppIcon";
import { startGesture } from "../../../shell/gestures";
import { SNAP_LAYOUTS } from "../../../shell/snapLayouts";
import {
  dockIconCenter,
  dockFallback,
  genieMinimize,
  genieRestore,
  genieClose,
} from "../../../shell/genie";

export type WindowVariant = "windows" | "macos";

interface Props {
  win: WinState;
  meta: AppMeta;
  wm: WindowManager;
  api: AppApi;
  area: WorkArea;
  focused: boolean;
  variant: WindowVariant;
}

// One draggable/resizable desktop window used by BOTH the Windows and macOS
// skins. The engine (drag, corner-resize, maximize, focus) is identical; only
// the title-bar chrome differs, chosen by `variant`.
export default function DesktopWindow({ win, meta, wm, api, area, focused, variant }: Props) {
  const startRef = useRef({ x: 0, y: 0, w: 0, h: 0 });
  const rootRef = useRef<HTMLElement>(null);
  const isMac = variant === "macos";

  // ---- macOS genie effect ----------------------------------------------------
  // OPENING / RESTORING is state-driven: whenever this window becomes visible
  // (fresh mount, or un-minimized from the dock) it springs out of its dock icon.
  // A layout effect runs before paint so the collapsed first frame is pinned
  // with no flash of the full window. MINIMIZE/CLOSE are imperative (below).
  const firstMount = useRef(true);
  const prevMinimized = useRef(win.minimized);
  useLayoutEffect(() => {
    if (!isMac) return;
    const el = rootRef.current;
    const appeared = firstMount.current || (prevMinimized.current && !win.minimized);
    firstMount.current = false;
    prevMinimized.current = win.minimized;
    // A full-screen window never genies: on a real Mac it lives in its own
    // Space rather than flying out of the dock — and the dock is hidden while
    // it's up, so there'd be no icon to fly from anyway.
    if (el && appeared && !win.minimized && !win.fullscreen) {
      genieRestore(el, dockIconCenter(win.id) ?? dockFallback());
    }
  }, [isMac, win.id, win.minimized, win.fullscreen]);

  async function handleMinimize() {
    const el = rootRef.current;
    if (isMac && el) await genieMinimize(el, dockIconCenter(win.id) ?? dockFallback());
    wm.minimizeApp(win.id);
  }

  async function handleClose() {
    const el = rootRef.current;
    // same reason as above: nothing to pour into while the dock is hidden
    if (isMac && el && !win.fullscreen) await genieClose(el, dockIconCenter(win.id) ?? dockFallback());
    wm.closeApp(win.id);
  }

  // Win11 snap-layouts flyout, shown after hovering the maximize button
  // (mirrors the real OS: ~400ms open delay, short grace period on leave).
  const [snapOpen, setSnapOpen] = useState(false);
  const snapTimers = useRef<{ open?: number; close?: number }>({});
  useEffect(() => {
    const t = snapTimers.current;
    return () => {
      window.clearTimeout(t.open);
      window.clearTimeout(t.close);
    };
  }, []);

  const maximized = win.maximized;

  // A minimized window stays MOUNTED (just hidden) so its app keeps its state —
  // terminal history, half-typed form fields, scroll position — and resumes
  // exactly where it left off when restored, like a real OS. Inline display:none
  // wins over the stylesheet and drops it out of the tab order.
  // Full screen owns the whole display — no menu-bar strip, no dock gap. Zoom
  // (Windows maximize / macOS green-button-of-old) fills only the work area.
  const style: React.CSSProperties = win.minimized
    ? { display: "none" }
    : win.fullscreen
      ? { left: 0, top: 0, width: "100%", height: "100%", zIndex: win.z }
      : maximized
        ? {
            left: 0,
            top: area.top,
            width: "100%",
            height: `calc(100% - ${area.top + area.bottom}px)`,
            zIndex: win.z,
          }
        : { left: win.x, top: win.y, width: win.w, height: win.h, zIndex: win.z };

  function onTitlePointerDown(e: React.PointerEvent) {
    if (maximized || win.fullscreen) return;
    wm.focusApp(win.id);
    startRef.current = { x: win.x, y: win.y, w: win.w, h: win.h };
    startGesture(
      e,
      (dx, dy) => wm.setGeom(win.id, { x: startRef.current.x + dx, y: startRef.current.y + dy }),
      () => wm.commitGeom(win.id),
    );
  }

  function onResizePointerDown(e: React.PointerEvent) {
    e.stopPropagation();
    wm.focusApp(win.id);
    startRef.current = { x: win.x, y: win.y, w: win.w, h: win.h };
    document.body.style.cursor = "nwse-resize";
    startGesture(
      e,
      (dx, dy) => wm.setGeom(win.id, { w: startRef.current.w + dx, h: startRef.current.h + dy }),
      () => wm.commitGeom(win.id),
    );
  }

  const stop = (e: React.PointerEvent) => e.stopPropagation();

  function snapEnter() {
    window.clearTimeout(snapTimers.current.close);
    snapTimers.current.open = window.setTimeout(() => setSnapOpen(true), 400);
  }
  function snapLeave() {
    window.clearTimeout(snapTimers.current.open);
    snapTimers.current.close = window.setTimeout(() => setSnapOpen(false), 180);
  }
  function pickZone(layout: (typeof SNAP_LAYOUTS)[number], zoneIndex: number) {
    window.clearTimeout(snapTimers.current.open);
    setSnapOpen(false);
    wm.snapApp(win.id, layout, zoneIndex);
  }

  return (
    <section
      ref={rootRef}
      data-win-id={win.id}
      className={`win-frame ${variant} ${focused ? "focused" : ""} ${maximized ? "maximized" : ""} ${
        win.fullscreen ? "fullscreen" : ""
      }`}
      style={style}
      onPointerDown={() => wm.focusApp(win.id)}
      role="dialog"
      aria-label={meta.title}
      aria-hidden={win.minimized || undefined}
    >
      <header
        className="win-titlebar"
        onPointerDown={onTitlePointerDown}
        // Double-clicking the title bar is ZOOM, not full screen — and it does
        // nothing to a window that is already full screen, as on a real Mac.
        onDoubleClick={() => !win.fullscreen && wm.toggleMaximize(win.id)}
      >
        {variant === "macos" ? (
          <>
            <div className="mac-lights">
              <button className="mac-light mac-close" aria-label="Close" onPointerDown={stop} onClick={handleClose}>
                <span aria-hidden="true">✕</span>
              </button>
              {/* macOS won't let you minimize a full-screen window — the yellow
                  light greys out until you leave full screen. */}
              <button
                className="mac-light mac-min"
                aria-label="Minimize"
                disabled={win.fullscreen}
                onPointerDown={stop}
                onClick={handleMinimize}
              >
                <span aria-hidden="true">−</span>
              </button>
              {/* Green = full screen since Lion. ⌥-click still zooms, as it does
                  on a real Mac, which is also where the old "+" glyph lives. */}
              <button
                className="mac-light mac-zoom"
                aria-label={win.fullscreen ? "Exit full screen" : maximized ? "Restore" : "Enter full screen"}
                onPointerDown={stop}
                onClick={(e) => (e.altKey ? wm.toggleMaximize(win.id) : wm.toggleFullscreen(win.id))}
              >
                <span aria-hidden="true">{win.fullscreen ? "⤡" : maximized ? "◦" : "+"}</span>
              </button>
            </div>
            <div className="mac-title">
              <AppIcon id={meta.id} size={17} radius={0.2237} className="mac-title-icon" />
              {meta.title}
            </div>
          </>
        ) : (
          <>
            <div className="win-tb-app">
              <AppIcon id={meta.id} size={18} radius={0.18} className="win-tb-icon" />
              <span className="win-tb-title">{meta.title}</span>
            </div>
            <div className="win-caption">
              <button className="win-cap" aria-label="Minimize" onPointerDown={stop} onClick={() => wm.minimizeApp(win.id)}>
                <svg width="10" height="10" viewBox="0 0 10 10">
                  <line x1="1" y1="5" x2="9" y2="5" stroke="currentColor" strokeWidth="1" />
                </svg>
              </button>
              <span className="snap-anchor" onMouseEnter={snapEnter} onMouseLeave={snapLeave}>
                <button
                  className="win-cap"
                  aria-label={maximized ? "Restore" : "Maximize"}
                  onPointerDown={stop}
                  onClick={() => {
                    setSnapOpen(false);
                    wm.toggleMaximize(win.id);
                  }}
                >
                  {maximized ? (
                    <svg width="10" height="10" viewBox="0 0 10 10">
                      <rect x="1.2" y="2.8" width="6" height="6" fill="none" stroke="currentColor" strokeWidth="1" />
                      <path d="M3.2 2.8V1.2h6v6H7.6" fill="none" stroke="currentColor" strokeWidth="1" />
                    </svg>
                  ) : (
                    <svg width="10" height="10" viewBox="0 0 10 10">
                      <rect x="1.2" y="1.2" width="7.6" height="7.6" fill="none" stroke="currentColor" strokeWidth="1" />
                    </svg>
                  )}
                </button>
                {snapOpen && (
                  <div className="snap-flyout" role="menu" aria-label="Snap layouts" onPointerDown={stop}>
                    {SNAP_LAYOUTS.map((zones, i) => (
                      <div key={i} className="snap-layout">
                        {zones.map((z, j) => (
                          <button
                            key={j}
                            className="snap-zone"
                            role="menuitem"
                            aria-label={`Snap to zone ${j + 1} of layout ${i + 1}`}
                            style={{
                              left: `calc(${z.x * 100}% + 1.5px)`,
                              top: `calc(${z.y * 100}% + 1.5px)`,
                              width: `calc(${z.w * 100}% - 3px)`,
                              height: `calc(${z.h * 100}% - 3px)`,
                            }}
                            onClick={() => pickZone(zones, j)}
                          />
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </span>
              <button className="win-cap win-cap-close" aria-label="Close" onPointerDown={stop} onClick={() => wm.closeApp(win.id)}>
                <svg width="10" height="10" viewBox="0 0 10 10">
                  <line x1="1.4" y1="1.4" x2="8.6" y2="8.6" stroke="currentColor" strokeWidth="1" />
                  <line x1="8.6" y1="1.4" x2="1.4" y2="8.6" stroke="currentColor" strokeWidth="1" />
                </svg>
              </button>
            </div>
          </>
        )}
      </header>

      <div className="win-content">
        <AppContent id={win.id} api={api} />
      </div>

      {!maximized && !win.fullscreen && (
        <div className="win-resize" onPointerDown={onResizePointerDown} aria-hidden="true" />
      )}
    </section>
  );
}
