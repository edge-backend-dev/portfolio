import type { SavedGeom, Theme, OSKind, WallpaperPref } from "./types";

// localStorage persistence. All access is guarded so SSR / private-mode never
// throws. Window geometry is saved per app id and read back by openApp, so a
// window reappears where the user left it — including zoomed or full screen.
// `fullscreen` is optional on the way in: records written before the mode
// existed simply lack the key and come back windowed.

const GEOM_KEY = (id: string) => `portfolio:win:${id}`;
const OS_KEY = "portfolio:os-override";
const THEME_KEY = "portfolio:theme";
const WALLPAPER_KEY = "portfolio:wallpaper";

function safeGet(key: string): string | null {
  try {
    return typeof localStorage !== "undefined" ? localStorage.getItem(key) : null;
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string): void {
  try {
    localStorage?.setItem(key, value);
  } catch {
    /* private mode / quota — ignore */
  }
}

function safeRemove(key: string): void {
  try {
    localStorage?.removeItem(key);
  } catch {
    /* ignore */
  }
}

export function loadGeom(id: string): SavedGeom | null {
  const raw = safeGet(GEOM_KEY(id));
  if (!raw) return null;
  try {
    const g = JSON.parse(raw) as SavedGeom;
    if (typeof g.x === "number" && typeof g.y === "number" && typeof g.w === "number" && typeof g.h === "number") {
      return g;
    }
  } catch {
    /* corrupt — ignore */
  }
  return null;
}

export function saveGeom(id: string, g: SavedGeom): void {
  safeSet(GEOM_KEY(id), JSON.stringify(g));
}

export function clearGeom(id: string): void {
  safeRemove(GEOM_KEY(id));
}

export function loadOSOverride(): OSKind | null {
  const v = safeGet(OS_KEY);
  return v === "windows" || v === "macos" || v === "ios" || v === "android" ? v : null;
}

export function saveOSOverride(os: OSKind | null): void {
  if (os) safeSet(OS_KEY, os);
  else safeRemove(OS_KEY);
}

export function loadTheme(): Theme | null {
  const v = safeGet(THEME_KEY);
  return v === "light" || v === "dark" ? v : null;
}

export function saveTheme(theme: Theme): void {
  safeSet(THEME_KEY, theme);
}

export function loadWallpaper(): WallpaperPref | null {
  const v = safeGet(WALLPAPER_KEY);
  return v || null;
}

export function saveWallpaper(pref: WallpaperPref): void {
  safeSet(WALLPAPER_KEY, pref);
}
