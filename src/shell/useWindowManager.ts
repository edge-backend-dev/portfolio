import { useCallback, useRef, useState } from "react";
import type { Geometry, WinState } from "./types";
import type { SnapZone } from "./snapLayouts";
import { loadGeom, saveGeom, clearGeom } from "./persistence";

// The window engine. Skin-agnostic: Windows / macOS chrome are just different
// renderings of this same state. Handles open/close/minimize/maximize, focus
// (z-order), geometry updates from drag & corner-resize, and persistence.

export const MIN_W = 340;
export const MIN_H = 240;

/** fallback size when an app defines no defaultSize (clamped to the viewport) */
const STANDARD_W = 640;
const STANDARD_H = 540;

/** area available for windows (excludes chrome). Overridable per skin. */
export interface WorkArea {
  top: number;
  bottom: number; // px reserved at the bottom (taskbar/dock)
}

function clampGeom(g: Geometry, area: WorkArea): Geometry {
  if (typeof window === "undefined") return g;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const w = Math.min(Math.max(g.w, MIN_W), vw);
  const h = Math.min(Math.max(g.h, MIN_H), vh - area.top - area.bottom);
  // keep at least part of the title bar reachable
  const x = Math.min(Math.max(g.x, -(w - 120)), vw - 120);
  const y = Math.min(Math.max(g.y, area.top), vh - area.bottom - 44);
  return { x, y, w, h };
}

