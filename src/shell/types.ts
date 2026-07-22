// Shell-level types shared by the window engine and every OS skin.

export type OSKind = "windows" | "macos" | "ios" | "android";

export type Theme = "light" | "dark";

/** "auto" = 15s slideshow; otherwise a wallpaper id from data/wallpapers. */
export type WallpaperPref = "auto" | string;

export interface Geometry {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface WinState extends Geometry {
  /** app id, unique per open window (one window per app) */
  id: string;
  z: number;
  /**
   * Windows "maximize" / macOS "zoom" — the same thing: fill the work area,
   * leaving the taskbar (or the menu bar + dock) on show.
   */
  maximized: boolean;
  /**
   * macOS green-button full screen — a different mode entirely: the window owns
   * the whole display and the menu bar, dock and title bar all auto-hide.
   * Mutually exclusive with `maximized`.
   */
  fullscreen: boolean;
  minimized: boolean;
  /** geometry to return to when leaving zoom / full screen */
  restore?: Geometry;
}

/**
 * Persisted subset — geometry + zoom, per app id. Full screen is deliberately
 * NOT persisted: it's a transient mode, and restoring into one would drop a
 * returning visitor into a chrome-less window they never asked for.
 */
export interface SavedGeom extends Geometry {
  maximized: boolean;
}
