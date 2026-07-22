import type { OSKind, Theme, WallpaperPref } from "../../shell/types";

// Context handed to every app so system apps (Settings, Contact) can act on the
// shell without knowing which OS skin is active.
export interface AppApi {
  theme: Theme;
  setTheme: (t: Theme) => void;
  os: OSKind;
  /** pass null to return to auto-detected OS */
  setOS: (os: OSKind | null) => void;
  autoOS: OSKind;
  overriding: boolean;
  /** "auto" for the 15s slideshow, or a wallpaper id (desktop skins only) */
  wallpaper: WallpaperPref;
  setWallpaper: (pref: WallpaperPref) => void;
  openApp: (id: string) => void;
  resetLayout: () => void;
}