export function useWindowManager(area: WorkArea) {
  const [windows, setWindows] = useState<WinState[]>([]);
  const zTop = useRef(200);
  const areaRef = useRef(area);
  areaRef.current = area;

  const persist = useCallback((w: WinState) => {
    // persist the "restore" geometry when zoomed/full screen, else current, so a
    // window in either mode still records the real box it came from
    const g = (w.maximized || w.fullscreen) && w.restore ? w.restore : { x: w.x, y: w.y, w: w.w, h: w.h };
    saveGeom(w.id, { ...g, maximized: w.maximized });
  }, []);

  const focusApp = useCallback((id: string) => {
    setWindows((prev) => {
      const z = ++zTop.current;
      return prev.map((w) => (w.id === id ? { ...w, z } : w));
    });
  }, []);

  const openApp = useCallback((id: string) => {
    setWindows((prev) => {
      const z = ++zTop.current;
      const existing = prev.find((w) => w.id === id);
      if (existing) {
        return prev.map((w) => (w.id === id ? { ...w, minimized: false, z } : w));
      }
      // A window left open is restored where the visitor left it (position,
      // size, zoom) across a reload; full screen is intentionally not restored
      // (see SavedGeom). A first — or post-close — open uses one shared standard
      // size for every app, cascaded, so fresh opens stay uniform and tidy.
      const saved = loadGeom(id);
      const cascade = prev.length % 6;
      const base: Geometry = saved
        ? { x: saved.x, y: saved.y, w: saved.w, h: saved.h }
        : {
            x: 90 + cascade * 30,
            y: (areaRef.current.top || 0) + 40 + cascade * 30,
            w: STANDARD_W,
            h: STANDARD_H,
          };
      // clamp guards the restored case too: a window left half off-screen, or
      // saved on a much wider display, is pulled back into reach.
      const g = clampGeom(base, areaRef.current);
      const maximized = saved?.maximized ?? false;
      return [
        ...prev,
        {
          id,
          ...g,
          z,
          maximized,
          fullscreen: false,
          minimized: false,
          // Coming back already zoomed, the saved geometry IS the restore
          // target — without it the zoom button has nowhere to put it back.
          restore: maximized ? g : undefined,
        },
      ];
    });
  }, []);

  const closeApp = useCallback((id: string) => {
    // Closing forgets any resized/moved geometry, so reopening starts fresh at
    // the app's default size and cascaded position — not the box it was last
    // dragged to. (Persistence still restores a window that stays open across a
    // page reload; only an explicit close resets it.)
    clearGeom(id);
    setWindows((prev) => prev.filter((w) => w.id !== id));
  }, []);

  const minimizeApp = useCallback((id: string) => {
    setWindows((prev) => prev.map((w) => (w.id === id ? { ...w, minimized: true } : w)));
  }, []);

  const toggleMaximize = useCallback(
    (id: string) => {
      setWindows((prev) =>
        prev.map((w) => {
          if (w.id !== id) return w;
          let next: WinState;
          if (w.maximized && w.restore) {
            next = { ...w, ...w.restore, maximized: false, restore: undefined };
          } else {
            next = {
              ...w,
              maximized: true,
              fullscreen: false,
              restore: w.restore ?? { x: w.x, y: w.y, w: w.w, h: w.h },
            };
          }
          persist(next);
          return next;
        }),
      );
    },
    [persist],
  );

  /**
   * macOS full screen (the green button). Not a bigger zoom — a distinct mode:
   * the window takes the whole display and MacShell hides the menu bar, dock and
   * title bar behind an edge-hover reveal.
   */
  const toggleFullscreen = useCallback(
    (id: string) => {
      setWindows((prev) =>
        prev.map((w) => {
          if (w.id !== id) return w;
          let next: WinState;
          if (w.fullscreen) {
            next = w.restore
              ? { ...w, ...w.restore, fullscreen: false, restore: undefined }
              : { ...w, fullscreen: false };
          } else {
            next = {
              ...w,
              fullscreen: true,
              maximized: false,
              // going full screen from a zoomed window keeps the pre-zoom box
              restore: w.restore ?? { x: w.x, y: w.y, w: w.w, h: w.h },
            };
          }
          persist(next);
          return next;
        }),
      );
    },
    [persist],
  );

  /**
   * Apply a Win11 snap layout: the chosen window goes into `layout[zoneIndex]`
   * and — like real Snap Assist — the layout's remaining zones are auto-filled
   * with the other open windows, most recently used first (z-order), so with
   * many windows open recency decides who gets a slot. Windows that don't fit
   * the layout stay where they are.
   */
  const snapApp = useCallback(
    (id: string, layout: SnapZone[], zoneIndex: number) => {
      if (typeof window === "undefined") return;
      const a = areaRef.current;
      const vw = window.innerWidth;
      const vh = window.innerHeight - a.top - a.bottom;
      const zoneGeom = (zone: SnapZone): Geometry =>
        clampGeom(
          {
            x: Math.round(zone.x * vw),
            y: Math.round(a.top + zone.y * vh),
            w: Math.round(zone.w * vw),
            h: Math.round(zone.h * vh),
          },
          a,
        );
      setWindows((prev) => {
        // candidates for the other zones: every other window, newest first
        const others = prev.filter((w) => w.id !== id).sort((x, y) => y.z - x.z);
        const assigned = new Map<string, SnapZone>([[id, layout[zoneIndex]]]);
        let k = 0;
        layout.forEach((zone, i) => {
          if (i === zoneIndex) return;
          const w = others[k++];
          if (w) assigned.set(w.id, zone);
        });
        // raise all snapped windows; the chosen one ends on top
        const zOf = new Map<string, number>();
        others
          .slice(0, k)
          .reverse()
          .forEach((w) => assigned.has(w.id) && zOf.set(w.id, ++zTop.current));
        zOf.set(id, ++zTop.current);
        return prev.map((w) => {
          const zone = assigned.get(w.id);
          if (!zone) return w;
          // Deliberately NOT persisted: a snap arrangement is transient, so
          // apps launched later still open at their normal size/position.
          return {
            ...w,
            ...zoneGeom(zone),
            z: zOf.get(w.id) ?? w.z,
            maximized: false,
            fullscreen: false,
            minimized: false,
            restore: undefined,
          };
        });
      });
    },
    [],
  );

  /** live geometry update during a drag/resize gesture (no persist) */
  const setGeom = useCallback((id: string, g: Partial<Geometry>) => {
    setWindows((prev) =>
      prev.map((w) => {
        if (w.id !== id) return w;
        const merged = clampGeom({ x: g.x ?? w.x, y: g.y ?? w.y, w: g.w ?? w.w, h: g.h ?? w.h }, areaRef.current);
        return { ...w, ...merged };
      }),
    );
  }, []);

  /** commit at gesture end — persists geometry */
  const commitGeom = useCallback(
    (id: string) => {
      setWindows((prev) => {
        const w = prev.find((x) => x.id === id);
        if (w) persist(w);
        return prev;
      });
    },
    [persist],
  );

  const resetGeom = useCallback((id: string) => {
    clearGeom(id);
  }, []);

  const isOpen = useCallback(
    (id: string) => windows.some((w) => w.id === id && !w.minimized),
    [windows],
  );

  return {
    windows,
    openApp,
    closeApp,
    minimizeApp,
    toggleMaximize,
    toggleFullscreen,
    snapApp,
    focusApp,
    setGeom,
    commitGeom,
    resetGeom,
    isOpen,
  };
}

export type WindowManager = ReturnType<typeof useWindowManager>;
